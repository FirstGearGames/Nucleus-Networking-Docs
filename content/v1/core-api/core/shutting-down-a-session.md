---
title: "Shutting a session down"
---

> **Using Unity?** See [Play mode, domain reload and session lifetime](../../unity/core/unity-play-mode-lifetime.md).

## Call Deinitialize once when the session is done

```csharp
coreManager.Deinitialize();
```

`CoreManager.Deinitialize()` stops the network loop, shuts every transport down and releases every manager the `CoreManager` owns. Call it from whatever code owns the session's lifetime.

A second call returns immediately, because `IsDeinitialized` is set before the teardown starts. So an explicit teardown followed by a destroy callback (a platform's `OnDestroy`, for example) is safe. You can still check first:

```csharp
if (!coreManager.IsDeinitialized)
    coreManager.Deinitialize();
```

A torn-down `CoreManager` cannot be reused. To run another session, construct a new one.

## Deinitialized is raised last

```csharp
public event DeinitializedHandler? Deinitialized;
public delegate void DeinitializedHandler(CoreManager coreManager);
```

`Deinitialized` is raised after every manager has been released and after `Instance` has moved on to the next live `CoreManager` (or `null`). The `CoreManager` and its manager fields are still readable during the raise, so a consumer that keyed something per loop can find its key through `NetworkLoopManager` and drop its entry:

```csharp
coreManager.Deinitialized += static tornDown =>
{
    // tornDown.NetworkLoopManager is still readable here.
};
```

## Call ResetRegistry before each run when sessions run back to back

`CoreManager` keeps a static registry of every live manager, which `Instance` resolves from. A process that runs one session after another in the same run calls `CoreManager.ResetRegistry()` at the very start of the next run, before anything constructs a new `CoreManager`:

```csharp
CoreManager.ResetRegistry();
```

It clears the registry and sets `Instance` to `null`, so the new run cannot inherit managers from the one before. It only drops references and tears nothing down, so a session that wants an orderly teardown still calls `Deinitialize()` while it is live.

## Remove one transport without tearing the session down

```csharp
await coreManager.TransportManager.TryRemoveTransport(transport);
```

`TryRemoveTransport` removes the transport from the manager, awaits `Transport.ShutdownAsync()` on it, and rescans the local server and client connections, while the rest of the session keeps running. It returns `false` if the transport was not in the list.
