---
title: "Type Identity on the Wire: Bundles and the Registry"
---

> **Using Unity?** See [Bundle Ids for Unity Assemblies](../../unity/wire/bundle-ids-for-unity-assemblies.md).

## The identity

Every spawned `NetworkSystem` or `NetworkComponent` is named on the wire by a `(BundleId, LocalId)` pair, not by its type name. The bundle identifier comes from a `[assembly: NetworkBundle(n)]` attribute declared once per assembly; the local identifier is assigned by the source generator within that assembly, starting from an ordinal sort of the type names it finds.

Systems and components use different local identifier widths: a system's local identifier is a `byte`, a component's is a `ushort`. That is a real limit, not a stylistic choice — an assembly can declare far more networked components than networked systems.

An assembly that declares no `[assembly: NetworkBundle(n)]` at all defaults to bundle zero.

## NetworkTypeRegistry

`NetworkTypeRegistry` is the static, process-wide map from a type to its wire identity and back to a factory that constructs it. Each bundle's generator emits a module initializer that registers its own types here, so the registry is the union of whatever bundles are loaded when the process starts.

Registration:

- `RegisterSystem<TSystem>(ushort bundleId, byte localId)`
- `RegisterComponent<TComponent>(ushort bundleId, ushort localId)`

Resolving a type to its identity, and back:

- `TryGetSystemId(Type type, out ushort bundleId, out byte localId)`
- `TryGetComponentId(Type type, out ushort bundleId, out ushort localId)`
- `TryCreateSystem(ushort bundleId, byte localId, out NetworkSystem networkSystem)`
- `TryCreateComponent(ushort bundleId, ushort localId, out NetworkComponent networkComponent)`
- `TryGetSystemType(ushort bundleId, byte localId, out Type systemType)`
- `TryGetComponentType(ushort bundleId, ushort localId, out Type componentType)`

`TryGetSystemType`/`TryGetComponentType` resolve an identity to a `Type` without constructing anything — useful when code only needs to decide whether it wants the object, not build one.

By-name forms exist for anything that has to name a type across builds rather than within a single session (an identity resolves to whatever type currently sorts into that position; a name either finds the type it names or finds nothing):

- `TryGetSystemIdByName(string systemTypeName, out ushort bundleId, out byte localId)`
- `TryCreateSystemByName(string systemTypeName, out NetworkSystem networkSystem)`
- `TryGetSystemName(Type systemType, out string systemTypeName)`
- `TryGetComponentName(Type componentType, out string componentTypeName)`
- `TryCreateComponentByName(string componentTypeName, out NetworkComponent networkComponent)`

`TryReturnSystem(NetworkSystem networkSystem)` returns a system to the pool its registered factory rented it from, resolved by the system's runtime type. It's the counterpart to `RegisterSystem` for anything holding a system by its base type — the engine's own wire construction, and any integration that rents systems ahead of a spawn that might never bind them.

```csharp
if (NetworkTypeRegistry.TryGetSystemId(typeof(MySystem), out ushort bundleId, out byte localId))
{
    // bundleId/localId are the wire identity for MySystem.
}

if (NetworkTypeRegistry.TryCreateSystem(bundleId, localId, out NetworkSystem system))
{
    // system was rented from MySystem's pool.
}
```

## Reserved values

`NetworkTypeRegistry.FrameworkBundleId` is `ushort.MaxValue`, reserved for the framework's own built-in types so a user's main assembly can default to bundle zero without colliding.

`NetworkTypeRegistry.BaseNetworkSystemLocalId` is `0`, reserved for the base `NetworkSystem` type itself. The base type is concrete and usable directly, but the generator only numbers `NetworkSystem` subclasses, so `NetworkSystemRegistration` registers the base type by hand — under `FrameworkBundleId`, not a separate "main" bundle. Generator-assigned system local identifiers therefore start at one.

## Bundle identifier framing

`BundleIdWireFormat` is internal — it's design rationale for why bundle assignment order matters, not an API you call. Identifiers are handed out from both ends of the sixteen-bit space: a game counts up from zero (bundle zero, then its content shards at one, two, three...), while the framework counts down from the top (`FrameworkBundleId` at `ushort.MaxValue`, the Unity integration one below it). Before a bundle identifier is written to the wire, the two ends of the range are folded together so an id near either end costs the fewest bits — bundle zero, the framework, the game's first content shard, and the Unity integration all land among the cheapest identifiers.

The practical consequence: assign bundle identifiers from an end of the space, and low. An identifier chosen from the middle of the space gets none of that benefit.

## Declared compositions

A composition is the set of component types named together at one spawn call site. The generator collects every distinct composition it finds in the build and registers it:

- `RegisterDeclaredComposition(params Type[] componentTypes)`
- `IsDeclaredComposition(List<uint> sortedComponentIds)`
- `GetComponentCompositionId(ushort bundleId, ushort localId)` packs a component's wire identity into the single value the composition check sorts and compares.

This answers "could this build have made this" about an object described by a peer rather than constructed locally. It matters for a receiver resolving a code-only spawn: a composition nothing in the build declares is one no legitimate call site could have produced, which the receiver can use to refuse it rather than trust it blindly.

## What this prevents

Because identity is a `(BundleId, LocalId)` pair scoped per assembly rather than a name or an index into a single global list, a content shard built and shipped separately from the main game cannot end up handing out the same identity as a type the main game already uses. Each bundle owns its own local identifier space; only the combination has to be unique, and that uniqueness is enforced by each assembly declaring its own `[assembly: NetworkBundle(n)]`.
