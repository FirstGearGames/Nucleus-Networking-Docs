---
title: "Handler Registration and Scope"
---

> **Using Unity?** See [Registering Call Handlers Across a Component's Lifetime](../../unity/messaging/call-handlers-and-component-lifetime.md).

## Scope decides who a call reaches

`RpcManager` keys registered handlers by call type. Without a scope, every handler for a type would run for every object of that type in the world, forcing each handler to open by asking whether the call was actually addressed to it. `IRpcScope` moves that check into the engine:

```csharp
public interface IRpcScope
{
    bool IsRpcScopedTo(NetworkSystem networkSystem);
}
```

`NetworkSystem` implements it by scoping to itself:

```csharp
public bool IsRpcScopedTo(NetworkSystem networkSystem) => ReferenceEquals(this, networkSystem);
```

A handler registered through `NetworkSystem.RegisterRpcHandler` is invoked only for calls addressed to that instance, by reference identity. This matters beyond filtering: a handler that is never invoked for a call cannot return `RpcRelayAction.Cancel` for it. Scoping is what stops one object's handler from being able to refuse the relay of a call addressed to another.

`IRpcScope` is a predicate rather than a property naming "the system this is for," deliberately. A scope is not required to own exactly one system - something that hosts several systems can answer the question for all of them, which a property could not do.

## Registering directly with RpcManager

Most code registers through the `NetworkSystem` methods below, which handle scope and lifecycle automatically. `RpcManager` itself exposes the two underlying overloads:

```csharp
public void RegisterRpcHandler<T0>(RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();

public void RegisterRpcHandler<T0>(RpcReceivedHandler<T0> rpcReceivedHandler, IRpcScope rpcScope) where T0 : IRpc, new();
```

The first registers unscoped: the handler receives every call of that type in the world. The second scopes the handler to whatever `IRpcScope` is passed, which can own any number of systems.

## Registering through a NetworkSystem

```csharp
public void RegisterRpcHandler<T0>(RpcManager.RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();

public void UnregisterRpcHandler<T0>(RpcManager.RpcReceivedHandler<T0> rpcReceivedHandler) where T0 : IRpc, new();
```

Calling `RegisterRpcHandler` before the system has spawned is legal. The handler is tracked on the system; if the system is already started it registers with the manager immediately, otherwise the spawn registers every tracked handler as it goes live. From there the handler follows the system's lifecycle:

- Deregistered from the manager when the system despawns.
- Re-registered when the system respawns.
- Dropped from tracking only when the instance returns to the pool.

A handler is live with the manager exactly while the object is in the world, and a caller never has to time registration to the spawn.

## Re-registration and unregistration are idempotent and identity-scoped

Re-registering the same handler is a no-op: `NetworkSystem` checks whether the handler already has a tracked record before adding another, matching `RpcManager`'s own de-duplication.

Unregistering removes by handler identity only, never by scope. A handler belongs to at most one scope, so removing it by identity cannot remove another scope's handler.

## Registering or unregistering during a dispatch

Each call type's handler collection tracks a dispatch depth while it enumerates handlers for a received call. A registration or unregistration requested while that enumeration is in progress cannot touch the live collection, so it defers. The deferred change is applied only once the outermost dispatch unwinds - not a re-entrant one, since a handler may itself invoke a call of the type it is currently handling. This is what makes it safe for a handler to unregister itself from within its own invocation, which matters because a system auto-clears its handlers when it returns to the pool.
