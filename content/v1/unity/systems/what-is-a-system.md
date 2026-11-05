---
title: "What a system is"
---

> **Driving the core API directly?** See [What a system is](../../core-api/systems/what-is-a-system.md) and the [NetworkSystem reference](../../core-api/systems/network-system.md), which list a system's identifiers, states and role reads.

A `NetworkSystem` is what Nucleus replicates. The system is the identity and lifecycle; the replicated data lives in the `NetworkComponent` instances attached to it, up to 31 per system (`NetworkSystem.MaximumComponentCount`).

## A GameObject links to its systems through NetworkSystemObject

In Unity, the [NetworkSystemObject](./network-system-object.md) component links a GameObject to its systems. It is a bridge, not the system itself. One GameObject can link several systems, each with its own `Id` and lifecycle. A system does not need a GameObject: a purely logical system, such as matchmaking state or a game rule tracker, can start, replicate and stop without one.

## Read a system's components

`TryGetComponent<T0>` returns the first component of a type, and `ComponentCount` says how many are attached:

```csharp
if (system.TryGetComponent<TransformComponent>(out TransformComponent transform))
{
    // transform is one of the components attached to this system.
}

int attached = system.ComponentCount;
```

Each component has a component Id: the order it was added in, starting at zero, and the same on every peer. When a system carries one type several times, as a `NetworkTransform` replicating several parts does, reach each instance by its Id:

```csharp
for (byte componentId = 0; componentId < system.ComponentCount; componentId++)
{
    if (system.TryGetComponent(componentId, out TransformComponent part))
    {
        // part is the component added at position componentId, the same one on every peer.
    }
}
```

## Check the state before reading data

`IsStarted` is true only while `NetworkSystem.State` is `Started`. A start accepted late in a tick stays `Starting`, with its `Id` unset, until the next tick.

```csharp
if (system.IsStarted)
{
    // safe to read replicated component data here.
}
```

`IsServerStarted`, `IsClientStarted` and `IsHostStarted` answer whether the server, client or host is running on this peer, not whether this peer controls the object. For control, use `IsController(ControllerType)`.
