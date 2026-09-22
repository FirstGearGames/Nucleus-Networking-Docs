---
title: "Seeing Your Own Call: RpcSelfDelivery"
---

## What it controls

`RpcSelfDelivery` decides whether the peer that sends a remote call also sees that call itself, and when. It is a single enum, not a set of flags, because the three answers are mutually exclusive: a sender either runs its own call at the send site, waits for the copy that comes back, or does neither. A pair of flags could ask for two of those at once, which would run the handlers twice.

`RpcSelfDelivery` says nothing about where the call is going; `RpcTarget` already does. It is only about the sender's own view of a call it is sending.

```csharp
public enum RpcSelfDelivery : byte
{
    None = 0,
    Immediate = 1,
    OnDelivery = 2,
}
```

It is the last parameter on `NetworkSystem.SendRpc<T0>`, and defaults to `None`:

```csharp
public bool SendRpc<T0>(RpcTarget rpcTarget, Channel channel, T0 rpc, RpcSelfDelivery rpcSelfDelivery = RpcSelfDelivery.None) where T0 : IRpc, new()
```

## The three values

### None

The sender does not see its own call. This is the default, and it's what a call whose effect the sender already applied by other means wants.

### Immediate

The sender's own handlers run at the send site, before the call has gone anywhere. This is what makes a client-fired effect feel instant. The price is that it runs whether or not the call survives: a client's call can still be refused by the authority afterward, and `Immediate` has already run by then. Use it where responsiveness matters more than being right.

### OnDelivery

The sender sees the call once it has actually been delivered, and not at all if it was refused. For effects that must agree on when something happens, or whether it happens at all, a client asking for `OnDelivery` sees its own call only if the authority passed it on. A refusal then reads as nothing happening, rather than as an effect that has to be undone.

The authority is itself the delivery point. Asking for `OnDelivery` on an authority's own send is treated the same as `Immediate`, resolved at the point of send rather than at the call site. That collapse is what lets one `SendRpc` call read the same on both peers instead of branching on role, the same way `RpcTarget.To` does for the destination.

`OnDelivery` is meaningless with `RpcTarget.Server`, and the engine refuses the send outright rather than silently downgrading it: a call addressed to the authority is not passed on anywhere, so there is nothing for it to come back from.

```csharp
if (isOnDelivery && isAddressedToAuthority)
{
    Logger<NetworkSystem>.LogError($"[{typeof(T0).Name}] was not sent to NetworkSystem [{AsStringInternal()}]: {nameof(RpcSelfDelivery)}.{nameof(RpcSelfDelivery.OnDelivery)} waits for a call to be passed on, and one addressed to the authority stops there.");

    return false;
}
```

## The host traps

A host runs both a server and a client in the same process, sharing one handler registry for a system. Two `RpcSelfDelivery` combinations need care as a result.

### Immediate with RpcTarget.Server is refused

On a host, a call addressed to `RpcTarget.Server` is already invoked locally as part of the send: the host's client half asks its own authority, and that ask runs the handlers right there. Asking for `Immediate` on top of that would run the handlers a second time, so the engine refuses the send and logs why:

```csharp
if (isServerStarted && isAddressedToAuthority && rpcSelfDelivery is RpcSelfDelivery.Immediate)
{
    Logger<NetworkSystem>.LogError($"[{typeof(T0).Name}] was not sent to NetworkSystem [{AsStringInternal()}]: a host's call to its own authority is invoked locally already, so {nameof(RpcSelfDelivery)}.{nameof(RpcSelfDelivery.Immediate)} on top of it would run the handlers twice.");

    return false;
}
```

### Immediate with RpcTarget.Observers cannot double-fire

Sending to `RpcTarget.Observers` with `Immediate` does not double-fire on a host either, but for a different reason: the fan-out walk skips the host's own client connection when the send has already been locally invoked, so it is served exactly once, either by the local invoke or by the fan-out, never both.

### Immediate with RpcTarget.To: the real pitfall

The trap that actually costs you something is not about double-firing. On a host, the client half and the server half register handlers on the same system, so `Immediate` runs the send site's handlers against the host's client half regardless of who the call is addressed to. Sending with `RpcTarget.To` and `Immediate` makes the host's client half run a copy of every addressed send, including calls addressed to other players, not just calls addressed to the host itself.

In other words: the host sees answers meant for somebody else. `TryQueueToConnection` still honors the address and skips queuing a redundant packet to the host's own loopback connection, but it does not stop the local invoke that already ran:

```csharp
if (isLocallyInvoked && connection is { IsHostLoopback: true, IsClient: true })
    return true;
```

A handler on a system a host client listens to needs to check who a call was actually for before treating `Immediate` delivery as its own.

## Telling your own copy apart: RpcContext.Disposition

A handler doesn't have to guess whether it's looking at its own call. `RpcContext.Disposition` is an `RpcDisposition` the engine sets locally, from what it knows the moment before the handler runs; none of it travels on the wire.

```csharp
public enum RpcDisposition : byte
{
    Recipient = 0,
    Origin = 1,
    Routing = 2,
}
```

`Origin` means this peer sent the call and is seeing its own copy: a local invoke as the authority, or the echo a client asked for through `RpcSelfDelivery.OnDelivery`. A handler reading `Origin` knows the effect is one this peer caused rather than one done to it, which is the distinction an effect that must not fire for its own author needs.

`Recipient` is the ordinary case, a call meant for the peer reading it. `Routing` is authority-only, and marks a call passing through on its way to a client it names elsewhere, never meant for the authority itself.
