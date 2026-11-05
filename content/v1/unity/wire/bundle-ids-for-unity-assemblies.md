---
title: "Bundle Ids for Unity Assemblies"
---

> **Driving the core API directly?** See [Type Identity on the Wire: Bundles and the Registry](../../core-api/wire/type-identity-and-bundles.md).

## Declare the bundle

Two separately compiled assemblies that both declare no bundle collide, because both default to bundle zero and each numbers its own types from the start. If you build a content shard as its own asmdef, give it its own bundle id before you ship it alongside anything else:

1. Add a C# file inside the shard's asmdef. It must be that asmdef, not a shared assembly the shard references, because the prefab collection takes its bundle id from the assembly it names. Putting the attribute in a shared assembly pulls every prefab in it into one bundle.
2. Declare the bundle at assembly scope:

```csharp
using Nucleus.Serializers;

[assembly: NetworkBundle(ContentBundleShard.BundleId)]
```

The gated-prefabs content shard demo does this, with a class that only holds the id:

```csharp
public static class ContentBundleShard
{
    public const ushort BundleId = 1;
}
```

Assign shard ids from 1 upward: 1, 2, 3.

## These bundle ids are already taken

- `NetworkTypeRegistry.FrameworkBundleId` (`ushort.MaxValue`) is the framework's own.
- `FrameworkBundleId - 1` is the `Nucleus.Integrations.Unity` assembly's.
- `FrameworkBundleId - 2` is reserved by Nucleus.
- Zero is the default for any Unity assembly that declares no `[assembly: NetworkBundle(...)]`.

## The prefab collection's bundle id is filled in for you

`NetworkPrefabCollection` has its own `PrefabBundleId` and `BundleAssemblyName` fields. They feed `NetworkPrefabRegistry`, which resolves which prefab a spawn names, not `NetworkTypeRegistry`, which the `[assembly: NetworkBundle(...)]` attribute feeds. The editor fills them in from the collection's own assembly; do not set them yourself.

## A collision logs an error and drops the type

If two types land on the same `(bundleId, localId)` pair, `NetworkTypeRegistry` refuses the second one and logs an error naming the bundle and local id. That type is missing from the registry, so spawning or replicating it fails. If a component or system never spawns and the console shows that error, check for a missing or duplicated `[assembly: NetworkBundle(...)]` first.
