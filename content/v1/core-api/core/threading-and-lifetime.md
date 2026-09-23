---
title: "Threading and lifetime"
---

## The default provider runs on the thread pool

`CoreManager` drives its network loop through an `INetworkLoopStepProvider`. Pass none and it falls back to `SystemNetworkLoopStepProvider`, which runs a `System.Timers.Timer`. A `System.Timers.Timer` raises its `Elapsed` event on a thread-pool thread, not the thread that constructed the `CoreManager`.

This is the first thing a plain .NET host gets wrong. Every loop step callback (`INetworkLoopStepCallback.OnNetworkLoopStep`), every message handler, every RPC handler, and every `NetworkMember<T0>` changed callback dispatches from inside a network loop step. With the default provider, that means all of it runs on a pool thread by default. If your own code assumes it is running on the thread that built the `CoreManager` - touching a UI collection, a non-thread-safe cache, anything not built for concurrent access - that assumption is wrong unless you supplied your own provider.

## One loop drives one manager

`NetworkLoopManager.InvokeNetworkLoopStep` claims the step with an `Interlocked.CompareExchange` before doing any work. If a second thread calls in while a step is already executing on a different thread, that call is refused outright: the step's callbacks do not run, and the refusal is logged as an error (throttled to at most once every sixty seconds so a stuck second driver does not flood the log). The step is not queued or retried; it simply costs that tick's work for whatever registered on it.

A re-entrant call from *inside* a step, on the thread that already holds it, is not a second driver and runs normally.

The refusal exists because two threads walking or mutating the same loop-owned collection at once is exactly the kind of fault that does not surface where it happens: a modified-collection exception out of a receive drain, a null entry from a torn callback lookup, a pooled `Writer` handed to two owners at once. Refusing the second call keeps the corruption from happening instead of trying to detect it afterward. The usual cause of seeing this in your own log is a `CoreManager` that was never given a step provider, leaving the default timer stepping it from the thread pool while something else - a manual step, a second timer - also drives it.

## Register your provider at construction, not after

`CoreManager`'s constructor takes an optional `INetworkLoopStepProvider`:

```csharp
public CoreManager(uint tickRate = NetworkLoopManager.DefaultTickRate, INetworkLoopStepProvider? networkLoopStepProvider = null)
```

If you pass `null`, the constructor starts the default `SystemNetworkLoopStepProvider` as its last step, once every manager has finished instantiating. By the time the constructor returns, the loop is already running on a pool thread.

Any registration you make after that - a manual `RegisterNetworkLoopStepCallbacks` call, wiring up your own systems, anything that touches loop-owned state from your own construction code - is now racing a loop that is already stepping. There is no window after construction where the loop is guaranteed idle.

In a console host, name your own `INetworkLoopStepProvider` in the `CoreManager` constructor call instead of accepting the default. Driving the loop yourself (or from a provider whose timing you control) means nothing steps until you say so, so your own post-construction setup runs before the loop can touch anything.

## The DEBUG-only guards

Two internal checks compiled only into a Debug build of `Nucleus.dll` log an error when loop-owned state is touched while a step is executing on a *different* thread: one covers outgoing message sends, the other the loop's own collections. They do nothing in Release; a Debug run is what surfaces a threading mistake that a Release run silently gets away with. If you are chasing a corrupted collection or a torn write that never reproduces in Debug, that alone is a clue: run the reproduction in Debug and check the log for these.

## Isolation between CoreManagers

The step-callback registry belongs to each `NetworkLoopManager` instance; it is not static state. Two `CoreManager` instances in the same process - a host pair, a bridge test - each own their own loop and their own callback registrations. One manager's registered callbacks are never dispatched by the other's steps.

## Async work and the loop

`ISceneLoader.LoadSceneAsync` and `UnloadSceneAsync` return `Task<bool>` and may await freely - a download, a disk read, an engine operation - without minding which thread the continuation resumes on. Nothing in the loop blocks waiting for them.

The engine brings an awaited outcome back onto the loop thread itself. Once your loader's task completes, the engine's follow-up is queued for the loop rather than run inline, so it always resumes on the loop regardless of which thread the awaited operation completed on. Queued follow-ups run during `NetworkLoopSteps.EarlyVariableUpdate`, after that tick's messages have dispatched. A scene operation that finishes on a background thread therefore has its loop-owned follow-up (registering objects, tearing down on release) land at that same controlled point in the tick every time, not whenever the background work happens to finish.

`IBundleLoader` (Pro-only) is the equivalent seam for bundle loads: `LoadBundleAsync` and `UnloadBundleAsync` are likewise `Task<bool>`-returning and the engine does not care which thread they complete on, for the same reason.

## The Unity integration sidesteps this

Unity drives the loop from the main thread instead of the default pool-thread timer, so callbacks, handlers and scene/bundle continuations land on Unity's main thread the way the rest of your MonoBehaviour code expects. See the Unity integration's own network loop page for how its provider is wired up.
