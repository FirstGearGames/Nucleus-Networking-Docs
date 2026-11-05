---
title: "Replicating a value from a Unity script"
---

> **Driving the core API directly?** See [Your first networked component](../../core-api/state/your-first-networked-component.md).

## Declare the component

A networked component is a plain `partial` class, not a `MonoBehaviour`. Declare its values as `NetworkMember<T0>` fields; the source generator writes the rest, so never hand-write serialization.

```csharp
public partial class HillTimerComponent : NetworkComponent
{
    public readonly NetworkMember<float> SecondsRemaining = new();
}
```

## Attach it with NucleusBehaviour

A `MonoBehaviour` adopts the component by inheriting `NucleusBehaviour<TComponent0>`:

```csharp
public class HillTimer : NucleusBehaviour<HillTimerComponent>
{
}
```

The GameObject needs a `NetworkSystemObject`. Several `NucleusBehaviour` scripts on one GameObject, each with a different component, share that one `NetworkSystemObject` and link their systems into one `NetworkSystemGroup`.

## Use Component only once the system links

`Component` is null until the system links, so writing to it from `Awake` throws a `NullReferenceException`. Use it from the hooks raised once a system is linked: `OnSystemLinked`, `OnServerStarted` and `OnClientStarted`, and their counterparts `OnSystemUnlinked`, `OnServerStopped` and `OnClientStopped`.

- `OnSystemLinked` fires once, when the system arrives, on every peer.
- `OnServerStarted` and `OnClientStarted` fire once each when that role comes up while a system is linked, immediately if the role was already up.

Because every peer links the system, check the role before a server-only write:

```csharp
protected override void OnSystemLinked()
{
    if (!IsController(ControllerType.Server))
        return;

    Component.SecondsRemaining.Value = _survivalSeconds;
}
```

Reading a replicated value needs no guard: once linked, every peer's `Component` holds the latest value.

## Guard writes with IsController

`IsController(ControllerType)` reports whether this peer controls the linked system, and `IsStarted(Invoker)` whether `Invoker.Server` or `Invoker.Client` is up. Both return false while no system is linked, so they are safe to call anywhere.

Input handlers, RPC sends and per-tick writes run on peers that do not control the object as a matter of course, so use these quiet forms there:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    if (!IsController(ControllerType.Server))
        return;

    Component.SecondsRemaining.Value = Mathf.Max(Component.SecondsRemaining.Value - _secondsPerTick, 0f);
}
```

Use `EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` only where reaching the code without that control or role is a bug, such as a server-only method called only by other server code. They return the same answer but also log a warning naming the calling member, once per calling member on each behaviour.

For previous-value access, interpolation and the constructor options that control how a member replicates, see [NetworkMember](../../core-api/state/network-member.md).
