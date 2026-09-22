---
title: "Swept projection targets"
---

## The seam

`PhysicsConvergence.Step` computes where a proxy body should be this step by projecting the latest server snapshot forward. By default that projection is the closed-form `TrajectoryProjector`, which has no idea what geometry exists between the body's old position and its new one. Set `PhysicsConvergence.TargetProvider` to an `IProjectionTargetProvider` and the follower defers to it instead — `ComputeTarget` receives the body, the remote snapshot, the tick delta, the ticks to project, and the resolved `GravityProjection`, and hands back the `PhysicsSnapshot` to steer onto. The controller doesn't know or care how the target was produced.

```csharp
public interface IProjectionTargetProvider
{
    void ComputeTarget(IPhysicsBody physicsBody, in PhysicsSnapshot remotePhysicsSnapshot, float tickDelta,
        float ticksToProject, GravityProjection gravityProjection, out PhysicsSnapshot targetPhysicsSnapshot);
}
```

`TargetProvider` is left `null` by default in the core API — an ordinary proxy just rides the closed-form target. The Unity integration does not leave it null (see below).

## SweptTargetProvider

`SweptTargetProvider` wraps the closed-form target with a sweep against your collision world. It first projects the snapshot the ordinary way, then, if the resulting displacement clears `MinimumSweepDistance` (default `0.05f`), asks an `ISweepProvider` to sweep the body's shape from the old position to the projected one. If the sweep reports a blocking hit, the target clamps to the hit position instead of the original projected position — the target can never land past geometry the sweep found in the way.

```csharp
public sealed class SweptTargetProvider : IProjectionTargetProvider
{
    public float MinimumSweepDistance = 0.05f;
    public bool ReflectEnabled;
    public float Restitution = 0.6f;

    public SweptTargetProvider(ISweepProvider sweepProvider) { ... }
}
```

Three knobs control it:

- **MinimumSweepDistance** (`0.05f`) — projections shorter than this skip the sweep entirely; a short hop can't tunnel through anything worth querying for, so the cost is only paid when it might matter.
- **ReflectEnabled** — when on, the velocity at a clamped target reflects about the contact normal, scaled by `Restitution`. Off by default; the reflection is only accurate for simple bouncy shapes.
- **Restitution** (`0.6f`) — the bounciness applied by the reflect tier when it's enabled.

Install it on the follower:

```csharp
convergence.TargetProvider = new SweptTargetProvider(mySweepProvider);
```

`ISweepProvider` is the one capability it needs — an engine integration supplies `TrySweep`, sweeping the body's collision shape between two points against static geometry. In Unity that's `UnitySweepProvider`, built on `Rigidbody.SweepTest`.

## When it earns its cost

A sweep is an extra collision query every physics step the provider runs, so it isn't the default. It's worth turning on when a projected proxy can plausibly be pulled through something it should have bounced off: fast bodies whose per-tick displacement is large relative to nearby geometry, thin walls or floors that a coarse projection can straddle in one step, or any proxy that visibly tunnels through a surface during a fast pass. A slow body drifting across open space has nothing to gain from it.

## Writing your own provider

`SweptTargetProvider` assumes the swept-and-clamped model: stop at the first contact, optionally bounce. That's not always right — you might want a stepped re-integration, a provider that ignores certain layers, or something with no relation to sweeping at all. Implement `IProjectionTargetProvider` directly for that. The one rule that must hold regardless of what the provider does internally: it has to produce a `PhysicsSnapshot` the follower can steer onto — a valid position, rotation, and the linear/angular velocity `PhysicsConvergence.Step` will assign straight onto the body. Anything else about how that snapshot is derived is the provider's own business.

## Unity always wires it up

`ProjectedRigidbody.BindSystem` installs `SweptTargetProvider(UnitySweepProvider.Shared)` on every body it binds, unconditionally. A gravity projection on a proxy with no sweep target would otherwise carry it straight through the floor between ticks; the Unity integration doesn't leave that as an opt-in. Leaving `TargetProvider` null is the ordinary case only for the core API used outside the Unity integration — a Unity project always has a swept provider installed underneath it.
