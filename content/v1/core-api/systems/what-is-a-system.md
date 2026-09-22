---
title: "What a system is"
---

## The replicated unit

A `NetworkSystem` is the thing Nucleus replicates. It is not a data container itself — the data lives in the `NetworkComponent` instances attached to it. A system can hold up to 64 components, and you read them back with `TryGetComponent<T0>` or check how many are attached with `ComponentCount`.

```csharp
if (system.TryGetComponent<TransformComponent>(out TransformComponent transform))
{
    // transform is one of the components attached to this system.
}

int attached = system.ComponentCount;
```

Think of the system as the identity and lifecycle; the components are the fields that get serialized onto the wire.

## Lifecycle

Every system moves through the same four states, exposed as `NetworkSystemState`:

- `Starting` — accepted but not yet live.
- `Started` — networked and usable.
- `Stopping` — a stop has been accepted but the tick has not ended yet.
- `Stopped` — not networked.

Read the current state through `NetworkSystem.State`, or use the shortcut `IsStarted`, which is true only while `State` is `Started`.

```csharp
if (system.IsStarted)
{
    // safe to read replicated component data here.
}
```

A start accepted after the tick's state flush stays at `Starting` until the next tick begins; during that window `Id` is still unset.

## Identifiers

A system carries several identifiers, and each answers a different question:

- **`Id`** — the network identity: which system this is, unique across the network. `UnsetId` is 0, and a system reads this as unset until it actually starts.
- **`PlatformId`** — which prefab, or which scene object, this system is linked to on the running platform. `UnsetPlatformId` is 0, which is also what a system with no engine object carries — a plain system never sets this.
- **`PrefabBundleId`** — the content bundle that owns the prefab named by `PlatformId`. Only meaningful for a dynamically spawned prefab; a scene object doesn't use it.
- **`GroupId`** — the `NetworkSystemGroup` this system belongs to, or unset if it isn't grouped.
- **`ParentId`** — the `Id` of the system this one is parented to (a crate riding a vehicle, a weapon in a hand), or `UnsetParentId` if it sits at the root of its scene.
- **`SceneHandle`** — the live scene instance the system belongs to, or `UnsetSceneHandle` if it belongs to whatever scene the peer booted into rather than one the authority opened.
- **`IsSceneObject`** — true when `PlatformId` identifies a scene object that already exists on every peer, rather than a prefab a receiver must instantiate.

## Role reads

Every system carries three reads for what role the local peer is playing: `IsServerStarted`, `IsClientStarted`, and `IsHostStarted`. These answer "is the server/client/host running here", not "do I control this object" — for control questions, use `IsController(ControllerType)` instead.

## Systems and engine objects

A `NetworkSystem` does not need an engine object at all — a purely logical system (matchmaking state, a game rule tracker) can start, replicate, and stop without ever touching a GameObject or any other engine construct.

In an engine integration, one engine object can link to several systems at once, each with its own `Id` and lifecycle, all driven by the same underlying object.

## Vocabulary

A `NetworkSystem` is a system, not a "networked GameObject." In the Unity integration, the marker component that links an engine object to its system is a separate thing — a small bridge, not the system itself.
