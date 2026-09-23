---
title: "The content bundle protocol"
---

> **Using Unity?** See [Content bundles in Unity](../../unity/scenes/content-bundles-in-unity.md).

A content bundle is a `ushort` identifier for a shard of content that is not in the base build: a set of prefabs a client
might not have installed yet. Nucleus carries the identifier and the load/unload protocol between the peers; it ships no
loader of its own. `Connection.BaseBuildBundleId` (0) means the content shipped in the build, and is always considered
loaded.

## Registering a loader

Implement `IBundleLoader`:

```csharp
public interface IBundleLoader
{
    Task<bool> LoadBundleAsync(ushort bundleId);
    Task<bool> UnloadBundleAsync(ushort bundleId);
}
```

`LoadBundleAsync` must register the bundle's prefabs before the task completes, since a completion tells the server it may
spawn into the content immediately. `UnloadBundleAsync` releases it. Both may complete asynchronously, on any thread; the
outcome is queued and drained back onto the network loop, so nothing a loader does off-thread races the outbound writers.

Register the loader with `BundleManager.SetBundleLoader`:

```csharp
coreManager.BundleManager.SetBundleLoader(myLoader);
```

The engine consults exactly one loader per peer. Core ships no implementation; mapping a bundle identifier to an asset
bundle, an addressable catalog entry, or a download is entirely the game's concern.

## Gating spawns on content

`NetworkSystem.RequiredBundleId` is the bundle a spawn needs. It defaults to the bundle the prefab itself was built into
(`PrefabBundleId`), but can be overridden with `SetRequiredBundleId(ushort bundleId)`. The sentinel `UnsetRequiredBundleId`
(`ushort.MaxValue`) clears an override and falls back to the prefab's own bundle.

`BundleManager.SpawnGate` is a `BundleInterestCondition` (`Capabilities => InterestEffect.Spawn`) that withholds a
system's spawn from a Connection that does not yet hold `RequiredBundleId`. It is not registered for you; attach it at
whatever scope fits:

```csharp
// Globally, for a world where most content hotloads:
coreManager.InterestManager.AddCondition(coreManager.BundleManager.SpawnGate);

// Or only on the prefabs that actually ship in a bundle:
networkSystem.AddInterestCondition(coreManager.BundleManager.SpawnGate);
```

The condition is stateless and safe to register against any number of systems. Without it, a spawn for content a client
lacks arrives anyway and fails at instantiation; with it, the object simply does not exist for that client until the
bundle is confirmed, and then spawns normally.

## Getting the bundle loaded

With `BundleManager.AutomaticRequestOnBlockedSpawnEnabled` (true by default), a spawn the gate blocks also asks that
client to load the missing bundle, so content hotloads on demand and the object appears the moment the client confirms.
Clear the flag to drive every load from game code instead; the gate still withholds spawns but never asks on its own.

To ask explicitly:

```csharp
coreManager.BundleManager.RequestBundleLoad(connection, bundleId);
```

This is server-side, and dedupes per Connection and bundle — a repeat while a request is outstanding is dropped.

A peer can also load or release a bundle on itself, independent of any request from the other side:

```csharp
bool loaded = await coreManager.BundleManager.LoadBundleAsync(bundleId);
bool unloaded = await coreManager.BundleManager.UnloadBundleAsync(bundleId);
```

This is the route for content a peer decides it needs on its own — a server hotloading a zone it is about to spawn
from, or a client preloading ahead of a gate. It runs through the registered `IBundleLoader`. On a client it is only a
preload: the load is reported to the server only if the server has already asked for that bundle and is still waiting on
the answer. Otherwise the content loads locally and nothing is sent, and the server still asks for the bundle when a
spawn needs it; the client's answer to that request is what the server records. This is also the call a bundle-backed
scene load makes to bring its content in.

## Reporting outcomes

`BundleManager.NotifyBundleLoaded(ushort bundleId)` and `NotifyBundleUnloaded(ushort bundleId)` report an outcome to the
server. `LoadBundleAsync`/`UnloadBundleAsync` call these automatically; call them directly only when a game drives
loading itself outside an `IBundleLoader`. Either way, a load report is sent only in answer to a request the server made,
and an unload report only for a bundle the client has already told the server it holds; anything else stays on the client.

On the server, `Connection.IsBundleLoaded(ushort bundleId)` (Pro) reports whether a client holds a bundle.
`Connection.BaseBuildBundleId` (0) is always loaded, since it shipped inside the build.

## Watching the protocol

Two events on `BundleManager`:

```csharp
coreManager.BundleManager.BundleLoadRequested += OnBundleLoadRequested;      // client: server asked for a bundle
coreManager.BundleManager.BundleLoadStateChanged += OnBundleLoadStateChanged; // server: a client's bundles changed
```

Or implement `IBundleObserver` and register it with `RegisterBundleObserver`:

```csharp
public interface IBundleObserver
{
    void OnBundleRequested(Connection connection, ushort bundleId);
    void OnBundleLoadStateChanged(Connection connection, ushort bundleId, bool isLoaded);
}
```

`OnBundleLoadStateChanged` fires only on an actual change, after the Connection's held set and interest have already
been updated, so a handler reading `Connection.IsBundleLoaded` inside it sees the new state. This side is mostly a
server concern: the server is the side that tracks what each client holds.

## Violations

The server drives every load: it asks, then awaits the answer. Two violations catch a client that does not play by that:

- `UnsolicitedBundleReportViolation` — a load report for a bundle the server never asked for, or an unload report for a
  bundle the server does not record the client holding. This is how a spoofed load report is caught.
- `UnexpectedBundleRequestViolation` — a bundle load *request*, a message only the server ever sends, arriving at the
  server instead.

Both default to a kick.

## Pro and Free

`BundleManager` is Pro. In a Free build, `CoreManager` has no `BundleManager` member at all. `IBundleLoader`,
`IBundleObserver`, `BundleInterestCondition` and `Connection.IsBundleLoaded` are Pro as well. The two violation types,
`Connection.BaseBuildBundleId`, and `NetworkSystem.RequiredBundleId` with `SetRequiredBundleId` live in plain files
usable in either edition.
