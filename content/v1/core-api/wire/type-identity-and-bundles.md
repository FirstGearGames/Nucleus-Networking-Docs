---
title: "Type Identity on the Wire: Bundles and the Registry"
---

> **Using Unity?** See [Bundle Ids for Unity Assemblies](../../unity/wire/bundle-ids-for-unity-assemblies.md).

## Each type is identified by a bundle id and a local id

Every spawned `NetworkSystem` or `NetworkComponent` is identified by a `(BundleId, LocalId)` pair, not its type name. The bundle id comes from `[assembly: NetworkBundle(n)]`, declared once per assembly; an assembly without it is bundle zero. The local id is assigned for you within the assembly. Only the pair has to be unique, so separately built content assemblies cannot clash with the main game as long as each declares its own bundle id.

A system's local id is a `byte` and a component's is a `ushort`, so one assembly can declare far fewer networked system types than component types.

## Choose bundle ids counting up from zero

Use bundle zero for the main game, then one, two, three for its content assemblies. These values are reserved:

- `NetworkTypeRegistry.FrameworkBundleId` is `ushort.MaxValue`, for the framework's built-in types. The Unity integration uses the id one below it.
- `NetworkTypeRegistry.BaseNetworkSystemLocalId` is `0`, for the base `NetworkSystem` type, which is concrete, usable directly and registered under `FrameworkBundleId`. Your own systems' local ids start at one.

## Look types up with NetworkTypeRegistry

`NetworkTypeRegistry` maps each type to its identity and back to a factory. Each assembly's types are registered automatically when it loads, through:

- `RegisterSystem<TSystem>(ushort bundleId, byte localId)`
- `RegisterComponent<TComponent>(ushort bundleId, ushort localId)`

Resolve a type to its identity and back:

- `TryGetSystemId(Type type, out ushort bundleId, out byte localId)`
- `TryGetComponentId(Type type, out ushort bundleId, out ushort localId)`
- `TryCreateSystem(ushort bundleId, byte localId, out NetworkSystem networkSystem)`
- `TryCreateComponent(ushort bundleId, ushort localId, out NetworkComponent networkComponent)`
- `TryGetSystemType(ushort bundleId, byte localId, out Type systemType)`
- `TryGetComponentType(ushort bundleId, ushort localId, out Type componentType)`, which, like `TryGetSystemType`, resolves the type without constructing anything.

An identity can name a different type in a different build, so use the by-name forms for anything that must name a type across builds:

- `TryGetSystemIdByName(string systemTypeName, out ushort bundleId, out byte localId)`
- `TryCreateSystemByName(string systemTypeName, out NetworkSystem networkSystem)`
- `TryGetSystemName(Type systemType, out string systemTypeName)`
- `TryGetComponentName(Type componentType, out string componentTypeName)`
- `TryCreateComponentByName(string componentTypeName, out NetworkComponent networkComponent)`

`TryReturnSystem(NetworkSystem networkSystem)` returns a system to the pool its factory rented it from, found by its runtime type. Use it when you hold a system by its base type, for example one rented ahead of a spawn that never used it.

```csharp
if (NetworkTypeRegistry.TryGetSystemId(typeof(MySystem), out ushort bundleId, out byte localId))
{
    // bundleId/localId are the identity of MySystem.
}

if (NetworkTypeRegistry.TryCreateSystem(bundleId, localId, out NetworkSystem system))
{
    // system was rented from MySystem's pool.
}
```

## Declared compositions tell a receiver what the build could spawn

A composition is the set of component types named together at one spawn call site. Every distinct composition in the build is registered for you:

- `RegisterDeclaredComposition(params Type[] componentTypes)`
- `IsDeclaredComposition(List<uint> sortedComponentIds)`
- `GetComponentCompositionId(ushort bundleId, ushort localId)` returns the value that names a component in a composition check.

A receiver resolving a code-only spawn can refuse a composition the build never declares, since no legitimate call site could have produced it.
