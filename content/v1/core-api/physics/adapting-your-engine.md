---
title: "Adapting your engine"
---

## IPhysicsBody

`IPhysicsBody` is the full surface the core reads from and writes to a body. Every member is required except the two default methods, which you may override.

| Member | Type | Contract |
| --- | --- | --- |
| `Position` | `Vector3` (get/set) | World-space position. |
| `Rotation` | `Quaternion` (get/set) | World-space rotation. |
| `LinearVelocity` | `Vector3` (get/set) | Linear velocity. |
| `AngularVelocity` | `Vector3` (get/set) | Angular velocity, as an axis scaled by radians per second. |
| `IsSleeping` | `bool` (get/set) | Reads whether the body is sleeping; setting `true` puts it to sleep, `false` wakes it. |
| `IsKinematic` | `bool` (get) | True when the body is kinematic and does not respond to forces. |
| `Gravity` | `Vector3` (get) | The gravitational acceleration actually acting on this body. |
| `Drag` | `float` (get) | The body's linear drag factor. |
| `Mass` | `float` (get) | The body's mass. |
| `AddForce(Vector3 force)` | method | Applies a continuous force to the body's center of mass for the current physics step. |

### Gravity and Drag

`Gravity` is not a global constant, it's what's actually acting on this specific body right now. If the body has gravity disabled, return `Vector3.Zero`, not the world's gravity vector. The trajectory projector integrates against exactly what this getter returns, so an adapter that always returns the world gravity will make a gravity-disabled body fall under projection while the engine holds it still.

`Drag` has to be in the same units the trajectory projector integrates against — whatever your engine's own linear damping field means, return it unconverted.

### IsKinematic

`IsKinematic` is the follower's short-circuit. A kinematic body doesn't respond to forces or velocity, so there's nothing for convergence to nudge — the follower checks this flag and skips its own correction work rather than fighting an engine that's going to ignore it anyway.

### Default snapshot methods

`IPhysicsBody` ships default implementations of `CaptureSnapshot` and `ApplySnapshot` built from the properties above; a plain adapter never needs to override them. Override `ApplySnapshot` only when your engine needs extra bookkeeping on a snapshot write beyond setting `Position`, `Rotation`, `LinearVelocity` and `AngularVelocity`.

## ISweepProvider

Optional. Implement it only if your engine can sweep a shape along a segment against static geometry:

```csharp
bool TrySweep(IPhysicsBody physicsBody, Vector3 fromPosition, Vector3 toPosition, out SweepHit sweepHit);
```

Return `true` when the sweep hit blocking geometry, and fill `sweepHit` with `Position` (the body-center position at which the sweep was blocked), `Normal` (the surface normal at the contact) and `Fraction` (how far along the sweep the contact occurred, between zero and one). With no `ISweepProvider` registered, swept projection features stay unavailable and Nucleus falls back to the closed-form projector alone.

## The numeric boundary

The core replicates entirely in `System.Numerics`. Your adapter is the only place engine types cross into that world, so it's also where you convert between your engine's vector/quaternion types and `Vector3`/`Quaternion`.

## A minimal worked adapter

`Nucleus.Tests.Physics.FakePhysicsBody` is the adapter the test suite runs against — plain fields behind the interface, relying on the interface's default snapshot methods and no sweep provider at all. It's the floor: five settable properties, four read-only ones and one method satisfy `IPhysicsBody`.

## Unity's adapters, as reference

`UnityPhysicsBody` (`Nucleus.Integrations.Unity/Physics/UnityPhysicsBody.cs`) wraps a `Rigidbody` and shows both contracts applied for real: `Gravity` returns `Vector3.Zero` when `Rigidbody.useGravity` is off, `Drag` maps to `Rigidbody.linearDamping`, and velocity writes are skipped on a kinematic body. Unity's sweep adapter is `UnitySweepProvider.Shared`, a static singleton you can reference directly.
