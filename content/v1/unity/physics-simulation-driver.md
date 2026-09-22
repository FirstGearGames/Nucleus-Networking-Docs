---
title: "PhysicsSimulationDriver"
---

## What it is

`PhysicsSimulationDriver` is a `MonoBehaviour` that ties one scene's physics to the network tick. A scene with a driver steps its bodies on `NetworkLoopSteps.EarlyFixedUpdate` and steps its physics world on `NetworkLoopSteps.LateFixedUpdate`, instead of on Unity's own `FixedUpdate` cadence. Received state deserializes earlier in the same frame and the tick's captures serialize later in it, so captures and transmissions share one clock instead of drifting against Unity's own physics timing.

A driver is per scene. It registers itself with `PhysicsSimulationCoordinator`, the process-wide object that owns the one network-loop registration, the simulation mode, and the peer's tick anchor. A scene is stepped by exactly one driver.

Scenes that share a physics world (every scene not loaded with a local physics world of its own) are stepped once between them. A driver per scene is not the same thing as a physics world per scene: multiple drivers can point at the same world, and the coordinator steps that world once per tick regardless of how many drivers resolve to it.

## Events

| Event | Signature | Fires |
|---|---|---|
| `WorldStepStarted` | `WorldStepStartedHandler(uint tick, float stepDelta)` | Before each world step. This is where gameplay applies per-step input forces on the simulated cadence, since Unity's own `FixedUpdate` no longer matches when the world actually steps. |
| `BodyRegistered` | `BodyRegisteredHandler(ProjectedRigidbody projectedRigidbody)` | When a body joins the driver's step set. |
| `BodyDeregistered` | `BodyDeregisteredHandler(ProjectedRigidbody projectedRigidbody)` | When a body leaves the driver's step set. |

```csharp
driver.WorldStepStarted += (tick, stepDelta) =>
{
    // Apply per-step input forces here.
};
```

`BodyRegistered`/`BodyDeregistered` exist so a diagnostic, editor tool, or convergence monitor can follow the live body set without walking the scene for it every frame. Subscribe and then read `Bodies` to adopt what already exists, otherwise anything attaching after the first spawn misses every body already present.

## Reads

- `CurrentTick` (`uint`) - the network loop tick currently being simulated.
- `SubtickFraction` (`float`) - how far the render frame has progressed through the current tick, for phasing smoothed visuals between the last two stepped poses.
- `Bodies` (`IReadOnlyList<ProjectedRigidbody>`) - the bodies this driver steps, in registration order. A diagnostic reads this instead of walking the scene.
- `TryGetSnapshotLocalTick(uint captureTick, out uint snapshotLocalTick)` - maps a received capture tick into local ticks, through the session's shared drift-adaptive anchor. Returns `false` when the capture tick carried no attribution or nothing mapped.

## Finding the driver for a scene

`ForScene(Scene scene)` resolves the driver stepping a given scene's physics, or `null` when nothing steps it (the object then runs Unity's own physics cadence). Resolve once and hold the result: this is a scene read plus a dictionary probe, not a field read, and it is also what lets a later deregistration reach the same driver.

```csharp
PhysicsSimulationDriver driver = PhysicsSimulationDriver.ForScene(gameObject.scene);
```

For a driver that may not exist yet - it can be added at runtime rather than authored into the scene, and component `Start` order between two objects is unspecified - use `RegisterForScene`/`UnregisterForScene` instead:

```csharp
PhysicsSimulationDriver.RegisterForScene(gameObject.scene, OnDriverReady);

void OnDriverReady(PhysicsSimulationDriver driver) { /* ... */ }

// later
PhysicsSimulationDriver.UnregisterForScene(gameObject.scene, OnDriverReady);
```

`DriverReadyHandler` is `void DriverReadyHandler(PhysicsSimulationDriver physicsSimulationDriver)`. If a driver already steps the scene, the callback fires immediately rather than waiting for a registration edge that already passed - a subscriber attaching after the driver registered would otherwise wait forever.

## Register / Deregister

`Register(ProjectedRigidbody projectedRigidbody)` and `Deregister(ProjectedRigidbody projectedRigidbody)` add and remove a body from the driver's step set. `Register` is idempotent.

Two drivers cannot claim the same scene. If a second driver enables on a scene a driver already steps, it logs an error naming both GameObjects and does nothing - the first driver keeps stepping the scene, the second driver's bodies are simply never registered to it.

## Track

Unity only. There is no plain-C# counterpart: physics stepping is a Unity concept.
