---
title: "NetworkPhysicsComponent"
---

## Overview

`NetworkPhysicsComponent` replicates a physics body's kinematic state through ordinary member replication. The authority captures its body into typed members each tick; proxies rebuild the latest authoritative `PhysicsSnapshot` from those members as the projection source. Only position and rotation ride the wire — linear and angular velocity are derived from their per-tick change when a snapshot is built, so a moving body carries roughly half the members it otherwise would.

## Replicated members

| Member | Type | Wire settings |
|---|---|---|
| `WorldPosition` | `NetworkMember<Vector3>` | `CompressionLevel.Aggressive`, `TransmissionModeDefaults.Motion` |
| `WorldRotation` | `NetworkMember<Quaternion>` | `TransmissionModeDefaults.Motion` |
| `BodyFlags` | `NetworkMember<int>` | default |
| `CaptureTick` | `NetworkMember<int>` | default |

`WorldPosition` and `WorldRotation` are built at `TransmissionModeDefaults.Motion`, so they divinely project wherever that mode is available.

`BodyFlags` carries a `PhysicsBodyFlags` value as an int member, since byte members do not currently ride the replication pipeline; the delta encoding keeps the wire cost equivalent.

`CaptureTick` is the authority tick the carried state was captured at, letting receivers anchor reconciles and projections to the snapshot's exact age instead of estimating it. It is carried as a signed int so the delta encoder can represent a decrease: a pooled component reused for a fresh body resets below the delta baseline, and an unsigned delta of that decrease would wrap to a 64-bit value and corrupt the stream. It holds `NetworkLoopManager.UnsetTick` until a ticked capture runs, and it is only re-stamped when the captured state actually changed — a resting body stays wire-quiet instead of dirtying the member every tick.

## PhysicsBodyFlags

Replicated body condition bits packed into `BodyFlags`.

| Flag | Value | Meaning |
|---|---|---|
| `None` | `0` | No condition bits are set. |
| `Sleeping` | `1 << 0` | The body is sleeping. |
| `Kinematic` | `1 << 1` | The body is kinematic and does not respond to forces. |
| `Captured` | `1 << 4` | The flags were written by a real body capture. |

`Captured` is never set on an unprimed member, so it doubles as the proof that real state has arrived — proxies read it as `HasReceivedState` rather than relying on the rotation member, which reads as identity when unset and cannot be distinguished from a genuinely captured identity rotation.

## Derived reads

| Property | Reads |
|---|---|
| `IsBodySleeping` | `BodyFlags` has `PhysicsBodyFlags.Sleeping` set. |
| `IsBodyKinematic` | `BodyFlags` has `PhysicsBodyFlags.Kinematic` set. |
| `HasReceivedState` | `BodyFlags` has `PhysicsBodyFlags.Captured` set. |
| `HasAdoptedState` | True once `TryAdoptInitialState` has placed a proxy body onto the first received state. |

## Methods

```csharp
public void CaptureBody(IPhysicsBody physicsBody, uint tick = Managers.NetworkLoop.NetworkLoopManager.UnsetTick)
```

Called by the authority once per tick, before serialization, to capture the body's current state into the replicated members. `CaptureTick` is only re-stamped when the captured position or rotation would actually serialize a change at that member's wire accuracy — not on every exact inequality, which would re-stamp on sub-quantum float jitter and drag the whole component onto the wire each tick even though nothing the receiver could observe had moved. This is what keeps a resting body wire-quiet.

```csharp
public PhysicsSnapshot BuildSnapshot()
```

Rebuilds the latest authoritative snapshot from the replicated members, called by proxies as the projection source. Linear and angular velocity are not replicated: they are derived from the change in `WorldPosition` and `WorldRotation` across their last two committed ticks, halving the moving wire cost in exchange for the small finite-difference error a one-tick-old average velocity carries into the projection.

```csharp
public bool TryAdoptInitialState(IPhysicsBody physicsBody)
```

Applies the first received state directly onto the body, once. A wire-spawned proxy instantiates at the prefab pose, and there is no local trajectory worth preserving before the first authoritative fact — converging from the prefab pose would visibly glide the body toward its real position instead of starting it there. Call this each proxy step before convergence; the step that adopts should skip its convergence. Returns `false` once `HasAdoptedState` is already true, or until `HasReceivedState` is true.

## PhysicsSnapshot

The value every method above trades in — remote authoritative state, local body state, and projected targets are all expressed as this one type.

| Field | Type | Meaning |
|---|---|---|
| `WorldPosition` | `Vector3` | The world-space position of the body. |
| `WorldRotation` | `Quaternion` | The world-space rotation of the body. |
| `LinearVelocity` | `Vector3` | The linear velocity of the body. |
| `AngularVelocity` | `Vector3` | The angular velocity of the body, as an axis scaled by radians per second. |
| `IsSleeping` | `bool` | True when the body is sleeping; a sleeping snapshot projects to itself. |

## Velocity is derived, not replicated

Neither linear nor angular velocity is a replicated member. Both are computed from the per-tick change of `WorldPosition` and `WorldRotation`:

- Linear velocity is `(WorldPosition.Value - previousPosition) / seconds`, using the last two committed position samples and the tick gap between them.
- Angular velocity is the rotation vector carrying the previous rotation onto the current one, divided by the same elapsed seconds.

A sleeping body, or one that does not yet have two committed samples, derives zero velocity in both cases.
