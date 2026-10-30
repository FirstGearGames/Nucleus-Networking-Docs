---
title: "Registering interest conditions"
---

> **Using Unity?** See [Network Interest Object](../../unity/interest/network-interest-object-component.md)

## Two registration routes

`InterestManager.AddCondition` registers a condition globally. It is folded onto each `NetworkSystem` when that system starts, not consulted per pair, so it governs everything spawned from here on and leaves what is already started alone:

```csharp
coreManager.InterestManager.AddCondition(interestCondition);
```

`NetworkSystem.AddInterestCondition` registers a condition against one system alone, a per-prefab rule as opposed to a world-wide one:

```csharp
networkSystem.AddInterestCondition(interestCondition);
```

Both stack, and every condition can only restrict. `AddCondition` rejects a condition whose `Capabilities` is `InterestEffect.None`, logging an error, because nothing would ever consult it.

The two routes meet when a system starts: the globals registered on the `InterestManager` are folded onto the system and sorted there, by the effects each condition declares, alongside whatever was registered on the system itself. Register during setup and the distinction never arises; register mid-session and the already-spawned world picks the rule up as its objects respawn.

## Removing conditions

`InterestManager.TryRemoveCondition` unregisters a globally registered condition and returns `true` when it was registered and removed. `NetworkSystem.TryRemoveInterestCondition` does the same for a system's own registration.

```csharp
bool wasRemoved = coreManager.InterestManager.TryRemoveCondition(interestCondition);
bool wasRemovedFromSystem = networkSystem.TryRemoveInterestCondition(interestCondition);
```

Systems already started keep the fold they took at spawn and drop it when they next start. Removing the last condition of an effect leaves that effect's current resolution in place rather than restoring the default.

`InterestManager.HasConditions` is true while any condition is registered globally. A world driving interest purely through per-system conditions registers nothing globally, and `HasConditions` correctly stays false — that is not a fault.

## Default conditions

`InterestManager.DefaultConditions` lists the conditions the engine registered on its own behalf, in registration order: the scene spawn gate (`SceneManager.SpawnGate`), registered globally so a client only ever sees the contents of a scene it has loaded. The bundle gate (`BundleManager.SpawnGate`, Pro) is not one of these: the engine leaves it unregistered, for the game to attach globally or per prefab wherever bundle gating should apply. `DefaultConditions` is empty for a peer whose engine registered none.

`RemoveDefaultConditions()` unregisters every one of them, leaving the game's own registrations alone, and returns the number removed:

```csharp
uint removedCount = coreManager.InterestManager.RemoveDefaultConditions();
```

It is the single call for a game that wants to arbitrate everything itself. Systems already started keep the fold they took at spawn and drop it when they next start, exactly as `TryRemoveCondition` does.

## Showing an object only to its controller

Some objects belong to one player alone: an inventory, a private quest log, a hand of cards. `ControllerOnlyInterestCondition` shows a system only to the client that controls it, so the object never reaches any other client at all:

```csharp
ControllerOnlyInterestCondition controllerOnlyInterestCondition = new();

inventorySystem.AddInterestCondition(controllerOnlyInterestCondition);
```

It is a `Spawn` condition: a client that does not control the object never holds it, rather than holding a stopped copy. When control moves, the next evaluation takes the object away from the previous controller and spawns it for the new one. A group is answered as one object, so every member of a group is shown to a client that controls any one of them. The condition holds no state, so one instance can be registered on any number of systems.

Register it per system. Registered globally with `AddCondition`, it scopes every object in the world, and a system no client controls is shown to no client, so every server-controlled object would disappear from every client.

## Evaluation cadence

`EvaluationCadenceTicks` controls how many ticks pass between evaluations of any one system's conditions. It defaults to 5. Systems are staggered across the cadence by their `Id`, so each tick evaluates roughly one cadence-th of the world rather than spiking the whole of it onto one tick.

A joiner and a newly started system are exceptions: a client that just authenticated is evaluated against every started system, and a system that just started is evaluated against every authenticated client, both off the cadence and on the tick the event happens, rather than waiting for the stagger slot to come around.

## Forcing a re-resolve

`RefreshInterest(NetworkSystem, isLevelOfDetailRemeasured)` re-resolves one system against every Connection at the head of the next pass, rather than when it next reaches its stagger slot:

```csharp
coreManager.InterestManager.RefreshInterest(networkSystem, isLevelOfDetailRemeasured: true);
```

Use it for a move the pass cannot anticipate: a teleport, a scene change, a reparent. Ordinary movement needs nothing, because the cadence is already measuring it. `isLevelOfDetailRemeasured` defaults to `true`; leave it set unless the object did not move.

`RefreshInterest(Connection)` is the other axis, for a change on the player's side rather than the object's: a client whose character was teleported, handed a different object to control, or moved to another scene.

```csharp
coreManager.InterestManager.RefreshInterest(connection);
```

It re-resolves the connection against every evaluated system, not the whole world, so a world with nothing to resolve pays nothing for asking.

## Registration timing

Registration as an observer waits on `Connection.CanReceiveState`, not just authentication. A client authenticates before its round trip time is known, and interest timing decisions are denominated in that figure, so a client authenticated before its link is measured is held back and registered the moment its round trip time is discovered — typically one round trip later, and immediately for a host's own client.
