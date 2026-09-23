---
title: "Bundle Ids for Unity Assemblies"
---

> **Driving the core API directly?** See [Type Identity on the Wire: Bundles and the Registry](../../core-api/wire/type-identity-and-bundles.md).

## Declare the bundle

Every networked type is registered under a bundle id and a local id. Two separately compiled assemblies that both declare no bundle collide, because an assembly declaring nothing defaults to bundle zero and the local id numbering restarts inside it. If you build a content shard as its own asmdef, give that asmdef its own bundle id before you ship it alongside anything else.

Put the attribute in a C# file inside the asmdef whose types you are numbering, at assembly scope:

```csharp
using Nucleus.Serializers;

[assembly: NetworkBundle(ContentBundleShard.BundleId)]
```

The gated-prefabs content shard demo does exactly this. Its `ContentBundleShard` class exists only to carry a named constant for the id:

```csharp
public static class ContentBundleShard
{
    public const ushort BundleId = 1;
}
```

The assembly that carries the attribute has to be the asmdef whose types you're numbering, not a shared assembly the shard happens to reference. The editor resolves a prefab collection's bundle id by reflecting over the assembly the collection names, so folding the attribute into a shared demos assembly would pull every prefab in that assembly into the same bundle.

## Ids already taken

- `NetworkTypeRegistry.FrameworkBundleId` — the framework's own bundle, `ushort.MaxValue`.
- `Nucleus.Integrations.Unity`'s `AssemblyInfo.cs` — `FrameworkBundleId - 1`, one below the framework so it can't collide with either the framework or a default user assembly.
- The integration's test assembly — `FrameworkBundleId - 2`, one below that, for the same reason: the tests and the demos both load in the editor, and without a distinct id the first of them to register takes bundle zero and the other's components are refused.
- A Unity assembly that declares no `[assembly: NetworkBundle(...)]` at all defaults to bundle zero.

Pick an id outside this set for every shard you add.

## A different bundle number on the same component

`NetworkPrefabCollection` carries its own `PrefabBundleId` and `BundleAssemblyName` serialized fields. These drive `NetworkPrefabRegistry`, the separate registry that resolves which prefab a spawn packet names — not `NetworkTypeRegistry`, the registry the `[assembly: NetworkBundle(...)]` attribute feeds. The two numbers look alike and both call themselves a bundle id, but they govern different registries and are populated independently: `NetworkPrefabCollection`'s fields are filled in by the editor scan of the collection's own assembly, not by anything you set directly.

## What a collision looks like

If two types land on the same `(bundleId, localId)` pair, `NetworkTypeRegistry` refuses the second registration outright and logs an error naming the bundle and local id involved. The type is not registered under the wrong class — it is simply absent from the registry, and any attempt to spawn or replicate it fails. If a component or system silently never spawns and the console has a registration error naming a bundle and local id, check for a missing or duplicated `[assembly: NetworkBundle(...)]` first.

## Assigning ids

Assign shard ids from the low end and keep going: 1, 2, 3. This isn't just convention — it's cheaper on the wire. `BundleIdWireFormat`, the internal format the registry ids are packed with, is tuned so both ends of the id space cost the fewest bits, with the cost rising the further an id sits from either end. A low id picked from the start of the range costs a few bits; an id picked from the middle of the range costs about twenty. There's no reason to burn wire budget by picking an arbitrary or high id when the low end is open.

See the core API page for `NetworkTypeRegistry` itself, and for declaring the same attribute in a csproj-built (non-Unity) assembly.
