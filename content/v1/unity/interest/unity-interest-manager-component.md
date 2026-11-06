---
title: "Unity Interest Manager"
---

`UnityInterestManager` holds the world-wide interest rules and settings for the core `InterestManager`. Its settings are applied when the session starts, so changing them during play has no effect.

In a free build the inspector shows only **World Rules**, **Evaluation Cadence Ticks** and the two host switches. The **Distance Measurement** section is Pro.

## World Rules apply to every object

Each rule in this list applies to every `NetworkSystem` that starts, across the whole world. A new component starts with the Scene rule (`AuthoredSceneInterestCondition`).

Keep the Scene rule unless a rule of your own decides scene membership. Without one, the inspector warns, and a client receives objects from scenes it never loaded. They land in the wrong scene with no error, and several open copies of one scene cannot be told apart by distance.

## Set the cadence and the host switches

| Setting | Default | What it does |
| --- | --- | --- |
| **Evaluation Cadence Ticks** | `5` | Ticks between interest evaluations of any one object. A joining client and a newly started object are resolved at once, off the cadence. |
| **Host Interest Enabled** | off | Resolves the host's own client against the rules, so the host learns which objects its client half would not have been sent. It costs the host one ordinary condition pass per evaluated pair, and culls nothing by itself. |
| **Host Visibility Enabled** | on | Hides an object on the host while that report says its client half would not hold it. Because this is already on, setting **Host Interest Enabled** is all it takes to turn hiding on. Clear it to keep the report and act on it yourself, for example through `NetworkSystem.HostInterestChanged`. |

When hiding is on, a `NetworkHostVisibility` component is added to each networked object on a host only. See [Making a host see what its players see](./host-visibility-in-unity.md).

## Distance Measurement sets how distance is measured (Pro)

- **Interest Technique**: how every distance in the world is measured, pairwise or through a spatial grid.
- **Interest Axes**: which axes distances are measured across, the full volume or a plane that drops one axis.

Set both before anything carrying a distance rule spawns. A change after a distance rule has registered is refused with a logged error. See [Limit what a client receives by distance](./limit-replication-by-distance.md).
