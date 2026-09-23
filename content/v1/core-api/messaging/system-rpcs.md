---
title: "System RPCs"
---

> **Using Unity?** See [Sending a Remote Call From a Component](../../unity/messaging/remote-calls-from-a-component.md).

A system RPC is a remote call addressed to a `NetworkSystem`. The receiver resolves the object before any handler runs, so a call for a system this peer does not hold is stepped over whole instead of being decoded into nothing. Without that address, a game would have to put a system id in its own payload, re-resolve it on receipt, write its own fan-out, decide relay itself, and invent a permission check. A system RPC closes all of that.

## The call type

A call is a plain `[NetworkType]` struct that implements `IRpc`:

```csharp
[NetworkType]
public struct DamageRpc : IRpc
{
    public int Amount;
}
```

`IRpc` is a marker interface. The type the game declares is the type the wire carries; there is no generated stub between them. Every call requires an authenticated sender, with no per-type opt-out: a call is admitted against the addressed object's own permission, so there is no shape of call an unauthenticated peer can reach.

## Sending a call

`NetworkSystem.SendRpc<T0>` sends a call to the peers a target names:

```csharp
bool sent = SendRpc(RpcTarget.Observers, Channel.Reliable, new DamageRpc { Amount = 10 });
```

- `RpcTarget` is who the call is for: `RpcTarget.Server` (client to server only), `RpcTarget.Observers` (fan-out to every observer), `RpcTarget.ObserversExcept(connection, isControllerExcluded)` (server only), or `RpcTarget.To(connection)` (one named connection).
- `Channel` is the channel to send on; a call larger than the MTU is promoted to `Channel.Reliable`.
- `RpcSelfDelivery` controls when this peer sees its own call back (`RpcSelfDelivery.None` by default).

The return value reports only what this peer can see: a client cannot know the server's observer set, so a call it routed returning `true` means it was queued, not that it was delivered.

## Handling a call

Register a handler on the system so it runs only for that system's calls:

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

Return `RpcRelayAction.Relay` to let the call pass on if it was going to; return `RpcRelayAction.Cancel` to keep it on this peer. Where nothing was going to be passed on, the answer is discarded, so `Relay` is always safe.

## RpcContext

The handler's `in RpcContext` parameter carries the call's circumstances:

| Member | Meaning |
|---|---|
| `Channel` | The channel the call travelled on. |
| `NetworkSystem` | The system the call is addressed to, already resolved. |
| `SenderConnection` | The peer the call originated from. Nullable: null only when neither role is running locally. |
| `TargetConnection` | The connection a routed call is bound for, or null unless this peer is a routing waypoint. |
| `Disposition` | What this peer is to the call: `RpcDisposition.Origin`, `RpcDisposition.Recipient`, or `RpcDisposition.Routing`. |
| `IsSenderServer` | Whether the server is what sent this call. |

`Disposition` is the field worth branching on. When it is `RpcDisposition.Routing`, the call was addressed to a different peer and this one is only deciding whether it travels, so a handler should judge and return without applying the call's effect.
