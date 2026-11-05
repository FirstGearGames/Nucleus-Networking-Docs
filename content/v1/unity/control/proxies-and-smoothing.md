---
title: "Objects this peer does not control"
---

Most objects run on peers that do not control them: every client watching another player's character, and the server while a client controls an object. Every `NucleusBehaviour` hook, `OnControllerChanged` included, still runs on these peers every tick. Control only changes what your code inside the hook should do.

## Skip controller-only work with IsController

```csharp
protected override void OnEarlySerialize(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    // Set gameplay members here.
}
```

Nothing stops a hook running on a non-controlling peer, so a script that does not check writes anyway, against members it does not own. See [Control in a Unity script](./control-in-unity-scripts.md) for `IsController`, `EnsureIsController` and `IsStarted`.

## Do not move a proxy locally

With a `NetworkTransform`, a non-controlling peer follows the controller's position, rotation and, if enabled, scale, interpolating on `VariableUpdate`. Velocity is never sent. Anything that moves a proxy locally, such as a collision, a force or a script setting `transform.position`, is overwritten or fought on the next tick it receives.

- **Kinematic Management Enabled** (default on) holds an attached `Rigidbody` kinematic on every non-controlling peer, including the server while a client controls the object, so physics cannot push back against the pose. Turn it off only when other code owns the body's kinematic state.
- **Interpolate Scale Enabled** (default on) interpolates scale too. Off, the local scale keeps its current value.

See [NetworkTransform](../state/network-transform.md) for its other fields.

## Raise State Interpolation for smoothness against jitter

**State Interpolation** on `UnitySystemManager` (`NucleusSystemManager.StateInterpolation`) is how many ticks received state waits before it is applied. The buffer lets a proxy interpolate between two real values instead of snapping to each one. It defaults to 1, the smallest the inspector allows. Raising it trades latency for smoothness against jitter and loss.

Within a tick, interpolation sweeps by `NetworkLoopManager.SubtickPercentage`, which updates every frame before `VariableUpdate`. To jump across a large discontinuity instead of sweeping, set a member's interpolation snap threshold; see [NetworkMember](../../core-api/state/network-member.md).
