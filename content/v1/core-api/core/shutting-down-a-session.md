---
title: "Shutting a session down"
---

> **Using Unity?** See [Play mode, domain reload and session lifetime](../../unity/core/unity-play-mode-lifetime).

`CoreManager.Deinitialize()` tears a session down: it stops the network loop, shuts every transport down, and releases every manager the `CoreManager` owns. Call it once, from whatever code owns the session's lifetime, when that session is done.

```csharp
coreManager.Deinitialize();
```

## The unwind order

`Deinitialize()` does three things, in this order, and the order is the point:

1. **Stop the loop provider.** `NetworkLoopManager.ReleaseNetworkLoopStepProvider()` runs first, because the default provider steps the loop from a thread-pool thread, and every manager released below mutates collections a step walks. Nothing else can safely happen while the loop is still stepping.
2. **Shut the transports down.** `TransportManager.ShutdownTransports()` runs next. Shutting a socket down drives the disconnect path through handlers spread across the managers, and every one of those managers is still whole at this point. Doing this later, partway through the manager unwind, would run those handlers against managers that no longer exist.
3. **Release the managers in reverse of construction order.** A manager built later resolved and registered onto managers built earlier (handlers on the message manager, a spawn gate on the interest manager, callbacks on the network loop manager). Releasing the newest first means nothing is released while something built after it still holds a reference to it.

Both the loop-provider release and the transport shutdown are idempotent on their own, so each manager's `Deinitialize` still reads as the one place its resource is released.

## Idempotence

`IsDeinitialized` is set to `true` before any of the unwind runs, not after. A second call to `Deinitialize()` returns immediately. This absorbs the two paths that would otherwise race or double-run: a host that already tore the session down explicitly, and a destroy callback (a platform's `OnDestroy`, for example) that arrives afterward. Neither path needs to check `IsDeinitialized` itself first, though it can:

```csharp
if (!coreManager.IsDeinitialized)
    coreManager.Deinitialize();
```

## The Deinitialized event

```csharp
public event DeinitializedHandler? Deinitialized;
public delegate void DeinitializedHandler(CoreManager coreManager);
```

`Deinitialized` is raised last, after every manager has been released and after the `Instance` slot has already moved on to the next live `CoreManager` (or to `null`). Despite that, the `CoreManager` and its manager fields are still readable during the raise. A consumer that keyed something per loop can use this instant to find its key through `NetworkLoopManager` and drop its own entry, without racing whatever the `Instance` slot now points at.

```csharp
coreManager.Deinitialized += static torndDown =>
{
    // torndDown.NetworkLoopManager is still readable here.
};
```

## A torn-down CoreManager is not reusable

Once `IsDeinitialized` is `true`, that instance is done. There is no re-initialize path. A process that wants to run another session constructs a new `CoreManager`. This applies whether the process is exiting or looping back to run the next session in place: the next session's `CoreManager` is a fresh object, not the old one reset.

## ResetRegistry for a host running sessions back to back

`CoreManager` keeps a static registry of every live manager, which is what `Instance` resolves from and what the slot is handed on through when a manager leaves. The registry holds strong references: a live manager must stay resolvable as a successor for the `Instance` slot, so nothing in it is ever collected while it is still registered.

A process that runs one session after another in the same run — rather than one `CoreManager` per process — calls `CoreManager.ResetRegistry()` at the very start of the next run, before anything can construct a new `CoreManager`. It clears the live-manager registry and clears `Instance` to `null`, so the new run cannot inherit managers left over from the run before it.

```csharp
CoreManager.ResetRegistry();
```

`ResetRegistry()` drops references rather than tearing anything down. It assumes whatever is still registered at that point belongs to a run that already ended and may be holding onto engine objects the host already destroyed. A session that wants an orderly unwind still calls `Deinitialize()` while it is live, before the next run resets the registry.

## Shutting transports down without a full teardown

Tearing down transports does not require tearing down the whole `CoreManager`. `TransportManager` exposes the same shutdown path used internally, scoped to one transport:

```csharp
await coreManager.TransportManager.TryRemoveTransport(transport);
```

`TryRemoveTransport` removes the transport from the manager's list and awaits `Transport.ShutdownAsync()` on it, then rescans the local server and client connections. It returns `false` if the transport was not in the list to begin with. This is the right call for stopping one transport — dropping a socket a session no longer needs — while the rest of the session keeps running.
