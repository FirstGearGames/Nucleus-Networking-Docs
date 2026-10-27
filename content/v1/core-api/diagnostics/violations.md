---
title: "Violations"
---

> **Using Unity?** See [Handling violations in Unity](../../unity/diagnostics/handling-violations-in-unity.md)

## What a violation is

A violation is a rejected protocol fault from a peer: setting members of a system it doesn't control, sending a malformed delta, acknowledging a tick it was never sent, answering a report it wasn't awaiting, and similar. The offending operation is always rejected, regardless of what you decide to do about the Connection. `ViolationManager` only controls the consequence for the peer, not whether the bad data gets applied.

By default almost every violation is silent. Most types are raised with `Ignore`, so the fault is rejected and nothing is logged; the scene-protocol faults (and, in Pro, the bundle-protocol faults) kick the offender. Logging is separate from the action: a violation raised with the framework default still logs a warning ("The offending operation was rejected."), and any raise site or handler can set `context.Log` to log something of its own regardless of the action chosen. To see violations at all, register an `IViolationObserver`. If you want misbehaving clients kicked, or you want to feed violations into your own audit system, you register with `ViolationManager`.

## Every violation passes through the same four stages

A raised violation passes through the same four stages, in order, every time:

1. **The deciding handler** for that violation type, if one is registered, settles the `ViolationAction`.
2. **Global observers** (`IViolationObserver`) are told the settled action, for every violation type.
3. **Per-type subscribers** for that one type are told the settled action.
4. **Enforcement** applies the settled action against the offending `Connection`.

Only the deciding handler can change the outcome. Observers and per-type subscribers receive the context by read-only reference after the action is already settled — they can log, alert, or count, but they cannot influence what happens.

A throwing stage does not break the pipeline. If the deciding handler throws, the violation falls back to its default action and log line, as though no handler were registered. If an observer throws, the observers after it are still told, and if a per-type subscriber throws, enforcement still happens. Each failure is logged as an error with the exception attached, so a bug in your handler shows up in the log, while a client that tripped a violation is still kicked rather than escaping because your code threw.

## Deciding the action

Register at most one deciding handler per violation type through `ViolationManager.RegisterViolationHandler<T0>(ViolationHandler<T0> violationHandler)`. Registering a second handler for the same type replaces the first. Remove it with `TryUnregisterViolationHandler<T0>()`, which takes no argument — it always targets the one handler for `T0`.

```csharp
coreManager.ViolationManager.RegisterViolationHandler<UnauthorizedMemberChangeViolation>((ref ViolationContext<UnauthorizedMemberChangeViolation> context) =>
{
    context.Log = LogEntry.Error("Wrote state it does not control.");
    return ViolationAction.Kick;
});
```

The handler receives a `ViolationContext<T0>` and returns a `ViolationAction`:

- `Connection` — the offending Connection, read-only.
- `Violation` — the typed violation payload, read-only.
- `Action` — seeded with the framework default for this raise; the handler can read it back and return it unchanged to accept the default, or return something else to override it.
- `Log`: seeded by the raise site, if it set one; the handler can leave it, replace it with its own `LogEntry`, or clear it with `context.Log = default` to silence it.

```csharp
public delegate ViolationAction ViolationHandler<T0>(ref ViolationContext<T0> violationContext)
    where T0 : struct, IViolation;
```

## The two actions

`ViolationAction` has two values:

- `Ignore`: no consequence, Connection stays intact.
- `Kick`: disconnects the Connection.

`ViolationManager.DefaultAction` is `Ignore`. Each violation type is raised with its own default, which overrides `DefaultAction` when no handler is registered for that type: most types default to `Ignore`, and the bundle- and scene-protocol faults (unsolicited bundle/scene reports, unexpected bundle/scene load requests) default to `Kick`. A registered handler can still return whatever action it wants regardless of that per-raise default.

Logging no longer rides on the action. A violation raised through `ViolationManager.DefaultAction` (the framework default) is logged as a warning with the message "The offending operation was rejected."; a violation raised with its own explicit default logs only if the raise site or the deciding handler set a `LogEntry` on `context.Log`. When `Log` is set, the framework logs it as `Violation [<TypeName>] from Connection [<connection>]: <message>` at the level the `LogEntry` carries.

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

One registration hears every type, including types added later. Remove it with `TryUnregisterViolationObserver(IViolationObserver violationObserver)`.

To watch one type only, use `RegisterViolationDetectedHandler<T0>(ViolationDetectedHandler<T0> violationDetectedHandler)` or the matching per-type event (for example `UnauthorizedMemberChangeViolationDetected`) — both write the same subscription. A subscriber registered this way pays nothing for violation types it didn't ask about.

## Only a peer running a server enforces a kick

`Kick` is enforced only on a peer that has started a server; a client that settles a violation on `Kick` against its own server Connection just logs it, since an impossible acknowledgment from its own server there is a tick-ordering hiccup, not abuse to punish. On a server, the kick is routed through `ServerManager.KickClient`, which purges what's queued to the offender, stops serving it state, and closes the link at the end of the frame — not a socket drop mid-tick.
