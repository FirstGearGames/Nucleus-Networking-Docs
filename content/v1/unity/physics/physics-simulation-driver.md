---
title: "PhysicsSimulationDriver"
---

## PhysicsSimulationDriver steps one scene's physics on the network tick

A scene with a `PhysicsSimulationDriver` steps its bodies on `NetworkLoopSteps.EarlyFixedUpdate` and its physics world on `NetworkLoopSteps.LateFixedUpdate`, instead of on Unity's `FixedUpdate`. You rarely add one: under the default execution mode Nucleus adds a driver for the default physics world, and a local-physics scene gets its own when it loads.

- Each scene is stepped by exactly one driver.
- Scenes that share a physics world (every scene not loaded with a local physics world) are stepped once per tick between them, however many drivers point at that world.
- A driver needs a `UnityCoreManager` in the scene. See [Physics troubleshooting](./physics-troubleshooting.md) for the error when it has none.

## Subscribe to the driver's events

| Event | Signature | Fires |
|---|---|---|
| `WorldStepStarted` | `WorldStepStartedHandler(uint tick, float stepDelta)` | Before each world step. Apply per-step forces from client state here. |
| `BodyRegistered` | `BodyRegisteredHandler(NetworkRigidbody networkRigidbody)` | When a body joins the driver's step set. |
| `BodyDeregistered` | `BodyDeregisteredHandler(NetworkRigidbody networkRigidbody)` | When a body leaves the driver's step set. |

```csharp
driver.WorldStepStarted += (tick, stepDelta) =>
{
    // Apply per-step forces from client state here.
};
```

To follow the live body set, subscribe to `BodyRegistered` and `BodyDeregistered`, then read `Bodies` to pick up the bodies already present; otherwise you miss every body registered before you subscribed.

## Read the driver's state

- `CurrentTick` (`uint`): the tick being simulated.
- `SubtickFraction` (`float`): how far the render frame has progressed through the current tick, for placing smoothed visuals between the last two stepped poses.
- `Bodies` (`IReadOnlyList<NetworkRigidbody>`): the bodies this driver steps, in registration order.
- `TryGetSnapshotLocalTick(uint captureTick, out uint snapshotLocalTick)`: maps a received capture tick into local ticks. Returns `false` when the capture tick carried no attribution or nothing mapped.

## Find the driver for a scene

`ForScene(Scene scene)` returns the driver stepping a scene's physics, or `null` when nothing steps it and the scene runs on Unity's own physics timing. Call it once and keep the result rather than calling it every frame; a later deregistration then reaches the same driver.

```csharp
PhysicsSimulationDriver driver = PhysicsSimulationDriver.ForScene(gameObject.scene);
```

When the driver may not exist yet, for example because it is added at runtime, use `RegisterForScene` and `UnregisterForScene`. The callback fires at once if a driver already steps the scene.

```csharp
PhysicsSimulationDriver.RegisterForScene(gameObject.scene, OnDriverReady);

void OnDriverReady(PhysicsSimulationDriver driver) { /* ... */ }

// later
PhysicsSimulationDriver.UnregisterForScene(gameObject.scene, OnDriverReady);
```

The callback type is `DriverReadyHandler(PhysicsSimulationDriver physicsSimulationDriver)`.

## Register and deregister bodies

`Register(NetworkRigidbody networkRigidbody)` and `Deregister(NetworkRigidbody networkRigidbody)` add a body to the step set and remove it. Calling `Register` twice for one body is harmless.
