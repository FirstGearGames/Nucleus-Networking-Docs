---
title: "Who May Send a Call, and How Many"
---

## What send access controls

Every `NetworkSystem` has an `RpcSendAccess`, layered beside control exactly as `StateWriteAccess` is layered beside write control.

```csharp
public enum RpcSendAccess : byte
{
    Controller = 0,
    AnyClient = 2,
}
```

`Controller` is the default: only the server, or the single controlling client, may send the system a call. `AnyClient` opens sending to the server and to any client that currently observes the system.

Ordinal 1 is deliberately vacant. The value is serialized into authored Unity scenes, so renumbering `AnyClient` would silently reinterpret every scene that already carries a value of 1 as something else.

## Setting and reading access

The server sets access with `SetRpcAccess`:

```csharp
public bool SetRpcAccess(RpcSendAccess rpcSendAccess)
```

It's server-only; a client call is rejected, since letting a client widen its own send access would make the permission client-settable.

The current setting is readable from `RpcAccess`. On the client side, the read that matters is `CanLocalClientSendRpc`: a one-bit capability hint the server most recently declared, telling the local client whether it personally may send. It exists so a well-behaved client never sends a call the server is going to refuse, and it's always `false` on the server.

## Nothing travels as a grant

The server enforces every call from its own copy of `RpcAccess`. A client is told only which access is in force and whether it personally may send (`CanLocalClientSendRpc`); it is never handed anything resembling a permission token. A forged "I may send" claim from a client is inert, because the server re-checks every incoming call against `RpcAccess` and its own observer roster.

## Access widens permission, it never replaces observation

`AnyClient` is scoped to observers, not to every client in the world. Losing interest in a system silently removes the right to call it along with the interest itself - `AnyClient` means you may call what you can see.

## Kept separate from state write access

`RpcSendAccess` and `StateWriteAccess` are deliberately different knobs. "You may ask this object to do something" and "you may overwrite this object's state" are different grants - folding them into one would mean a game that wants observers to fire a call at an object has to open its state stream to them as well.

## RpcSendPermissionViolation

A call sent to a system without permission raises `RpcSendPermissionViolation`:

```csharp
public struct RpcSendPermissionViolation : IViolation
{
    public uint SystemId;
}
```

`SystemId` is the Id of the system the sender addressed without permission. It's raised at most once per drain, however many refused calls that drain carried.

The violation reaches a well-behaved client too, on a revocation race: permission is withdrawn while calls already sent are still in flight. That's why it's a violation the game decides on rather than a discard the framework settles alone. Subscribe through `ViolationManager.RpcSendPermissionViolationDetected`.

## Capping calls per drain

`RpcManager` bounds how many inbound calls one connection may deliver in a single drain:

```csharp
public uint MaximumInboundRpcsPerConnectionPerDrain = DefaultMaximumInboundRpcsPerConnectionPerDrain;

public const uint DefaultMaximumInboundRpcsPerConnectionPerDrain = 64;

public const uint UnsetMaximumInboundRpcsPerConnectionPerDrain = 0;
```

The default is 64. Setting the field to `UnsetMaximumInboundRpcsPerConnectionPerDrain` removes the bound entirely. Without a cap, a peer packing calls into a datagram costs the receiver a decode and a dispatch per call while costing the sender almost nothing.

Calls past the budget are dropped rather than dispatched, and the excess raises `RpcFloodViolation` once per drain:

```csharp
public struct RpcFloodViolation : IViolation
{
    public uint ReceivedRpcCount;
    public uint AllowedRpcCount;
}
```

`ReceivedRpcCount` is how many calls the sender delivered in the drain; `AllowedRpcCount` is how many the receiver admits per drain. Subscribe through `ViolationManager.RpcFloodViolationDetected`.
