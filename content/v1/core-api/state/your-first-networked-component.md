---
title: "Your first networked component"
---

> **Using Unity?** See [Replicating a value from a Unity script](../../unity/state/replicated-values-in-unity.md).

## Declare the component

A networked component is a `partial class` that inherits `NetworkComponent` and declares `readonly NetworkMember<T0>` fields:

```csharp
public partial class SimpleStateComponent : NetworkComponent
{
    public readonly NetworkMember<int> Counter = new();
}
```

`partial` is required. Nucleus generates the rest of the type, including a flags enum with one bit per member in member-Id order. Without `partial`, the component never replicates anything.

Add a field for each value. Each gets its own Id and its own bit in the flags enum.

## Rent a system that carries it

A component lives on a `NetworkSystem`. `NetworkSystemPool.TryRent` takes the system type and one type argument per component, and returns a started system through its `out` argument. It returns `false` when no `CoreManager` was found or the start was refused:

```csharp
if (!NetworkSystemPool.TryRent<NetworkSystem, SimpleStateComponent>(coreManager, out NetworkSystem? system, canStartSystem: true))
    return;

system.TryGetComponent(out SimpleStateComponent component);
component.Counter.Value = 31337;
```

`canStartSystem` defaults to `true`. Pass `false` to start the system yourself later. A system rented this way has no engine object: it is plain C# on both peers.

## Find it on the other peer

A system rented from code has `PlatformId` `NetworkSystem.UnsetPlatformId`, so no spawn handler hears about it (`INetworkSystemSpawnHandler.OnDynamicSystemSpawned` is not called). Use `NetworkSystemPool.Watch` instead. It hands your handler every system with the given system type and component types, as each starts locally or arrives:

```csharp
NetworkSystemWatch watch = NetworkSystemPool.Watch<NetworkSystem, SimpleStateComponent>(
    coreManager,
    acquiredSystem =>
    {
        acquiredSystem.TryGetComponent(out SimpleStateComponent component);
        int value = component.Counter.Value;
    })!;
```

The match is on the components a system carries, not its exact type: any `NetworkSystem` or subclass carrying a `SimpleStateComponent` matches, whatever else it carries. A watch for a plain `NetworkSystem` with no component arguments matches every system.

Call `NetworkSystemPool.Unwatch(watch)` when you are done. `Watch` also takes an optional released handler, called when a matched system stops. For a system that arrived over the network, that means it is about to return to its pool, so drop any reference to it before the handler returns.

## Read and write the value

`NetworkSystem.TryGetComponent<T0>` gets a component from a system on either peer:

```csharp
if (system.TryGetComponent(out SimpleStateComponent component))
{
    component.Counter.Value = 42;   // write: only meaningful on the system's writer
    int current = component.Counter.Value;  // read: always safe
}
```

Setting `Value` marks the member changed this tick and queues it to send. On a peer that does not write the system, `Value` is the last value received.

## Do not call the generated overrides

`NetworkComponent` declares `Write`, `WriteDelta`, `Read`, `ReadDelta`, `Initialize`, `Deinitialize` and `OnReturn` as `public virtual`. Nucleus implements the first four from your fields, and calls `Initialize` on rent and system start, `Deinitialize` on system stop, and `OnReturn` on return to the pool. Do not call any of them.

To react to a value changing, override `OnMembersChanged`. See [Reacting to changes: OnMembersChanged](./change-callbacks.md).
