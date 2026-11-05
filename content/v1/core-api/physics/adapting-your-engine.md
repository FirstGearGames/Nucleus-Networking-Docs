---
title: "Adapting your engine"
---

## Implement IPhysicsBody

`IPhysicsBody` is everything the core reads from and writes to a body. Your adapter is also where your engine's vector and quaternion types convert to and from `System.Numerics` `Vector3` and `Quaternion`. Every member is required except the two default methods.

| Member | Type | Contract |
| --- | --- | --- |
| `Position` | `Vector3` (get/set) | World-space position. |
| `Rotation` | `Quaternion` (get/set) | World-space rotation. |
| `LinearVelocity` | `Vector3` (get/set) | Linear velocity. |
| `AngularVelocity` | `Vector3` (get/set) | Angular velocity, as an axis scaled by radians per second. |
| `IsSleeping` | `bool` (get/set) | Whether the body is sleeping; setting `true` puts it to sleep, `false` wakes it. |
| `IsKinematic` | `bool` (get) | True when the body is kinematic and does not respond to forces. `PhysicsConvergence.Step` skips a kinematic body. |
| `Gravity` | `Vector3` (get) | The gravitational acceleration actually acting on this body. |
| `Drag` | `float` (get) | The body's linear drag factor. |
| `Mass` | `float` (get) | The body's mass. |
| `AddForce(Vector3 force)` | method | Applies a continuous force to the body's center of mass for the current physics step. |

Two getters cause real bugs if they are wrong:

- **`Gravity`** must return `Vector3.Zero` when the body has gravity disabled, not the world's gravity. Projection uses exactly this value, so returning world gravity makes a gravity-disabled body fall under projection while the engine holds it still.
- **`Drag`** must be your engine's own linear damping value, unconverted.

`CaptureSnapshot` and `ApplySnapshot` have default implementations built from the properties above. Override `ApplySnapshot` only if your engine needs extra bookkeeping when `Position`, `Rotation`, `LinearVelocity` and `AngularVelocity` are written.

The smallest working adapter is plain fields behind the interface, with the default snapshot methods and no sweep provider.

## Implement ISweepProvider for swept targets

This is optional. Implement it only if your engine can sweep a shape along a segment against static geometry:

```csharp
bool TrySweep(IPhysicsBody physicsBody, Vector3 fromPosition, Vector3 toPosition, out SweepHit sweepHit);
```

Return `true` when the sweep hit blocking geometry, and fill `sweepHit` with:

- `Position`: the body-center position at which the sweep was blocked.
- `Normal`: the surface normal at the contact.
- `Fraction`: how far along the sweep the contact occurred, from zero to one.

Without an `ISweepProvider`, [swept projection targets](./swept-projection-targets.md) are unavailable and only the plain projection is used.

## Use Unity's adapters as a reference

`UnityPhysicsBody` wraps a `Rigidbody`: `Gravity` returns `Vector3.Zero` when `Rigidbody.useGravity` is off, `Drag` maps to `Rigidbody.linearDamping`, and velocity writes are skipped on a kinematic body. Unity's sweep adapter is `UnitySweepProvider.Shared`, a static instance you can reference directly.
