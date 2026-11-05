---
title: "NetworkNavMeshAgent"
---

## NetworkNavMeshAgent sends the leg being walked, not the pose

`NetworkNavMeshAgent` replicates a `NavMeshAgent`. When a new leg begins, the controlling peer sends the point it is heading for, the point it set off from, and the agent's speed, angular speed and acceleration. Every other peer walks its own copy along that leg, turning toward its direction of travel, with its own `NavMeshAgent` switched off. An agent that holds its course sends nothing, however far it travels.

Use it instead of `NetworkTransform`, never alongside it: both would replicate the same motion.

## Check the requirements

- Unity's AI module (`com.unity.modules.ai`) must be enabled, as it is in a new project. Without it the component is left out and the rest of the integration still compiles. The integration sets the `NUCLEUS_NAVMESH` define for you when the module is present.
- The controlling peer needs a baked NavMesh covering the agent's path, and so does any peer that may take control later. Followers need no NavMesh.
- The prefab's agent settings must match on every peer, since a follower walks from the replicated leg and its own local settings.

## Set the inspector fields

| Field | Default | Purpose |
|---|---|---|
| Point Change Tolerance | 0.05 | How far, in metres, the agent's steering target must move before it counts as a new leg. Too small a value sends a leg for every small nudge a path recalculation makes. |
| Resync Distance | 0.5 | How far, in metres, a follower may stand from a new leg's origin before it walks the gap off over the next moment. Below this it just retargets onto the new leg, so the error never shows. |
| Teleport Distance | 6 | How far, in metres, a follower may stand from a new leg's origin before it is placed there outright, such as after a warp or when it has fallen too far behind. |
| Rotation Enabled | on | Turns a follower toward its direction of travel at the replicated angular speed. Rotation is derived from the path, not sent. |
| Agent Management Enabled | on | Disables the attached `NavMeshAgent` on every peer except the controller, and enables it there. A follower's own agent must not run, or it fights the replicated leg. |
| Send Interval | `SendInterval.Normal` | Normal sends a leg on the tick it begins. A larger interval delays a leg by up to that interval. |

A received spawn is always placed where the sender stood when it sent the spawn, moving at the sender's velocity, whatever these distances are.

## Drive it from code

These act on the attached `NavMeshAgent` and work only on the peer that controls the object (`IsController(ControllerType.AnyController)`). A call from a follower is refused.

```csharp
public bool SetDestination(Vector3 destination);
public void Stop();
public void Resume();
public bool Warp(Vector3 position);
```

The path is found on the controlling peer only, so other peers never learn the destination. A `Warp` reaches followers through the next leg, whose origin is the warped-to position, and follows the Resync Distance and Teleport Distance rules above.

## Read where the agent is walking

```csharp
public Vector3 NextPoint { get; }
public Vector3 PreviousPoint { get; }
public float FollowerSpeed { get; }
```

- `NextPoint` and `PreviousPoint` are the current leg's endpoints in world space.
- `FollowerSpeed` is the speed a follower is walking at right now. It ramps toward the replicated speed and drops through a turn. It reads zero on the controller, which walks its real agent.
