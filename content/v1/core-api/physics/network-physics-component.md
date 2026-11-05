---
title: "NetworkPhysicsComponent"
---

`NetworkPhysicsComponent` replicates a physics body's position, rotation and condition flags through ordinary members. The controlling peer captures its body into the members each tick, and every other peer rebuilds a `PhysicsSnapshot` from them to follow. See [Replicate a physics body](./replicate-a-body.md) for the full setup.

## The component replicates four members

| Member | Type | Settings |
|---|---|---|
| `WorldPosition` | `NetworkMember<Vector3>` | `CompressionLevel.Aggressive`, `TransmissionModeDefaults.Motion` |
| `WorldRotation` | `NetworkMember<Quaternion>` | `TransmissionModeDefaults.Motion` |
| `BodyFlags` | `NetworkMember<int>` | default; holds a `PhysicsBodyFlags` value |
| `CaptureTick` | `NetworkMember<int>` | default |

`CaptureTick` is the tick of the capture, on the capturing peer's own tick counter: the server's for a server-controlled body, the controlling client's for a client-controlled one. It holds `NetworkLoopManager.UnsetTick` until a ticked capture runs.

## BodyFlags holds PhysicsBodyFlags

| Flag | Value | Meaning |
|---|---|---|
| `None` | `0` | No condition bits are set. |
| `Sleeping` | `1 << 0` | The body is sleeping. |
| `Kinematic` | `1 << 1` | The body is kinematic and does not respond to forces. |
| `Captured` | `1 << 4` | The flags were written by a real body capture. |

## Read the flags through properties

| Property | Reads |
|---|---|
| `IsBodySleeping` | `BodyFlags` has `PhysicsBodyFlags.Sleeping` set. |
| `IsBodyKinematic` | `BodyFlags` has `PhysicsBodyFlags.Kinematic` set. |
| `HasReceivedState` | `BodyFlags` has `PhysicsBodyFlags.Captured` set. |
| `HasAdoptedState` | True once `TryAdoptInitialState` has placed a proxy body onto the first received state. |

Use `HasReceivedState` to tell whether real state has arrived. Do not check the rotation: an unset rotation reads as identity, which looks the same as a captured identity rotation.

## Capture, rebuild and adopt the body

```csharp
public void CaptureBody(IPhysicsBody physicsBody, uint tick = Managers.NetworkLoop.NetworkLoopManager.UnsetTick)
```

The controlling peer (the server, unless a client controls the body) calls this once per tick, before the tick's state is sent. It writes the body's state into the replicated members. A resting body sends no updates.

```csharp
public PhysicsSnapshot BuildSnapshot()
```

Proxies call this to rebuild the latest server snapshot. A sleeping body, or one that has just appeared, has zero velocity in the snapshot.

```csharp
public bool TryAdoptInitialState(IPhysicsBody physicsBody)
```

Places the body directly onto the first received state, once, so a newly spawned proxy starts at its real position instead of gliding there from the prefab pose. Call it each proxy step before convergence, and skip convergence on the step it returns `true`. It returns `false` until `HasReceivedState` is true, and after `HasAdoptedState` is true.

## PhysicsSnapshot carries one body state

Remote state, local body state and projected targets all use this type.

| Field | Type | Meaning |
|---|---|---|
| `WorldPosition` | `Vector3` | The world-space position of the body. |
| `WorldRotation` | `Quaternion` | The world-space rotation of the body. |
| `LinearVelocity` | `Vector3` | The linear velocity of the body. |
| `AngularVelocity` | `Vector3` | The angular velocity of the body, as an axis scaled by radians per second. |
| `IsSleeping` | `bool` | True when the body is sleeping; a sleeping snapshot projects to itself. |
