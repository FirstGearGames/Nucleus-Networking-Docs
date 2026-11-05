---
title: "System RPCs"
---

> **Using Unity?** See [Sending a Remote Call From a Component](../../unity/messaging/remote-calls-from-a-component.md).

A system RPC is a remote call addressed to a `NetworkSystem`. The receiver finds the object before any handler runs, and skips a call for a system it does not hold.

## Declare a call as a struct that implements IRpc

```csharp
[NetworkType]
public struct DamageRpc : IRpc
{
    public int Amount;
}
```

`IRpc` is a marker interface. Every call requires an authenticated sender; there is no opt-out.

## Send a call

```csharp
bool sent = TrySendRpc(RpcTarget.Observers, Channel.Reliable, new DamageRpc { Amount = 10 });
```

- `RpcTarget` is who the call is for. See [Choosing Who Receives a Call](./rpc-targets.md).
- `Channel` is kept whatever the call's size. See [Channels and What Is Guaranteed](./channels-and-delivery-guarantees.md).
- `RpcSelfDelivery` (optional, `None` by default) decides whether this peer sees its own call. See [Seeing Your Own Call: RpcSelfDelivery](./rpc-self-delivery.md).

A client cannot see the server's observers, so `true` from a client means the call was queued, not delivered.

## Handle a call

Register the handler on the system so it runs only for that system's calls:

```csharp
RegisterRpcHandler<DamageRpc>(OnDamageRpc);
// ...
UnregisterRpcHandler<DamageRpc>(OnDamageRpc);
```

A handler matches `RpcManager.RpcReceivedHandler<T0>`:

```csharp
private RpcRelayAction OnDamageRpc(in RpcContext rpcContext, DamageRpc rpc)
{
    Health -= rpc.Amount;

    return RpcRelayAction.Relay;
}
```

Return `RpcRelayAction.Relay` to let the call travel on if it was going to, or `RpcRelayAction.Cancel` to keep it on this peer. Where nothing was going to travel on, the answer is ignored, so `Relay` is always safe.

## Read the call's circumstances from RpcContext

| Member | Meaning |
|---|---|
| `Channel` | The channel the call travelled on. |
| `NetworkSystem` | The system the call is addressed to, already resolved. |
| `SenderConnection` | The peer the call came from. Null only when neither role is running locally. |
| `TargetConnection` | The connection a routed call is bound for. Null unless `Disposition` is `Routing`. |
| `Disposition` | What this peer is to the call: `RpcDisposition.Recipient`, `RpcDisposition.Origin` or `RpcDisposition.Routing`. See [Judging and Refusing a Relayed Call](./rpc-relay-and-moderation.md). |
| `IsSenderServer` | Whether the server sent this call. |

When `Disposition` is `RpcDisposition.Routing`, the call is for another peer: judge it and return without applying its effect.
