---
title: "Seeing Your Own Call: RpcSelfDelivery"
---

## RpcSelfDelivery decides whether a sender sees its own call

`RpcSelfDelivery` is the last parameter of `NetworkSystem.TrySendRpc<T0>`. It controls only the sender's own view of the call; `RpcTarget` decides where the call goes.

```csharp
public bool TrySendRpc<T0>(RpcTarget rpcTarget, Channel channel, T0 rpc, RpcSelfDelivery rpcSelfDelivery = RpcSelfDelivery.None) where T0 : IRpc, new()
```

| Value | The sender's own handlers run |
|---|---|
| `None` (default) | Never. Use it when the sender already applied the effect another way. |
| `Immediate` | At the send site, before the call goes anywhere. Feels instant, but runs even if the server later refuses the call. |
| `OnDelivery` | Once the call has been delivered, and not at all if it was refused. Use it when peers must agree on whether and when something happened. |

On the server, `OnDelivery` behaves like `Immediate`, because the server is the delivery point. The same `TrySendRpc` call therefore reads the same on both peers.

## OnDelivery with RpcTarget.Server is refused

A call to the server stops there, so there is nothing to come back. `TrySendRpc` returns `false` and logs an error ending with:

> RpcSelfDelivery.OnDelivery waits for a call to be passed on, and one addressed to the authority stops there.

## Watch for these on a host

A host's client half and server half share one set of handlers per system.

- **`Immediate` with `RpcTarget.Server` is refused.** The call already runs the handlers locally, so `Immediate` would run them twice. `TrySendRpc` returns `false` and logs an error ending with:

  > a host's call to its own authority is invoked locally already, so RpcSelfDelivery.Immediate on top of it would run the handlers twice.

- **`Immediate` with `RpcTarget.Observers` is safe.** The host's own client is served once.
- **`Immediate` with `RpcTarget.To` runs the host's handlers for every addressed send**, including calls meant for other players. The call still reaches only its recipient, but the host has already run it locally. A handler on a system the host's client listens to must check who the call was for before treating it as its own.

## Tell your own copy apart

When `RpcContext.Disposition` is `RpcDisposition.Origin`, this peer sent the call and is seeing its own copy, either a local invoke on the server or the echo a client asked for with `OnDelivery`. Check it in any effect that must not fire for its own author. The other values are described in [Judging and Refusing a Relayed Call](./rpc-relay-and-moderation.md).
