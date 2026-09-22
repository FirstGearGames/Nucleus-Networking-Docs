---
title: "Control in a Unity script"
---

> **Driving the core API directly?** See [Reading who controls a system](../../core-api/control/controlling-a-system).

A `NucleusBehaviour<TComponent0>` runs on every peer that has the object in scene, not just the one that controls it. A script that assumes it is the controller breaks the moment a client owns the object instead of the server, or the moment it runs on a peer that only observes. Every method below exists to make that distinction explicit instead of accidental.

## Checking control

Inherit `NucleusBehaviour<TComponent0>` (or `NucleusBehaviourBase` for a script that needs the role and control checks but not a typed component) and call `IsController(ControllerType)`:

```csharp
public class Health : NucleusBehaviour<HealthComponent>
{
    private void ApplyDamage(int amount)
    {
        if (!IsController(ControllerType.AnyController))
            return;

        Component.Health.Value -= amount;
    }
}
```

`ControllerType` is a flags enum: `ControllerType.Server` means the local peer is the server and no client controls the system, `ControllerType.Client` means the local peer is the client that controls it, and `ControllerType.AnyController` (`Server | Client`) means this peer is the controller either way. Use `Server` or `Client` alone when the logic only makes sense for one of those, and `AnyController` when it only cares that this peer is the one in charge.

`IsController` returns false while no system is linked, so it is always safe to call, including before `OnSystemLinked` has fired.

## The loud guards

`EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` answer the same question as `IsController` and `IsStarted`, but log a warning when the answer is false instead of letting the caller silently do nothing:

```csharp
private void RequestFire()
{
    if (!EnsureIsController(ControllerType.Client))
        return;

    // fire
}
```

The warning names the calling member and is logged on every failing call - it is not throttled, so a guard checked every frame floods the console the moment it fails. `RequestFire` above is a one-off call from an input handler, where a failure is worth logging loudly because it means something is actually wrong. Reach for the loud forms there; reach for the plain `IsController` / `IsStarted` in a per-frame or per-tick hook, where a non-controlling peer failing the check is the normal, expected path rather than a mistake.

## Reacting to control changing

Override `OnControllerChanged`:

```csharp
protected override void OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)
{
    // previousControllerConnection and currentControllerConnection are null for the server
}
```

This fires on every peer when control of the linked system moves. It does not fire when a system links: linking adopts whichever roles are already started rather than waiting for an edge, so a peer that is already the controller when the object appears in its scene never sees a "became controller" transition for that arrival. Read `IsController` in `OnSystemLinked` if the initial state matters, not `OnControllerChanged`.

## Role versus control

`IsStarted(Invoker)` reports whether this peer's server or client role is running, once a system is linked. `Invoker` only has `Server` and `Client` values — there is no host member, because a host is both roles running together rather than a third role. `IsHostStarted` covers that case directly.

A role check is not a peer check. A host runs every connected player's copy of the scene, so `IsStarted(Invoker.Server)` is true on the host for every object in the scene, not just the ones it controls. Use `IsController` to ask "does this peer control this object", and `IsStarted` / `IsHostStarted` to ask "is this role running here at all" — for example, gating server-only setup that has nothing to do with which client owns the object.

## Reading NetworkSystem safely

`NetworkSystem` is null before the system links and after it unlinks. `OnSystemLinked` and `OnSystemUnlinked` are the only places guaranteed to see it non-null and stable: `OnSystemLinked` runs right after `NetworkSystem` is set, and `OnSystemUnlinked` runs while it is still readable, just before it is cleared. Reading `NetworkSystem` from `Awake` or from an inspector-triggered callback is reading it before the link has happened.

```csharp
protected override void OnSystemLinked()
{
    // NetworkSystem is non-null here
}

protected override void OnSystemUnlinked()
{
    // NetworkSystem is still readable here, for the duration of this call
}
```

For the members `NetworkSystem` itself exposes, see the API reference.
