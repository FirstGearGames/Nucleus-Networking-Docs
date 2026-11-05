---
title: "The content bundle protocol"
---

> **Using Unity?** See [Content bundles in Unity](../../unity/scenes/content-bundles-in-unity.md).

A content bundle is a `ushort` id for content that is not in the base build, such as prefabs a client may not have installed yet. Nucleus carries the id and the load protocol between peers; your loader does the loading. `Connection.BaseBuildBundleId` (0) is the content shipped in the build and is always loaded.

## Register a loader

Implement `IBundleLoader`:

```csharp
public interface IBundleLoader
{
    Task<bool> LoadBundleAsync(ushort bundleId);
    Task<bool> UnloadBundleAsync(ushort bundleId);
}
```

- `LoadBundleAsync` must register the bundle's prefabs before its task completes, because completion tells the server it may spawn from the bundle at once.
- `UnloadBundleAsync` releases the bundle.

Both may complete on any thread. Mapping a bundle id to an asset bundle, an Addressables entry or a download is up to you.

Each peer has one loader:

```csharp
coreManager.BundleManager.SetBundleLoader(myLoader);
```

## Gate spawns on content

`NetworkSystem.RequiredBundleId` is the bundle a spawn needs. It defaults to the bundle the prefab was built into (`PrefabBundleId`). Override it with `SetRequiredBundleId(ushort bundleId)`, and clear the override with `UnsetRequiredBundleId` (`ushort.MaxValue`).

`BundleManager.SpawnGate`, a `BundleInterestCondition`, withholds a spawn from a client that does not yet hold `RequiredBundleId`. The object spawns normally once the client confirms the bundle. Without the gate, a spawn for content a client lacks arrives anyway and fails at instantiation.

The gate is not registered for you. It is stateless, so add it globally or to any number of systems:

```csharp
// Globally, for a world where most content hotloads:
coreManager.InterestManager.AddCondition(coreManager.BundleManager.SpawnGate);

// Or only on the prefabs that actually ship in a bundle:
networkSystem.AddInterestCondition(coreManager.BundleManager.SpawnGate);
```

## Get the bundle loaded

With `BundleManager.AutomaticRequestOnBlockedSpawnEnabled` (default `true`), a spawn the gate blocks also asks that client to load the bundle, and the object appears once the client confirms. Set it to `false` to drive every load from your code; the gate still withholds spawns.

To ask a client yourself, on the server:

```csharp
coreManager.BundleManager.RequestBundleLoad(connection, bundleId);
```

A repeat while a request for that client and bundle is outstanding is dropped.

To load or release a bundle on this peer itself, for example a server loading a zone before spawning from it, or a client preloading:

```csharp
bool loaded = await coreManager.BundleManager.LoadBundleAsync(bundleId);
bool unloaded = await coreManager.BundleManager.UnloadBundleAsync(bundleId);
```

This runs through your `IBundleLoader`. On a client it is only a preload: the load is reported only if the server is already waiting on that bundle. Otherwise the server still asks when a spawn needs the bundle, and records the client's answer to that request. A bundle-backed scene load uses this call too.

## Report outcomes from your own loading code

`LoadBundleAsync` and `UnloadBundleAsync` report to the server for you. Call `BundleManager.NotifyBundleLoaded(ushort bundleId)` and `NotifyBundleUnloaded(ushort bundleId)` only if your game loads outside an `IBundleLoader`. A load report is sent only in answer to a server request, and an unload report only for a bundle the server records the client holding.

On the server, `Connection.IsBundleLoaded(ushort bundleId)` reports whether a client holds a bundle.

## Watch the protocol

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

`OnBundleLoadStateChanged` fires only on an actual change, after the client's held bundles and interest are updated, so `Connection.IsBundleLoaded` inside it returns the new state. It mostly matters on the server, which tracks what each client holds.

## Two violations catch a client acting on its own

- `UnsolicitedBundleReportViolation`: a load report for a bundle the server never asked for, or an unload report for one the server does not record the client holding. This catches a spoofed load report.
- `UnexpectedBundleRequestViolation`: a bundle load request, which only the server sends, arriving at the server.

Both default to a kick.

## Most of the bundle API is Pro

`BundleManager`, `IBundleLoader`, `IBundleObserver`, `BundleInterestCondition` and `Connection.IsBundleLoaded` are Pro. In Free, `CoreManager` has no `BundleManager` member. The two violation types, `Connection.BaseBuildBundleId`, and `NetworkSystem.RequiredBundleId` with `SetRequiredBundleId` work in both editions.
