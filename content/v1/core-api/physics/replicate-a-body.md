---
title: "Replicate a physics body"
---

> **Using Unity?** See [Replicate a rigidbody](../../unity/physics/replicate-a-rigidbody).

`NetworkPhysicsComponent` replicates a simulated body's position and rotation through the normal member pipeline. The authority captures its body into the component after it steps; every other peer rebuilds a snapshot from the component and steps a convergence follower toward it before it steps. Neither side needs an engine object — this page uses nothing but plain C# and `IPhysicsBody`.

## Getting the component

Add `NetworkPhysicsComponent` to a system the same way you add any other component, by renting it:

```csharp
NetworkSystem networkSystem = NetworkSystemPool.Rent<NetworkSystem, NetworkPhysicsComponent>(coreManager, canStartSystem: true)!;
networkSystem.TryGetComponent(out NetworkPhysicsComponent physicsComponent);
```

A wire-spawned system that arrives on a receiving peer has no GameObject or other engine object to hang a reference off, so there is nothing to look up by name or tag. Declare a standing watch instead, and the pool hands you the component when a matching system arrives:

```csharp
NetworkSystemPool.Watch<NetworkSystem, NetworkPhysicsComponent>(
    coreManager,
    networkSystemAcquiredHandler: system =>
    {
        system.TryGetComponent(out NetworkPhysicsComponent physicsComponent);
        // physicsComponent is fully initialized here.
    });
```

The watch matches on composition — any `NetworkSystem` carrying a `NetworkPhysicsComponent` — not on an identifier learned in advance.

## The authority half: capture

After your own world step, call `CaptureBody`:

```csharp
physicsComponent.CaptureBody(physicsBody, tick: currentTick);
```

This reads `Position`, `Rotation`, and the sleeping/kinematic flags off `physicsBody` into the component's replicated members. The `tick` argument is stamped onto `CaptureTick` only when the capture actually changed something a receiver could observe — a resting body stays wire-quiet — and it is what lets a receiver anchor a snapshot to its exact age instead of estimating it. Omit it and no attribution is carried.

## The follower half: converge

On every other peer, before your world step, rebuild the latest snapshot and hand it to a `PhysicsConvergence`:

```csharp
PhysicsSnapshot snapshot = physicsComponent.BuildSnapshot();
float ticksToProject = currentTick - physicsComponent.CaptureTick.Value;

convergence.Step(physicsBody, in snapshot, tickDelta, ticksToProject);
```

`BuildSnapshot` rebuilds position and rotation straight from the replicated members; linear and angular velocity are derived from the change between the last two committed ticks, so they never ride the wire themselves. `Step` projects that snapshot forward by `ticksToProject` ticks and steers `physicsBody` toward it — riding its projected velocity, teleporting on a large divergence, blending a smaller one back in. `Step` does nothing to a kinematic body.

## Where each half runs in the loop

Both halves are ordinary `INetworkLoopStepCallback` subscribers, split across the two fixed-update steps that bracket your world step:

```csharp
public class PhysicsDriver : INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.EarlyFixedUpdate | NetworkLoopSteps.LateFixedUpdate;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
    {
        if (networkLoopStep is NetworkLoopSteps.EarlyFixedUpdate)
        {
            // Follower: converge before the world steps, so the step integrates the corrected velocity.
            if (!isAuthority)
            {
                PhysicsSnapshot snapshot = physicsComponent.BuildSnapshot();
                float ticksToProject = currentTick - physicsComponent.CaptureTick.Value;
                convergence.Step(physicsBody, in snapshot, tickDelta, ticksToProject);
            }

            WorldStep(); // your simulation
        }
        else if (networkLoopStep is NetworkLoopSteps.LateFixedUpdate)
        {
            // Authority: capture after the world has stepped, so the capture describes this tick's result.
            if (isAuthority)
                physicsComponent.CaptureBody(physicsBody, tick: currentTick);
        }
    }
}
```

`EarlyFixedUpdate` is before the world step; `LateFixedUpdate` is after it. A follower converges on the early side so the step it is about to take integrates the corrected velocity; the authority captures on the late side so what goes out describes the tick that just ran.

## Priming a freshly observed body

A proxy that has just started watching a system has no local trajectory worth preserving — it sits at whatever pose it was constructed with, and converging from there would visibly glide it toward the real position. Call `TryAdoptInitialState` each follower step before `Step`, and skip the convergence on the step it succeeds:

```csharp
if (!physicsComponent.TryAdoptInitialState(physicsBody))
{
    PhysicsSnapshot snapshot = physicsComponent.BuildSnapshot();
    float ticksToProject = currentTick - physicsComponent.CaptureTick.Value;
    convergence.Step(physicsBody, in snapshot, tickDelta, ticksToProject);
}
```

`TryAdoptInitialState` only does anything once: it returns `false`, and does nothing, until `HasReceivedState` first turns true (the component has captured at least once) and it has not already adopted (`HasAdoptedState`). After that first successful call every later step falls through to ordinary convergence.

## A runnable sketch

`Nucleus.Tests/Physics/FakePhysicsBody.cs` is a minimal, engine-free `IPhysicsBody`: plain fields for position, rotation, and velocity, with an `Integrate` method standing in for a real simulation step. It is exactly what the snippets above are written against, and `Nucleus.Tests/Physics/NetworkPhysicsComponentTests.cs` exercises the whole round trip — capture, `BuildSnapshot`, tick attribution, and `TryAdoptInitialState` — against real rented systems, with no Unity dependency anywhere.

For adapting a real physics engine's body to `IPhysicsBody`, see the Unity integration's rigidbody page linked above.
