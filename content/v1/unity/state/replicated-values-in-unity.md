---
title: "Replicating a value from a Unity script"
---

> **Driving the core API directly?** See [Your first networked component](../../core-api/state/your-first-networked-component.md).

## Declare the component

A networked component is a plain class, not a `MonoBehaviour`. It never goes on a GameObject itself.

```csharp
public partial class HillTimerComponent : NetworkComponent
{
    public readonly NetworkMember<float> SecondsRemaining = new();
}
```

`partial` matters: the source generator fills in the rest of this class from the `NetworkMember<T0>` fields it finds, so `Read`, `Write`, `WriteDelta` and the rest are written for you. Add fields, don't hand-write serialization.

## Attach it through NucleusBehaviour

Since the component itself can't sit on a GameObject, a `MonoBehaviour` adopts it by inheriting `NucleusBehaviour<TComponent0>`:

```csharp
public class HillTimer : NucleusBehaviour<HillTimerComponent>
{
}
```

`NucleusBehaviour<TComponent0>.Awake` calls `NetworkSystemObjectPool.RequireSystem` for you, asking for a system that carries a `HillTimerComponent`. Once that system links, the base class hands it back through the `Component` property. Before linking, `Component` is null.

## Where to read and write

`Component` is only safe to use from the lifecycle hooks `NucleusBehaviourBase` raises once a system is linked: `OnSystemLinked`, `OnServerStarted`, `OnClientStarted` (and their `OnServerStopped` / `OnClientStopped` / `OnSystemUnlinked` counterparts). A write attempted from `Awake`, or from any point before the system links, has nowhere to go — `Component` is still null, so it isn't a matter of the write being ignored, it's a `NullReferenceException` waiting to happen.

`OnSystemLinked` fires once, when the system arrives, whether that happens before, after, or exactly as this peer's own role starts. `OnServerStarted` and `OnClientStarted` fire once each, whenever that peer's role comes up while a system is linked — including immediately, if the role was already up at link time. A component that arms itself on `OnSystemLinked` for the server alone still needs a role check, because every peer's copy of the behaviour links the system, not just the server's:

```csharp
protected override void OnSystemLinked()
{
    if (!IsController(ControllerType.Server))
        return;

    Component.SecondsRemaining.Value = _survivalSeconds;
}
```

## Guarding writes

`IsController(ControllerType)` reports whether this peer controls the linked system; `IsStarted(Invoker)` reports whether a named role (`Invoker.Server` or `Invoker.Client`) is up, for a behaviour whose system has linked. Both answer false while no system is linked, so they're safe to call anywhere, unlike reading `Component` directly.

When a failed guard is a bug rather than an expected outcome, use the loud forms instead: `EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` return the same answer but also log a warning naming the calling member, once per calling member on each behaviour. Reach for the loud forms in one-off code that must never run on the wrong peer - a button handler, an RPC. A per-tick write like the one below runs on every peer every tick, and a non-controlling peer failing the check there is the normal, expected outcome, not a bug, so use the quiet form:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta)
{
    if (!IsController(ControllerType.Server))
        return;

    Component.SecondsRemaining.Value = Mathf.Max(Component.SecondsRemaining.Value - _secondsPerTick, 0f);
}
```

Reading a replicated value has no such guard: every peer's `Component` holds whatever the wire last delivered, and reading it is always safe once a system is linked.

## The GameObject side

`NucleusBehaviourBase` carries `[RequireComponent(typeof(NetworkSystemObject))]`, so any `NucleusBehaviour<TComponent0>` needs a `NetworkSystemObject` marker on the same GameObject. That marker is `[DisallowMultipleComponent]` — one per GameObject — but it isn't limited to hosting a single system. Several `NucleusBehaviour` scripts on the same GameObject, each requiring a different component, link their systems together into one `NetworkSystemGroup`, so one marker can host a group of systems rather than just one.

## Member surface

`NetworkMember<T0>` has more surface than a plain getter/setter — previous-value access, interpolation, constructor options for how it replicates. See the API reference for `NetworkMember<T0>`.
