---
title: "Registering interest conditions"
---

> **Using Unity?** See [Network Interest Object](../../unity/interest/network-interest-object-component.md)

## Register a condition globally or on one system

`InterestManager.AddCondition` registers a condition for every `NetworkSystem` that starts from then on. Systems already started are not affected until they next start.

```csharp
coreManager.InterestManager.AddCondition(interestCondition);
```

`NetworkSystem.AddInterestCondition` registers a condition on one system only, such as a per-prefab rule:

```csharp
networkSystem.AddInterestCondition(interestCondition);
```

Both stack, and every condition can only restrict. `AddCondition` rejects a condition whose `Capabilities` is `InterestEffect.None` and logs an error. Register during setup; a condition registered mid-session reaches already-spawned objects only as they respawn.

## Remove a condition

`InterestManager.TryRemoveCondition` removes a global condition and returns `true` if it was registered. `NetworkSystem.TryRemoveInterestCondition` does the same for a system's own condition.

```csharp
bool wasRemoved = coreManager.InterestManager.TryRemoveCondition(interestCondition);
bool wasRemovedFromSystem = networkSystem.TryRemoveInterestCondition(interestCondition);
```

Systems already started keep a removed global condition until they next start. Removing the last condition of an effect leaves that effect's current resolution in place rather than restoring the default.

`InterestManager.HasConditions` is true while any condition is registered globally. It stays false in a world that uses only per-system conditions; that is not a fault.

## The engine registers the scene gate by default

`InterestManager.DefaultConditions` lists the conditions the engine registered itself, in registration order. It holds the scene spawn gate (`SceneManager.SpawnGate`), registered globally so a client only sees the contents of scenes it has loaded. The bundle gate (`BundleManager.SpawnGate`, Pro) is not registered by default: attach it globally or per prefab wherever bundle gating should apply. `DefaultConditions` is empty when the engine registered none.

To arbitrate everything yourself, call `RemoveDefaultConditions()`. It removes only the engine's conditions and returns how many it removed. Systems already started keep them until they next start.

```csharp
uint removedCount = coreManager.InterestManager.RemoveDefaultConditions();
```

## Show an object only to its controller

`ControllerOnlyInterestCondition` shows a system only to the client that controls it, for objects such as an inventory, a private quest log or a hand of cards:

```csharp
ControllerOnlyInterestCondition controllerOnlyInterestCondition = new();

inventorySystem.AddInterestCondition(controllerOnlyInterestCondition);
```

- It is a `Spawn` condition: other clients never hold the object, not even a stopped copy.
- When control moves, the next evaluation removes the object from the previous controller and spawns it for the new one.
- A group is answered as one object, so every member is shown to a client that controls any one of them.
- It holds no state, so one instance can be registered on any number of systems.

**Register it per system, never globally.** Registered with `AddCondition`, it hides every object no client controls, so every server-controlled object disappears from every client.

## Force a re-resolve after a teleport

Conditions are evaluated every `InterestManager.EvaluationCadenceTicks` ticks (5 by default). See [What area of interest is](./area-of-interest.md#conditions-are-evaluated-on-a-staggered-cadence). Ordinary movement needs nothing more.

For a move the cadence cannot anticipate, such as a teleport, a scene change or a reparent, call `RefreshInterest(NetworkSystem, isLevelOfDetailRemeasured)`. It re-resolves that system against every Connection at the start of the next pass:

```csharp
coreManager.InterestManager.RefreshInterest(networkSystem, isLevelOfDetailRemeasured: true);
```

`isLevelOfDetailRemeasured` defaults to `true`. Leave it set unless the object did not move.

For a change on the player's side, such as a teleported character, a newly controlled object or a scene move, call `RefreshInterest(Connection)`. It re-resolves that connection against every evaluated system:

```csharp
coreManager.InterestManager.RefreshInterest(connection);
```
