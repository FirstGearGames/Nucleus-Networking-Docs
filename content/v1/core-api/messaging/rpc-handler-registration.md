---
title: "Handler Registration and Scope"
---

> **Using Unity?** See [Registering Call Handlers Across a Component's Lifetime](../../unity/messaging/call-handlers-and-component-lifetime.md).

## Register through the system the call is for

```csharp
public void RegisterRpcHandler<T0>(RpcManager.RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();

public void UnregisterRpcHandler<T0>(RpcManager.RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();
```

A handler registered through `NetworkSystem.RegisterRpcHandler` runs only for calls addressed to that instance, so one object's handler can never cancel the relay of another object's call.

You can register before the system spawns. From then on the handler follows the system:

- Removed when the system despawns.
- Registered again when the system respawns.
- Dropped for good when the instance returns to the pool.

## Register with RpcManager to serve many systems

`RpcManager` has two overloads:

```csharp
public void RegisterRpcHandler<T0>(RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();

public void RegisterRpcHandler<T0>(RpcReceivedHandler<T0> rpcReceivedHandler, IRpcScope rpcScope) where T0 : IRpc, new();
```

The first is unscoped: the handler receives every call of that type in the world. The second runs the handler only for systems the scope accepts:

```csharp
public interface IRpcScope
{
    bool IsRpcScopedTo(NetworkSystem networkSystem);
}
```

One scope may accept any number of systems. `NetworkSystem` itself is an `IRpcScope` that accepts only itself.

Handlers registered through a `NetworkSystem` cost the same however many objects handle that call type. Unscoped handlers, and handlers with any other `IRpcScope`, are each asked on every call of their type, so register through the system unless one handler really speaks for many systems.

## Registering twice or inside a handler is safe

- Registering the same handler again does nothing.
- Unregistering removes by handler identity. A handler belongs to at most one scope, so this never removes another scope's handler.
- Registering or unregistering from inside a handler is allowed, including a handler unregistering itself. The change applies once the outermost dispatch finishes.
