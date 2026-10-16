---
title: "Developer tools in the editor"
---

Four tools help you see what a session is doing without writing a readout of your own. Two are components you add to an object while you chase a problem, one is an editor window, and one is a menu command that checks your prefabs before you build.

| Tool | Where it lives | What it answers |
|---|---|---|
| `NetworkCorrectionVisualizer` | Component, added under a networked object | Where and how far did prediction correct this object? |
| `NetworkInterestOverlay` | Component, added under a networked object | What is this object's controller being sent? |
| Network Inspector | **Window > Nucleus > Network Inspector** | What role, tick, connections and objects does this session have right now? |
| Validate Network Prefabs | **Nucleus > Validate Network Prefabs** | Will my networked prefabs spawn correctly? |

None of them change the session they look at, so they are safe to leave in a scene while you test. Take the two components off, or switch them off, before you ship: they exist to answer a question, not to run in a player's build.

## Seeing prediction corrections

Add `NetworkCorrectionVisualizer` to a predicted object, either on the `NetworkSystemObject` itself or on a child of it. It finds the nearest `NetworkSystemObject` at or above it in `Awake` and watches every system linked to that object, including systems that link later. Without a `NetworkSystemObject` above it, it logs an error and disables itself.

Each time a reconcile's replay finishes on a system, the visualizer looks at the members the replay corrected. For every correction larger than its threshold it flashes: a cross where the member was shown before the correction, a cross where the replay put it, and a line between them. The flash is drawn with `Debug.DrawLine`, so it shows in the Scene view, and in the Game view while the Game view's Gizmos toggle is on.

Corrections only happen on a client that predicts the object, so that is the only peer where the visualizer ever draws. On the server, and on a client that only observes the object, it stays quiet.

| Field | Default | What it does |
|---|---|---|
| **Threshold** | `0.05` | The largest correction ignored, in the member's own units (metres for a position). Only larger corrections flash. |
| **Flash Interval** | `0` | The shortest time between two flashes, in seconds of unscaled time. Zero flashes on every correction past the threshold. |
| **Flash Duration** | `0.5` | How long each flash stays drawn, in seconds. |
| **Color** | magenta | The color of the line and both crosses. |
| **Marker Size** | `0.15` | The half-size of the cross drawn at each end, in metres. |
| **Log Enabled** | off | Also log each flashed correction, naming the member, its size and the tick. |

While playing, the inspector adds two readouts: **Flashes**, the number of corrections drawn or logged since the component woke, and **Last Correction (m)**, the size of the most recent position correction. Both are also public properties (`FlashCount` and `LastCorrectionDistance`), so a script or a test can read them.

### What gets drawn

Only a `NetworkMember<System.Numerics.Vector3>` is drawn as a line, because only a position has a place in the world to draw it. A position replicated in a parent's local space is drawn where it would sit unparented. A correction to any other member type (a rotation, a float, a custom struct) still counts toward **Flashes**, and with **Log Enabled** it is logged, but nothing is drawn for it.

The threshold is measured by the engine's own `NetworkMemberBase.IsCorrectedBeyond`, with the same tolerance comparer the engine uses when it records corrections. That means the number you type is compared in the member type's units, the same way the engine compares it, so a threshold that matches your prediction tolerance shows exactly the corrections the engine treats as real.

### Reading what you see

- **Short lines on every tick** mean the client's prediction disagrees with the server by a small, steady amount. Look for something the client simulates differently: a value read from `Time.deltaTime` instead of the network step, a random number, or a physics setting that differs between builds.
- **Long lines now and then** usually line up with packet loss or a collision the client did not predict. Turn on **Log Enabled** to see which tick each one happened on.
- **No lines at all** while the object visibly snaps means the snap is not a prediction correction. Check smoothing and interpolation instead (see [Proxies and smoothing](../control/proxies-and-smoothing.md)).

Raise **Flash Interval** when corrections come so often that the lines turn into a smear.

## Seeing what an object's controller is sent

Add `NetworkInterestOverlay` to a networked object, on the `NetworkSystemObject` or a child of it, and switch on **Overlay Enabled**. It is off by default, and it costs nothing until it is switched on and the object is selected, because the drawing happens in `OnDrawGizmosSelected`.

