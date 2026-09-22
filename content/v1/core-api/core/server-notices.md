---
title: "Server notices"
---

## What a server notice is

A server notice is a struct the authority raises about this client, delivered through a channel separate from ordinary message handlers. It exists because some things the server tells a client have to survive the disconnect they are explaining: an ordinary message handler is registered against a live connection, and by the time a refusal reaches the client, that connection is already going down. Notices are dispatched locally on the client and never travel the wire as their own packet type.

Every notice type implements `IServerNotice`, a marker interface with no members, and is a struct so dispatch never boxes it.

## Registering a handler

One deciding handler may be registered per notice type. It receives the notice and returns the `ServerNoticeAction` the engine should take.

```csharp
public void RegisterServerNoticeHandler<T0>(ServerNoticeHandler<T0> serverNoticeHandler) where T0 : struct, IServerNotice
public void UnregisterServerNoticeHandler<T0>() where T0 : struct, IServerNotice
```

`ServerNoticeHandler<T0>` is `delegate ServerNoticeAction ServerNoticeHandler<T0>(in ServerNoticeContext<T0> serverNoticeContext)`. Registering a second handler for the same `T0` replaces the first.

```csharp
clientManager.RegisterServerNoticeHandler<AuthenticationDeniedNotice>(static (in ServerNoticeContext<AuthenticationDeniedNotice> context) =>
{
    ShowDeniedReason(context.Notice.Reason);
    return ServerNoticeAction.Ignore;
});
```

## Observing notices

Any number of observers may also be registered. An observer is told about every raised notice, after the deciding handler has settled its action, but cannot change that action.

```csharp
public void RegisterServerNoticeObserver(IServerNoticeObserver serverNoticeObserver)
public void UnregisterServerNoticeObserver(IServerNoticeObserver serverNoticeObserver)
```

`IServerNoticeObserver` has one method:

```csharp
void OnServerNotice<T0>(in ServerNoticeContext<T0> serverNoticeContext) where T0 : struct, IServerNotice;
```

## ServerNoticeContext\<T0\>

Both the handler and every observer receive the same context, by `in` reference:

| Member | Type | Meaning |
|---|---|---|
| `Connection` | `Connection` | The connection the notice arrived from (the server). |
| `Notice` | `T0` | The typed notice payload. |
| `Action` | `ServerNoticeAction` | The action to take. Settable by the deciding handler; read-only in effect for observers, since they run after it has been settled. |

## ServerNoticeAction

```csharp
public enum ServerNoticeAction : byte
{
    Log,
    Ignore,
}
```

`Log` makes the engine log the notice; it's the default, so a notice is never silently dropped by a game that registered no handler. `Ignore` tells the engine the handler already took responsibility for it (showing it to the player, reporting it) and it shouldn't also log a warning.

If no handler is registered for a notice type, the context's action stays at `ClientManager.DefaultServerNoticeAction`, which is `Log`.

## AuthenticationDeniedNotice

The one notice the engine ships. Raised when the server refuses this client's connection attempt with a stated reason.

```csharp
public struct AuthenticationDeniedNotice : IServerNotice
{
    public string Reason;
}
```

Only raised when the server supplied a reason; a refusal with none disconnects the client and tells it nothing. Handle this notice rather than the client's local disconnect event: the disconnect fires from the receive pass, while this notice fires from the message pass a step later, so code reacting to the disconnect alone runs before the reason has arrived.

For code that would rather read a value than subscribe, `ClientManager.LastAuthenticationDenialReason` latches the same reason and survives past the disconnect.

## The limit: receive-side only

This pipeline only delivers notices the engine itself raises. The method that raises one, `RaiseServerNotice<T0>`, is internal, and its only call site is `ClientManager`'s own handling of the `AuthenticationDenied` message. A game can declare its own `IServerNotice` struct and register a handler or observer for it, but nothing in game code can ever raise that notice — there's no public API to do it, and none is coming through this pipeline.

To tell a client why it was kicked for a reason of your own, don't declare a notice. Send an ordinary message through `Connection.Kick<T0>` instead; see Kicking and disconnecting a client.
