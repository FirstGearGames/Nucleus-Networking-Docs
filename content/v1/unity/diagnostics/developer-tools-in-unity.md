---
title: "Developer tools in the editor"
---

| Tool | Where it lives | What it answers |
|---|---|---|
| `NetworkCorrectionVisualizer` | Component, added under a networked object | Where and how far did prediction correct this object? |
| `NetworkInterestOverlay` | Component, added under a networked object | What is this object's controller being sent? |
| Traffic tab | **Tools > Nucleus**, then the **Traffic** tab | What is this session sending and receiving, and how healthy are its connections right now? |
| Validate Network Prefabs | **Tools > Nucleus**, then the **Build** tab | Will my networked prefabs spawn correctly? |

None of them change the session, apart from the Traffic tab's control buttons and simulated conditions. Remove or switch off the two components before you ship.

## See where prediction corrected an object

Add `NetworkCorrectionVisualizer` to a predicted object, on its `NetworkSystemObject` or a child of it. Without a `NetworkSystemObject` at or above it, it logs an error and disables itself. It watches every system linked to that object, including systems that link later.

For every correction larger than **Threshold**, it flashes a cross where the member was shown before the correction, a cross where the replay put it, and a line between them. The flash shows in the Scene view, and in the Game view while its Gizmos toggle is on. It only ever draws on a client that predicts the object.

| Field | Default | What it does |
|---|---|---|
| **Threshold** | `0.05` | The largest correction ignored, in the member's own units (metres for a position). Set it to your prediction tolerance to see exactly the corrections the engine treats as real. |
| **Flash Interval** | `0` | The shortest time between two flashes, in seconds of unscaled time. Zero flashes on every correction past the threshold. Raise it when the lines turn into a smear. |
| **Flash Duration** | `0.5` | How long each flash stays drawn, in seconds. |
| **Color** | magenta | The color of the line and both crosses. |
| **Marker Size** | `0.15` | The half-size of the cross drawn at each end, in metres. |
| **Log Enabled** | off | Also log each flashed correction, naming the member, its size and the tick. |

In play mode the inspector shows **Flashes**, the number of corrections drawn or logged so far, and **Last Correction (m)**, the size of the most recent position correction. Scripts and tests can read them as `FlashCount` and `LastCorrectionDistance`.

Only a `NetworkMember<System.Numerics.Vector3>` is drawn. A position replicated in a parent's local space is drawn where it would sit unparented. Corrections to other member types still count toward **Flashes** and are logged with **Log Enabled**, but nothing is drawn.

### Read the lines

- **Short lines on every tick** mean the client predicts slightly differently from the server. Look for a value read from `Time.deltaTime` instead of the network step, a random number, or a physics setting that differs between builds.
- **Long lines now and then** usually match packet loss or a collision the client did not predict. Turn on **Log Enabled** to see the tick of each one.
- **No lines at all** while the object visibly snaps means the snap is not a prediction correction. Check smoothing and interpolation instead (see [Proxies and smoothing](../control/proxies-and-smoothing.md)).

## Seeing what an object's controller is sent

1. Add `NetworkInterestOverlay` to a networked object, on its `NetworkSystemObject` or a child of it.
2. Switch on **Overlay Enabled**. It is off by default.
3. Enter play mode as the server or host and select the object.

For each client controlling a system on the object, it draws a line from this object to every other networked object, colored by what that client holds of it:

| Color | Meaning |
|---|---|
| Green | Streamed: the client has the object and is sent its updates. |
| Yellow | Stopped: the client still has the object, but is no longer sent updates for it. |
| Faint red | Unspawned: the client does not have the object at all. Drawn only with **Unspawned Draw Enabled**. |

An object with several systems takes the color of the most the client holds of any of them. When different clients control different systems on the selected object, each client's lines are raised by **Controller Spacing** so they stay apart. **Marker Radius** sets the size of the wire sphere drawn on each object a line reaches.

It draws nothing on a client, and nothing for an object no client controls.

To make the same check from code on the server, call `NetworkSystem.GetInterestMembership(connection)`, which returns the `InterestMembership` the system resolves toward that connection. To react when it changes, subscribe to the system's `InterestChanged` event instead of polling. [Interest troubleshooting](../interest/interest-troubleshooting.md) covers what to do next.

## The Traffic tab

Open **Tools > Nucleus** and select the **Traffic** tab. Outside play mode it offers an **Enter Play Mode** button and the simulated network conditions. While a session runs, the window's banner shows this peer's role (Host, Server, Client or Stopped), and the tab shows these sections, refreshed twice a second:

- **Controls**: **Start Server** or **Stop Server**, **Start Client** or **Stop Client**, and **Start Host** while neither side runs.
- **Session**: average frame time, the tick rate in ticks per second and milliseconds per tick, reconciles, and tick drift (how far the measured tick rate strays from the configured one). Frame time turns amber when a frame lasts longer than a tick, and tick drift turns amber past five percent of the tick rate. A server under its rate is falling behind; a client away from it is having its clock adjusted to keep its input arriving on time.
- **Bandwidth**: bytes sent and received per second, total bytes sent and received, a graph of both rates over the last minute, and how much of each direction is replicated state.
- **World**: connections, started systems, networked objects in the open scenes, and spawns that interest management admitted and deferred, followed by the session's redundancy, state interpolation, state retention and partial apply settings.
- **Network conditions**: on a server or host, one row per client with the round trip latency, jitter and packet loss that client reported; on a client, the same figures for its link to the server. A dash means not measured yet. Under them, **Simulated conditions** has a **Simulate** toggle that delays, drops and reorders packets on every transport, presets from **Perfect** through **LAN**, **Broadband**, **Wi-Fi** and **Mobile** to **Awful**, and the **Latency (ms)**, **Jitter (ms)**, **Packet Loss** and **Out Of Order** values. These are settings of the scene's `UnityTransportManager`, so they save with the scene, and a change in play mode applies straight away.

A server or host shows **reconciles sent**, the corrections it sent its clients. A client shows **reconciles received**, counting only objects still in the scene. To see both, open the window in both editors (see [Testing with two editors](../../start-here/testing-with-two-editors.md)).

## Validating your networked prefabs

Before a build, or when a spawn goes wrong in a way you cannot explain:

1. Open **Tools > Nucleus** and select the **Build** tab.
2. Click **Validate** next to **Validate Network Prefabs**.
3. Click each error in the Console to ping the prefab it names. A dialog at the end counts the problems.

The validator runs only when you click **Validate**, never on save or on entering play mode, and changes nothing in your project. It reports two kinds of problem.

**Identity problems** are the ones a player build refuses (see [Prefab identity and the prefab collection](../systems/prefab-ids-and-collections.md)): no base `NetworkPrefabCollection`, two collections resolving to the same prefab bundle, a networked prefab missing from its collection, a prefab with no prefab id, two prefabs sharing one id, or a prefab stamped with a different bundle than its collection. The build runs the same check. To fix any of them, click **Rebuild** next to **Rebuild Network Prefab Collection** on the same tab.

**Structure problems** are hierarchies a spawn would mishandle:

- A `NetworkSystemObject` on a child of the prefab. Only the root's marker is spawned, so remove the child's marker.
- A `NucleusBehaviour` or `NetworkTransform` with no `NetworkSystemObject` at or above it. It never replicates. Add a marker to the prefab's root.
- A `NetworkHitboxRoot` that would record nothing. The validator reports the errors its inspector shows; warnings and notes stay in the inspector.
