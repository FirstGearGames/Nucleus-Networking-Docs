---
title: "Who May Send a Call, and How Many"
---

## Set who may send a system a call

Every `NetworkSystem` has an `RpcSendAccess`, separate from its `MemberWriteAccess`, so observers can be allowed to call an object without being allowed to set its members.

```csharp
public enum RpcSendAccess : byte
{
    Controller = 0,
    AnyClient = 2,
}
```

- `Controller` (default): only the server or the controlling client may send the system a call.
- `AnyClient`: the server and any client that currently observes the system. A client that loses interest in the system loses the right to call it.

The server sets it; a client's call is rejected:

```csharp
public bool TrySetRpcAccess(RpcSendAccess rpcSendAccess)
```

Read the setting from `RpcAccess`. On a client, `CanLocalClientSendRpc` says whether the server last declared that this client may send, so it can avoid sending calls that will be refused. It is always `false` on the server. The server checks every incoming call against its own `RpcAccess` and observers, so a client claiming permission gains nothing.

## Handle RpcSendPermissionViolation

A call sent without permission raises `RpcSendPermissionViolation`, at most once per drain however many refused calls the drain carried. Subscribe through `ViolationManager.RpcSendPermissionViolationDetected`.

```csharp
public struct RpcSendPermissionViolation : IViolation
{
    public uint SystemId;
}
```

`SystemId` is the system the sender addressed. A well-behaved client can trigger it when permission is withdrawn while its calls are in flight, so decide in the game how to respond.

## Cap calls per drain

`RpcManager` limits how many inbound calls one connection may deliver in one drain:

```csharp
public uint MaximumInboundRpcsPerConnectionPerDrain = DefaultMaximumInboundRpcsPerConnectionPerDrain;

public const uint DefaultMaximumInboundRpcsPerConnectionPerDrain = 64;

public const uint UnsetMaximumInboundRpcsPerConnectionPerDrain = 0;
```

The default is 64. Set it to `UnsetMaximumInboundRpcsPerConnectionPerDrain` to remove the limit. Calls past the limit are dropped, and the excess raises `RpcFloodViolation` once per drain. Subscribe through `ViolationManager.RpcFloodViolationDetected`.

```csharp
public struct RpcFloodViolation : IViolation
{
    public uint ReceivedRpcCount;
    public uint AllowedRpcCount;
}
```

`ReceivedRpcCount` is how many calls the sender delivered in the drain; `AllowedRpcCount` is how many are allowed.