Enter play mode as the server or host and select the object. The overlay reads who controls each system on the object, and for each controlling client it draws a line from this object to every other networked object, colored by what that client's connection holds of it:

| Color | Meaning |
|---|---|
| Green | Streamed: the client has the object and is sent its updates. |
| Yellow | Stopped: the client still has the object, but is no longer sent updates for it. |
| Faint red | Unspawned: the client does not have the object at all. Drawn only with **Unspawned Draw Enabled**. |

An object with several systems is colored by the most the connection holds of any of them, so an object with one streamed part reads as streamed. When different clients control different systems on the selected object, each client's set of lines is lifted a little higher than the last, by **Controller Spacing**, so they stay apart. **Marker Radius** sets the size of the wire sphere drawn on each object a line reaches.

Interest is resolved only on the authority, so the overlay draws only on a server or host. Selecting the object in a client's editor draws nothing. An object nobody controls (a server-owned object) also draws nothing, because there is no client whose view to show.

To make the same check from code on the server, call `NetworkSystem.GetInterestMembership(connection)`, which returns the `InterestMembership` that system currently resolves toward a connection. Game code that needs to react when that changes should subscribe to the system's `InterestChanged` event instead of polling. [Interest troubleshooting](../interest/interest-troubleshooting.md) walks through what to do once you can see the problem.

## The Network Inspector window

Open **Window > Nucleus > Network Inspector**. Outside play mode it only tells you to enter play mode with a `UnityCoreManager` in the scene; while playing, it shows the `CoreManager` the integration bound (`NucleusUnity.BoundCoreManager`) in three sections:

- **Session**: the role (Host, Server, Client or Stopped) and the current tick.
- **Connections**: one row per active connection, with its id, whether it is the server side or a client, its state, round trip time (a dash until the first measurement), packet loss, and how many reconciles the server has sent to it.
- **Objects**: every `NetworkSystemObject` in the open scenes, sorted by name. Each row lists the object's systems with their id, controller (the server or a client id), whether the system has started, and how many reconciles it has received. Click an object's name to select and ping it in the hierarchy; type in **Filter** to narrow the list by name.

The window reads only public state and changes nothing. It repaints about ten times a second, and gathers the object list from the scene once a second rather than on every repaint, so an object you spawn appears within a second.

The reconcile counts are each counted on one side only. A connection's reconciles-sent count is kept on the server, so it reads zero in a client's window. A system's reconcile count is kept on the client that receives the corrections, so it reads zero on the server. Run the window in both editors (see [Testing with two editors](../../start-here/testing-with-two-editors.md)) to see both halves.

## Validating your networked prefabs

Run **Nucleus > Validate Network Prefabs** before a build, or whenever a spawn goes wrong in a way you cannot explain. It loads every prefab in the project, logs each problem it finds to the Console as an error against the prefab it names (click the entry to ping the prefab), and ends with a dialog counting the problems. A clean project gets a dialog saying every networked prefab is set up correctly.

It checks two kinds of problem.

**Identity problems** are the ones a player build refuses (see [Prefab identity and the prefab collection](../systems/prefab-ids-and-collections.md)): no base `NetworkPrefabCollection`, two collections resolving to the same prefab bundle, a networked prefab missing from its collection, a prefab with no prefab id, two prefabs sharing one id, or a prefab stamped with a different bundle than its collection. This is the same check the build runs, so the validator and the build never disagree. Every identity problem is fixed by **Nucleus > Rebuild Network Prefab Collection**, and the dialog says so when it finds one.

**Structure problems** are hierarchies a spawn would mishandle:

- A `NetworkSystemObject` on a child of the prefab. Only a prefab's root marker is spawned, so remove the child's marker; components on the child belong to the root's marker.
- A `NucleusBehaviour` or `NetworkTransform` with no `NetworkSystemObject` at or above it. It is never given a system, so it never replicates. Add a marker to the prefab's root.
- A `NetworkHitboxRoot` that would record nothing. The validator reports the errors the hitbox root's own inspector shows; its warnings and notes stay in the inspector.

The validator runs only when you ask, never on save or on entering play mode, because loading every prefab gets slower as the project grows. It changes nothing in your project.
