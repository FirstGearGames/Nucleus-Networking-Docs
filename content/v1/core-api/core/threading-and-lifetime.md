---
title: "Threading and lifetime"
---

## Callbacks run on a thread pool thread by default

With no loop step provider, `CoreManager` uses `SystemNetworkLoopStepProvider`, which runs a `System.Timers.Timer` and so steps the loop on a thread pool thread, not the thread that constructed the `CoreManager`.

Every loop step callback (`INetworkLoopStepCallback.OnNetworkLoopStep`), message handler, RPC handler and `NetworkMember<T0>` changed callback runs inside a loop step, so with the default provider all of it runs on a pool thread. Code that touches a UI collection, a non-thread-safe cache or anything else not built for concurrent access must not assume it is on the constructing thread, unless you supplied your own provider.

The Unity integration drives the loop from Unity's main thread instead, so callbacks, handlers and scene and bundle continuations land there.

## Name your provider in the constructor

```csharp
public CoreManager(uint tickRate = NetworkLoopManager.DefaultTickRate, INetworkLoopStepProvider? networkLoopStepProvider = null)
```

With `null`, the constructor starts the default provider as its last step, so by the time it returns the loop is already running on a pool thread. Anything you register afterwards, such as `RegisterNetworkLoopStepCallbacks` calls or your own systems, races a loop that is already stepping; there is no guaranteed idle window. In a console host, pass your own `INetworkLoopStepProvider` to the constructor, so nothing steps until you say so. See [Driving the loop yourself](./custom-loop-step-provider.md).

## Only one thread may step a loop at a time

A call to `NetworkLoopManager.InvokeNetworkLoopStep` from a second thread while a step is running on another is refused and logs an error, and nothing registered on that step runs for it. A re-entrant call from inside a step, on the thread already running it, runs normally.

If you see this error, the usual cause is a `CoreManager` left on the default timer while something else, such as a manual step or a second timer, also drives it.

Each `NetworkLoopManager` has its own callback registrations. Two `CoreManager`s in one process, such as a host pair or a two-peer test, never dispatch each other's callbacks.

## Debug builds catch cross-thread access

A Debug build of `Nucleus.dll` logs an error when outgoing message sends or the loop's own collections are touched while a step is running on a different thread. Release builds do not check, so a threading mistake can go unnoticed there. If you are chasing a corrupted collection or a torn write, run the reproduction in Debug and check the log for these errors.

## Loaders may complete on any thread

`ISceneLoader.LoadSceneAsync` and `UnloadSceneAsync` return `Task<bool>` and may await freely, such as a download, a disk read or an engine operation, without minding which thread the continuation resumes on. The loop never blocks on them, and the engine handles the outcome on the loop thread, so you never have to return to it yourself.

`IBundleLoader` (Pro-only) is the same for bundles: `LoadBundleAsync` and `UnloadBundleAsync` return `Task<bool>` and may complete on any thread.
