---
title: "Your first networked component"
---

> **Using Unity?** See [Replicating a value from a Unity script](../../unity/state/replicated-values-in-unity).

## Declare the component

A networked component is a `partial class` inheriting `NetworkComponent`, with one or more `readonly NetworkMember<T0>` fields:

```csharp
public partial class SimpleStateComponent : NetworkComponent
{
    public readonly NetworkMember<int> Counter = new();
}
```

The `partial` keyword is not optional. A source generator scans the class for its `NetworkMember<T0>` fields and emits the other half of the type: `Write`, `WriteDelta`, `Read`, `ReadDelta`, and a per-component flags enum with one bit per member, in member-Id order. Without `partial` there is nowhere for that generated code to attach, and the component never serializes anything.

Add more fields for more state; each gets its own bit in the generated flags enum and its own Id within the component.

## Rent a system that carries it

A `NetworkComponent` doesn't exist on its own; it lives on a `NetworkSystem`. `NetworkSystemPool.Rent` takes the system type and one type argument per component it should carry, and returns a started system:

```csharp
NetworkSystem system = NetworkSystemPool.Rent<NetworkSystem, SimpleStateComponent>(coreManager, canStartSystem: true)!;

system.TryGetComponent(out SimpleStateComponent component);
component.Counter.Value = 31337;
```

`canStartSystem` defaults to `true`. Renting starts the system immediately unless you pass `false`, in which case you start it yourself later. A system rented this way carries no engine object at all - it's pure C# on both sides of the wire.

## Find it again on a peer

A system rented purely from code reaches the other peer as a bare wire spawn: its `PlatformId` is `NetworkSystem.UnsetPlatformId`, so it never reaches a spawn handler (`INetworkSystemSpawnHandler.OnDynamicSystemSpawned` is not called for it). There's no engine object to have hung a reference off in advance, so nothing on the receiving peer already knows this system exists.

`NetworkSystemPool.Watch` is how you find it anyway. It registers a standing subscription for every system of a given composition - a system type plus a set of component types - and hands each matching system to your handler as it starts locally or arrives over the wire:

```csharp
NetworkSystemWatch watch = NetworkSystemPool.Watch<NetworkSystem, SimpleStateComponent>(
    coreManager,
    acquiredSystem =>
    {
        acquiredSystem.TryGetComponent(out SimpleStateComponent component);
        int value = component.Counter.Value;
    })!;
```

The match is on composition, not on type identity: any `NetworkSystem` (or subclass) carrying a `SimpleStateComponent` satisfies this watch, regardless of what else it carries. That's why the type argument list matters - a watch for a plain `NetworkSystem` with no component arguments would match every system in the world.

Call `NetworkSystemPool.Unwatch(watch)` when you no longer need it. An optional released handler on `Watch` fires when an acquired system stops, which for a wire-constructed system means it's about to return to its pool - drop any reference you took before that call returns.

## Read the value back

`NetworkSystem.TryGetComponent<T0>` is how you get a component off a system, on either peer:

```csharp
if (system.TryGetComponent(out SimpleStateComponent component))
{
    component.Counter.Value = 42;   // write - only meaningful on the system's writer
    int current = component.Counter.Value;  // read - always safe
}
```

Setting `Value` marks the member changed for the current tick and queues it for the next delta. Reading `Value` returns whatever the ring's live head currently holds, which on a non-writing peer is the last value applied from the wire.

## The overrides you don't call

`NetworkComponent` declares `Write`, `WriteDelta`, `Read`, `ReadDelta`, `Initialize`, `Deinitialize`, and `OnReturn` as `public virtual`. The source generator overrides `Write`/`WriteDelta`/`Read`/`ReadDelta` for you from your `NetworkMember<T0>` fields, and the framework calls `Initialize`/`Deinitialize`/`OnReturn` at the points in a component's lifecycle where they apply - rent and system-start, system-stop, and pool-return, respectively.

None of these are yours to call. They exist for the generator to fill in and for the framework to invoke on its own schedule. If you need to react to a value changing, override `OnMembersChanged` instead - it's called once per tick per direction whenever any member of the component changed, and it's the supported hook for reacting without polling.
