---
title: "NetworkNavMeshAgent"
---

## Overview

`NetworkNavMeshAgent` replicates a `NavMeshAgent` by sending the leg it is walking, not its pose. The peer that controls the object captures a leg — the point it is heading for, the point it set off from, and the agent's speed, angular speed, and acceleration — only when a new leg begins. Every other peer walks its own copy of that agent from one point to the other at the replicated settings, turning toward its direction of travel, with its own `NavMeshAgent` switched off so nothing path-finds twice.

An agent that holds its course costs nothing however far it travels: silence means the follower is still walking the leg it was last told about. Use this instead of `NetworkTransform`, not alongside it — the leg origin already carries the object's position, and a `NetworkTransform` added on top would replicate the same motion twice.

## Inspector fields

| Field | Default | Purpose |
|---|---|---|
| Point Change Tolerance (`_pointChangeTolerance`) | 0.05 | How far the agent's steering target must move, in metres, before it counts as a new leg. A path recalculation nudges the target by small amounts without the agent having actually turned; too small a value sends a leg for that nudge. |
| Resync Distance (`_resyncDistance`) | 0.5 | How far a follower may stand from a new leg's origin before it starts closing the gap. Below this it just retargets, so an ordinary correction is invisible. |
| Teleport Distance (`_teleportDistance`) | 6 | How far a follower may stand from a new leg's origin before it is placed there outright instead of walking the gap off. Above this the gap is a discontinuity — a warp, or a peer that has fallen too far behind to catch up in a reasonable time. |
| Rotation Enabled (`_rotationEnabled`) | on | Turns a following peer toward its direction of travel at the replicated angular speed. Rotation is derived from the path, not sent — an agent's rotation changes on nearly every tick, so replicating it would erase most of what this component saves. |
| Agent Management Enabled (`_agentManagementEnabled`) | on | Disables the attached `NavMeshAgent` on every non-controlling peer and enables it on the controller. A follower's own agent must not run: it would path-find toward a destination it was never told about and fight the replicated leg. |
| Send Interval (`_sendInterval`) | `SendInterval.Normal` | How often the replicated members ride. Normal sends a leg on the tick it begins; a larger interval paces the whole agent, delaying a leg by up to that interval. |

## Driving it from code

`SetDestination`, `Stop`, `Resume`, and `Warp` all act on the attached `NavMeshAgent`, and all are gated on the calling peer controlling the object (`IsController(ControllerType.AnyController)`). A call from a peer that only follows is refused rather than silently diverging.

```csharp
public bool SetDestination(Vector3 destination);
public void Stop();
public void Resume();
public bool Warp(Vector3 position);
```

The path is found locally on the controlling peer, and only the legs it produces are replicated — no other peer ever learns the destination itself. A `Warp` reaches followers through the next leg, whose origin is the position warped to; because a warp of any real distance exceeds Resync Distance, the follower is seated there rather than walking the gap off.

## Reads

```csharp
public Vector3 NextPoint { get; }
public Vector3 PreviousPoint { get; }
public float FollowerSpeed { get; }
```

`NextPoint` and `PreviousPoint` are the current leg's endpoints in world space, as the replication currently has them. `FollowerSpeed` is the speed a following peer is walking at right now — it ramps toward the replicated speed rather than starting there, and drops away again through a turn, so it reads as zero on the controller (which walks its real agent instead).

## The replicated component

Behind the `MonoBehaviour` sits `UnityNavMeshAgentComponent`, the replicated `NetworkComponent` that actually carries the leg:

- `NextPoint` and `PreviousPoint` — the leg's endpoints.
- `Speed`, `AngularSpeed`, `Acceleration` — the agent settings a follower needs to reproduce the walk.
- `IsStopped` — whether the agent is halted.

`NetworkNavMeshAgent` binds this component on link, applies the inspector settings to it, and captures a leg whenever this peer controls the object; on every other peer it seats the object on the leg origin and advances it toward `NextPoint` each frame.

## Corrections

A correction must not read as a stop. Re-seating a follower on every new leg would make an agent that is tracking perfectly well twitch once per corner, which looks like a replication fault rather than the correction it is. So:

- Under Resync Distance, a follower simply retargets onto the new leg and keeps walking — the error is invisible.
- Between Resync Distance and Teleport Distance, the follower owes the gap as ground to make up, and walks it off over the next moment instead of being moved.
- At or past Teleport Distance, the gap is treated as a discontinuity, and the follower is placed on the new leg's origin outright.

A received spawn is always seated on the leg origin regardless of these thresholds — a peer arriving mid-leg has no position of its own to correct from.

## Requirements

- Every peer needs a baked NavMesh covering the agent's path. A follower never path-finds; it only walks the leg it was told about, but it still needs the mesh under it to stand on.
- The prefab's agent settings (tolerance, resync and teleport distances, rotation, agent management, send interval) must match on every peer, since the follower walks entirely from the replicated leg and its own local settings.
