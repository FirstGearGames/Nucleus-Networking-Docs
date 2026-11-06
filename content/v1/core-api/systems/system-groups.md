---
title: "System groups"
---

> **Using Unity?** See [Several systems on one object](../../unity/systems/grouped-systems.md).

A networked object is often several `NetworkSystem`s: a body, an inventory, a health pool. A group marks them as one object, so a receiver waits for the whole set before treating it as arrived, and `Despawn()` stops every member together. Members share a `GroupId`, read from `NetworkSystem.GroupId`; an ungrouped system carries `NetworkSystem.UnsetGroupId`.

## Build a group

`NetworkSystemGroup` is not replicated itself; it stamps a shared `GroupId` onto its members and spawns or despawns them together.

1. Initialize it before adding members. `Initialize` rents a fresh `GroupId`:

   ```csharp
   NetworkSystemGroup group = ...;
   group.Initialize(coreManager);
   ```

   A client predicting a spawn under a group id the server already leased to it uses `InitializeAdopted`, which stores that id instead of renting one:

   ```csharp
   group.InitializeAdopted(coreManager, groupId);
   ```

2. Add and remove members. Adding stamps the group's `GroupId` at once, whether or not the group has spawned.

   ```csharp
   group.AddSystem(bodySystem);
   group.AddSystem(healthSystem);
   group.RemoveSystem(healthSystem);
   ```

## Spawn and despawn the group

`Spawn()` starts every member not already started. Call it again after adding members and only the new ones start, so some systems can join the object later:

```csharp
group.Spawn();

// Later, once the player unlocks it:
group.AddSystem(inventorySystem);
group.Spawn();
```

`Spawn(networkSystem)` adds one system and starts it in one call:

```csharp
group.Spawn(inventorySystem);
```

`Despawn()` stops every member. Stopping one member with `SystemManager.EnsureStopSystem` stops only that member; the rest stay spawned.

```csharp
group.Despawn();
```

- A group always arrives as one object, even when it is wider than the per-tick budget, so a wide group can take more than one tick to arrive.
- Interest combines every member's despawn and stop votes, so one member out of range, or one member still wanted, can decide what happens to every member.

## Read the member count

`NetworkSystem.GroupMemberCount` is the number of systems in the group, or zero when ungrouped. On the server it is the live count. On a receiver it is the count received with the first member, which tells it how many systems to expect for that `GroupId`.

```csharp
uint expected = someSystem.GroupMemberCount;
```

## Set controller retention for the whole group

`NetworkSystemGroup.ControllerRetentionPolicyOverride` sets what happens to every member's controller when the controller leaves. A member's own `ControllerRetentionPolicyOverride` wins if set, then the group's, then the engine default. Setting it on the group keeps one object's systems from disagreeing.

```csharp
group.ControllerRetentionPolicyOverride = ControllerRetentionPolicy.Retain;
```

See [Controller retention](../control/controller-retention.md) for what `Release` and `Retain` do.

`INetworkSystemGroup` is a marker interface with no members.
