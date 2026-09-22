---
title: "Judging and Refusing a Relayed Call"
---

## Overview

An RPC handler on the server does not just react to a call - it can decide whether that call goes any further. Every handler returns an `RpcRelayAction`, and the server applies that verdict before writing a single byte to the peers the call would otherwise reach.

```csharp
public enum RpcRelayAction : byte
{
    Relay = 0,
    Cancel = 1,
}
```

`Relay` is zero. A handler that returns nothing meaningful, or that has no opinion about relaying, defaults to `Relay` - a handler with no opinion cannot accidentally suppress a relay. `Cancel` keeps the call on the server instead of passing it on to the system's other observers.

The verdict never travels. It is a decision the server makes locally, before anything is written, so a receiving peer has nothing to decode for it and no bit width is reserved for it on the wire.

## Veto folding

A call type can have more than one handler. When it does, every registered handler runs, regardless of what the ones before it returned, and the verdicts fold into one outcome: any single `Cancel` settles it for the whole call.

The fold only ever downgrades toward `Cancel`. A handler that answers `Relay` after an earlier handler already answered `Cancel` cannot undo that refusal - a permissive handler running later cannot overturn an earlier one's veto. The rule needs no priority or ordering between handlers because it only moves one direction.

## A throwing handler counts as Cancel

Each handler is invoked in its own try/catch, so one throwing handler does not stop the handlers after it from receiving the call. But the throw itself is treated as a refusal: a handler that threw never answered `Relay`, so the call fails closed rather than travelling on unjudged. A payload crafted to crash a moderating handler does not buy it a pass.

## What the peer is to the call

Alongside the verdict, a handler receives an `RpcContext` describing what this peer is to the call it's judging:

```csharp
public readonly struct RpcContext
{
    public readonly Channel Channel;
    public readonly NetworkSystem NetworkSystem;
    public readonly Connection? SenderConnection;
    public readonly Connection? TargetConnection;
    public readonly RpcDisposition Disposition;

    public bool IsSenderServer => SenderConnection?.IsServer ?? false;
}
```

`Disposition` is one of three mutually exclusive answers:

```csharp
public enum RpcDisposition : byte
{
    Recipient = 0,
    Origin = 1,
    Routing = 2,
}
```

- **`Recipient`** - the call was addressed to this peer, whose part is to act on it. A server admitting a client's fan-out reads as this too, since it is one of the observers the call is for, even as its verdict also decides whether the call travels on.
- **`Origin`** - this peer sent the call and is seeing its own copy, either as the server's local invoke or as an echo a client asked for.
- **`Routing`** - the call is passing through this peer to someone else, and was never addressed here. This only happens on the server, and only while it carries a client's targeted call on to the client that call named.

A handler that sees `Routing` still runs, and still gets a vote. That is deliberate: a call the server has not read is a call it cannot judge. A handler in this position judges the call and returns a verdict without applying whatever effect it would normally apply for a call addressed to it. `RpcContext.TargetConnection` names which connection the routed call is bound for - it is set only while `Disposition` is `Routing`, and is null otherwise.

## Cancel does not unwind what already happened

`Cancel` governs the onward send alone. It does not unwind the handling that produced it - every handler, including the one that returned `Cancel`, has already run against the call before the verdict is applied. This is what lets a moderating handler log or count the very call it just refused to forward: it read the call, acted on reading it, and only then stopped it from reaching anyone else.

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
