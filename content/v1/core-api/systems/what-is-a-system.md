---
title: "What a system is"
---

A `NetworkSystem` is what Nucleus replicates. The system is the identity and lifecycle; the replicated data lives in the `NetworkComponent` instances attached to it. The [NetworkSystem reference](./network-system.md) lists its identifiers, states and role reads.

## A system holds up to 31 components

Read a component with `TryGetComponent<T0>` and count them with `ComponentCount`. The limit is `NetworkSystem.MaximumComponentCount`.

```csharp
if (system.TryGetComponent<TransformComponent>(out TransformComponent transform))
{
    // transform is one of the components attached to this system.
}
```

Each component has a component Id: the order it was added in, starting at zero, and the same on every peer. `TryGetComponent<T0>(out T0)` returns the first component of a type. When a system carries one type several times, as a `NetworkTransform` replicating several parts does, reach each instance by its Id:

```csharp
for (byte componentId = 0; componentId < system.ComponentCount; componentId++)
{
    if (system.TryGetComponent(componentId, out TransformComponent part))
    {
        // part is the component added at position componentId, the same one on every peer.
    }
}
```

## A system does not need an engine object

A purely logical system, such as matchmaking state or a game rule tracker, can start, replicate and stop without any GameObject. In an engine integration, one engine object can link to several systems, each with its own `Id` and lifecycle. In Unity, the component that links an engine object to its system is a separate bridge, not the system itself.
