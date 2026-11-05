---
title: "Who May Send a Call, and How Many"
---

## Choose who may call a system

Every `NetworkSystem` has an `RpcSendAccess`:

- `RpcSendAccess.Controller` (default): only the server, or the controlling client, may send the system a call.
- `RpcSendAccess.AnyClient`: the server and any client that currently observes the system may send. A client that stops observing the system loses the right with it.

Only the server can change it:

```csharp
public bool TrySetRpcAccess(RpcSendAccess rpcSendAccess)
```

A client calling `TrySetRpcAccess` is rejected.

Read the current setting from `RpcAccess`. On a client, `CanLocalClientSendRpc` tells it whether it may send, as most recently declared by the server, so a well-behaved client never sends a call the server will refuse. It is always `false` on the server. The server checks every incoming call against its own `RpcAccess` and observer list, so a client cannot grant itself access.

`RpcSendAccess` is separate from `MemberWriteAccess`: a game can let observers call an object without letting them set its members.

## Refused calls raise RpcSendPermissionViolation

A call sent without permission raises `RpcSendPermissionViolation`, at most once per drain:

```csharp
public struct RpcSendPermissionViolation : IViolation
{
    public uint SystemId;
}
```

`SystemId` is the system the sender addressed. A well-behaved client can trigger it when permission is withdrawn while its calls are still in flight, so decide what it costs rather than always kicking. Subscribe through `ViolationManager.RpcSendPermissionViolationDetected`.

## Capping calls per drain

`RpcManager` limits how many inbound calls one connection may deliver in a single drain:

```csharp
public uint MaximumInboundRpcsPerConnectionPerDrain = DefaultMaximumInboundRpcsPerConnectionPerDrain;

public const uint DefaultMaximumInboundRpcsPerConnectionPerDrain = 64;

public const uint UnsetMaximumInboundRpcsPerConnectionPerDrain = 0;
```

The default is 64. Set it to `UnsetMaximumInboundRpcsPerConnectionPerDrain` to remove the limit.

Calls past the limit are dropped, and `RpcFloodViolation` is raised once per drain:

```csharp
public struct RpcFloodViolation : IViolation
{
    public uint ReceivedRpcCount;
    public uint AllowedRpcCount;
}
```

`ReceivedRpcCount` is how many calls the sender delivered in the drain; `AllowedRpcCount` is the limit. Subscribe through `ViolationManager.RpcFloodViolationDetected`.
