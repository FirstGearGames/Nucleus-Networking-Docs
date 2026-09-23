---
title: "Violations"
---

> **Using Unity?** See [Handling violations in Unity](../../unity/diagnostics/handling-violations-in-unity.md)

## What a violation is

A violation is a rejected protocol fault from a peer: writing state it doesn't control, sending a malformed delta, acknowledging a tick it was never sent, answering a report it wasn't awaiting, and similar. The offending operation is always rejected, regardless of what you decide to do about the Connection. `ViolationManager` only controls the consequence for the peer, not whether the bad data gets applied.

By default the framework logs a warning and moves on. If you want misbehaving clients kicked, or you want to feed violations into your own audit system, you register with `ViolationManager`.

## The pipeline

A raised violation passes through the same four stages, in order, every time:

1. **The deciding handler** for that violation type, if one is registered, settles the `ViolationAction`.
2. **Global observers** (`IViolationObserver`) are told the settled action, for every violation type.
3. **Per-type subscribers** for that one type are told the settled action.
4. **Enforcement** applies the settled action against the offending `Connection`.

Only the deciding handler can change the outcome. Observers and per-type subscribers receive the context by read-only reference after the action is already settled — they can log, alert, or count, but they cannot influence what happens.

## Deciding the action

Register at most one deciding handler per violation type through `ViolationManager.RegisterViolationHandler<T0>(ViolationHandler<T0> violationHandler)`. Registering a second handler for the same type replaces the first. Remove it with `UnregisterViolationHandler<T0>()`, which takes no argument — it always targets the one handler for `T0`.

```csharp
coreManager.ViolationManager.RegisterViolationHandler<UncontrolledStateChangeViolation>(context =>
{
    // Inspect context.Connection and context.Violation, then decide.
    return ViolationAction.Kick;
});
```

The handler receives a `ViolationContext<T0>` and returns a `ViolationAction`:

- `Connection` — the offending Connection, read-only.
- `Violation` — the typed violation payload, read-only.
- `Action` — seeded with the framework default for this raise; the handler can read it back and return it unchanged to accept the default, or return something else to override it.

```csharp
public delegate ViolationAction ViolationHandler<T0>(ViolationContext<T0> violationContext)
    where T0 : struct, IViolation;
```

## The three actions

`ViolationAction` has three values:

- `Log` — logs a warning, Connection stays intact.
- `Ignore` — no log, no consequence, Connection stays intact.
- `Kick` — disconnects the Connection.

`ViolationManager.DefaultAction` is `Log`. Each violation type is raised with its own default, which overrides `DefaultAction` when no handler is registered for that type: most types default to `Ignore`, and the bundle- and scene-protocol faults (unsolicited bundle/scene reports, unexpected bundle/scene load requests) default to `Kick`. A registered handler can still return whatever action it wants regardless of that per-raise default.

## Watching without deciding

To audit every violation type without deciding any of them, implement `IViolationObserver` and register it with `ViolationManager.RegisterViolationObserver(IViolationObserver violationObserver)`:

```csharp
public sealed class ViolationAuditSink : IViolationObserver
{
    public void OnViolation<T0>(in ViolationContext<T0> violationContext) where T0 : struct, IViolation
    {
        // Log, count, alert — cannot change violationContext.Action.
    }
}
```

One registration hears every type, including types added later. Remove it with `UnregisterViolationObserver(IViolationObserver violationObserver)`.

To watch one type only, use `RegisterViolationDetectedHandler<T0>(ViolationDetectedHandler<T0> violationDetectedHandler)` or the matching per-type event (for example `UncontrolledStateChangeViolationDetected`) — both write the same subscription. A subscriber registered this way pays nothing for violation types it didn't ask about.

## Enforcement

`Kick` is enforced only on a peer that has started a server; a client that settles a violation on `Kick` against its own server Connection just logs it, since an impossible acknowledgment from its own server there is a tick-ordering hiccup, not abuse to punish. On a server, the kick is routed through `ServerManager.KickClient`, which purges what's queued to the offender, stops serving it state, and closes the link at the end of the frame — not a socket drop mid-tick.
