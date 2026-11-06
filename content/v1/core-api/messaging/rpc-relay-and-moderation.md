---
title: "Judging and Refusing a Relayed Call"
---

## Return a verdict from every server handler

Every call handler returns an `RpcRelayAction`. On the server, the verdict decides whether the call goes on to the peers it was addressed to:

- `RpcRelayAction.Relay` (the default value, `0`) lets it travel.
- `RpcRelayAction.Cancel` keeps it on the server.

The verdict is applied on the server before anything is sent onward. Receiving peers are never told it.

## Any one Cancel wins

When a call type has several handlers, every one of them runs, whatever the earlier ones returned. A single `Cancel` settles it, and a later `Relay` cannot undo it.

A handler that throws counts as `Cancel`. The handlers after it still receive the call, but the call does not travel on unjudged.

## RpcContext.Disposition says what this peer is to the call

The handler's `RpcContext` (see [System RPCs](./system-rpcs.md)) carries an `RpcDisposition`, set locally on each peer:

- **`Recipient`**: the call was addressed to this peer, which acts on it. A server admitting a client's fan-out is a `Recipient` too, even though its verdict also decides whether the call travels on.
- **`Origin`**: this peer sent the call and is seeing its own copy, either as the server's local invoke or as an echo a client asked for.
- **`Routing`**: server only. The call is passing through on its way to the client it names, and was never addressed here. `RpcContext.TargetConnection` names that client; it is null for every other disposition.

On `Routing`, judge the call and return a verdict without applying its effect.

## Cancel does not undo what handlers already did

Every handler, including the one that returns `Cancel`, has already run against the call. So a moderating handler can log or count the call it refuses:

```csharp
private RpcRelayAction OnRpcReceived(in RpcContext rpcContext, MyRpc value)
{
    if (ShouldBlock(value))
    {
        // Still seen and logged, just not relayed.
        Logger.LogWarning(typeof(MySystem), $"Blocked call from {rpcContext.SenderConnection?.AsString()}: {value}");
        return RpcRelayAction.Cancel;
    }

    return RpcRelayAction.Relay;
}
```
