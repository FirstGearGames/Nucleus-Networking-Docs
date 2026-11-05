---
title: "Control in a Unity script"
---

> **Driving the core API directly?** See [Reading who controls a system](../../core-api/control/controlling-a-system.md).

A `NucleusBehaviour` runs on every peer that has the object, not just the controller. Check control before doing anything only the controller should do.

## Check control with IsController

Inherit `NucleusBehaviour<TComponent0>`, or the non-generic `NucleusBehaviour` when another component, such as a `NetworkTransform`, declares the system and you only need the checks. Then call `IsController(ControllerType)`:

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

| `ControllerType` | True when |
|---|---|
| `Server` | This peer is the server and no client controls the system. |
| `Client` | This peer is the client that controls the system. |
| `AnyController` | This peer is the controller either way. It combines `Server` and `Client`. |

`IsController` returns false while no system is linked, so it is safe to call anytime.

## Use the loud guards only for programming errors

`EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` return the same answer as `IsController` and `IsStarted`, but log a warning naming the calling member when it is false, once per calling member on each behaviour.

- Use `IsController` and `IsStarted` where a false answer is normal: input handling, RPC sends and per-frame or per-tick hooks all run on peers that do not control the object.
- Use the `Ensure` forms only where reaching the code without that control or role is a bug, such as a server-only method called only by other server code.

## Check roles with IsStarted, not control

`IsStarted(Invoker)` reports whether this peer's server or client role is running. `Invoker` has only `Server` and `Client`; check a host with `IsHostStarted`.

A role is not control. On a host, `IsStarted(Invoker.Server)` is true for every object, including ones a client controls. Use `IsController` to ask whether this peer controls the object, and `IsStarted` or `IsHostStarted` for setup that depends only on the role.

## React to control changing

Override `OnControllerChanged`. It fires on every peer when control of the linked system moves:

```csharp
protected override void OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)
{
    // previousControllerConnection and currentControllerConnection are null for the server
}
```

It does not fire when a system links, even if this peer is already the controller. Read `IsController` in `OnSystemLinked` for the starting state.

## Read NetworkSystem only while linked

`NetworkSystem` is null before the system links and after it unlinks. It is set when `OnSystemLinked` runs and still readable during `OnSystemUnlinked`. Reading it from `Awake` or an inspector callback reads it before the link.
