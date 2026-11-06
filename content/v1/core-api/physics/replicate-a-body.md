---
title: "Replicate a physics body"
---

> **Using Unity?** See [Replicate a rigidbody](../../unity/physics/replicate-a-rigidbody.md).

The server captures its body into a `NetworkPhysicsComponent` after each world step. Every other peer rebuilds a snapshot from the component and steps a `PhysicsConvergence` toward it before its world step. Everything here is plain C# against `IPhysicsBody`; see [Adapting your engine](./adapting-your-engine.md) to wrap a real engine's body.

## Get the component

On the server, rent a system with the component:

```csharp
if (!NetworkSystemPool.TryRent<NetworkSystem, NetworkPhysicsComponent>(coreManager, out NetworkSystem? networkSystem, canStartSystem: true))
    return;

networkSystem.TryGetComponent(out NetworkPhysicsComponent physicsComponent);
```

On a receiving peer, the system arrives over the network with nothing to look up by name. Declare a watch, and the pool hands you every system that carries a `NetworkPhysicsComponent` when it arrives:

```csharp
NetworkSystemPool.Watch<NetworkSystem, NetworkPhysicsComponent>(
    coreManager,
    networkSystemAcquiredHandler: system =>
    {
        system.TryGetComponent(out NetworkPhysicsComponent physicsComponent);
        // physicsComponent is fully initialized here.
    });
```

## Capture on the server after the world step

```csharp
physicsComponent.CaptureBody(physicsBody, tick: currentTick);
```

This reads `Position`, `Rotation` and the sleeping and kinematic flags off `physicsBody`. Pass `tick` so receivers know the snapshot's exact age; without it, no capture tick is recorded.

## Converge on every other peer before the world step

```csharp
PhysicsSnapshot snapshot = physicsComponent.BuildSnapshot();
float ticksToProject = GetTicksToProject(physicsComponent);

convergence.Step(physicsBody, in snapshot, tickDelta, ticksToProject);
```

`ticksToProject` is the snapshot's age in ticks. Peers do not share a tick counter, so do not subtract `CaptureTick` from this peer's tick. Measure the age in the server's numbering with `Connection.TryGetServerTickEstimate` on the connection to the server:

```csharp
private const float FallbackTicksToProject = 2f;

private float GetTicksToProject(NetworkPhysicsComponent physicsComponent)
{
    uint captureTick = (uint)physicsComponent.CaptureTick.Value;

    if (captureTick != NetworkLoopManager.UnsetTick
        && coreManager.TransportManager.TryGetServerConnection(out Connection serverConnection)
        && serverConnection.TryGetServerTickEstimate(coreManager.NetworkLoopManager.Tick, out uint serverTick)
        && serverTick > captureTick)
        return serverTick - captureTick;

    // No attributed capture or no estimate yet: project a short fixed distance.
    return FallbackTicksToProject;
}
```

This measures the age of a body the server captures, which is the setup on this page.

## Adopt the first received state

A newly observed proxy sits at the pose it was created with, and converging from there would glide it visibly. Call `TryAdoptInitialState` before `Step` on every follower step, and skip `Step` when it returns `true`. It succeeds only once, after the first capture arrives.

## Run both halves in the network loop

Subscribe to `EarlyFixedUpdate`, which runs before your world step, and `LateFixedUpdate`, which runs after it:

```csharp
public class PhysicsDriver : INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.EarlyFixedUpdate | NetworkLoopSteps.LateFixedUpdate;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
    {
        if (networkLoopStep is NetworkLoopSteps.EarlyFixedUpdate)
        {
            // Follower: converge before the world steps, so the step integrates the corrected velocity.
            if (!isAuthority && !physicsComponent.TryAdoptInitialState(physicsBody))
            {
                PhysicsSnapshot snapshot = physicsComponent.BuildSnapshot();
                float ticksToProject = GetTicksToProject(physicsComponent);
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
