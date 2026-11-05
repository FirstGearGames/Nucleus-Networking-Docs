---
title: "Violations"
---

> **Using Unity?** See [Handling violations in Unity](../../unity/diagnostics/handling-violations-in-unity.md)

A violation is a protocol fault from a peer, such as setting members of a system it does not control, sending a malformed delta, or acknowledging a tick it was never sent. The offending operation is always rejected. `ViolationManager` only decides what happens to the `Connection` that sent it. The [Violation reference](./violation-reference.md) lists every type and its default.

## Most violations are silent by default

Most types are raised with `Ignore` and log nothing. A few, such as the scene-protocol faults, kick the offender. To see violations, register an `IViolationObserver`. To kick misbehaving clients, or to feed violations into your own audit system, register with `ViolationManager`.

## Every violation passes through the same four stages

1. **The deciding handler** for that type, if one is registered, settles the `ViolationAction`.
2. **Global observers** (`IViolationObserver`) are told the settled action.
3. **Per-type subscribers** for that type are told the settled action.
4. **Enforcement** applies the action against the offending `Connection`.

Only the deciding handler can change the outcome. Observers and subscribers receive the context by read-only reference after the action is settled.

If the deciding handler throws, the violation falls back to its default action and log line. If an observer or subscriber throws, the rest still run and enforcement still happens. Each exception is logged as an error, so a client is still kicked when your code throws.

## Decide the action with a handler

Register one deciding handler per type with `ViolationManager.RegisterViolationHandler<T0>(ViolationHandler<T0> violationHandler)`. Registering a second handler for the same type replaces the first. `TryUnregisterViolationHandler<T0>()` removes it.

```csharp
coreManager.ViolationManager.RegisterViolationHandler<UnauthorizedMemberChangeViolation>((ref ViolationContext<UnauthorizedMemberChangeViolation> context) =>
{
    context.Log = LogEntry.Error("Wrote state it does not control.");
    return ViolationAction.Kick;
});
```

```csharp
public delegate ViolationAction ViolationHandler<T0>(ref ViolationContext<T0> violationContext)
    where T0 : struct, IViolation;
```

The handler receives a `ViolationContext<T0>`:

- `Connection`: the offending Connection, read-only.
- `Violation`: the typed violation payload, read-only.
- `Action`: seeded with the default for this raise. Return it unchanged to accept the default.
- `Log`: seeded by the raise site, if it set one. Leave it, replace it with your own `LogEntry`, or clear it with `context.Log = default`.

## Each type has its own default action

`ViolationAction` has two values:

- `Ignore`: no consequence. The Connection stays.
- `Kick`: disconnects the Connection.

`ViolationManager.DefaultAction` is `Ignore`. Each type is raised with its own default, which applies when no handler is registered. A registered handler can return either action.

## Logging is set separately from the action

A violation raised with `ViolationManager.DefaultAction` logs a warning, "The offending operation was rejected." A violation raised with its own default logs only if the raise site or the handler set `context.Log`. A set `Log` is written as `Violation [<TypeName>] from Connection [<connection>]: <message>` at the level the `LogEntry` carries.

## Watching without deciding

To audit every violation type without deciding any of them, implement `IViolationObserver` and register it with `ViolationManager.RegisterViolationObserver(IViolationObserver violationObserver)`. One registration hears every type. Remove it with `TryUnregisterViolationObserver(IViolationObserver violationObserver)`.

```csharp
public sealed class ViolationAuditSink : IViolationObserver
{
    public void OnViolation<T0>(in ViolationContext<T0> violationContext) where T0 : struct, IViolation
    {
        // Log, count or alert. Cannot change violationContext.Action.
    }
}
```

To watch one type only, use `RegisterViolationDetectedHandler<T0>(ViolationDetectedHandler<T0> violationDetectedHandler)` or the matching per-type event, such as `UnauthorizedMemberChangeViolationDetected`. Both make the same subscription, and it costs nothing for types you did not subscribe to.

## Only a peer running a server enforces a kick

`Kick` is enforced only on a peer that has started a server. A client that settles a violation on `Kick` against its own server Connection only logs it. On a server, the kick goes through `ServerManager.KickClient`, and the link closes at the end of the frame.
