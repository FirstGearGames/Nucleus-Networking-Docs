---
title: "System groups"
---

> **Using Unity?** See [Several systems on one object](../../unity/systems/grouped-systems.md).

## Why groups exist

A networked object is often more than one `NetworkSystem`: a body, an inventory, a health pool. Each is spawned, replicated, and despawned independently unless something ties them together. A group does that tying: it marks several systems as belonging to the same object so a receiver waits for the whole set before treating the object as arrived, and a despawn on any one member takes the rest with it.

Membership is carried on the wire as a shared `GroupId`, read from `NetworkSystem.GroupId`. A system with no group carries `NetworkSystem.UnsetGroupId`. Nothing about a group is visible on an ungrouped system beyond that unset id.

## NetworkSystemGroup

`NetworkSystemGroup` is the object you build a group with. It is not itself replicated; it is host-side bookkeeping that stamps a shared `GroupId` onto its members and spawns or despawns them together.

Initialize it before adding members:

```csharp
NetworkSystemGroup group = ...;
group.Initialize(coreManager);
```

`Initialize` rents a fresh `GroupId` from the `SystemManager`. A client predicting a spawn under a group id it did not rent itself — because the server already leased one and told the client what it is — uses `InitializeAdopted` instead, which stores the given id rather than renting a new one:

```csharp
group.InitializeAdopted(coreManager, groupId);
```

Add and remove members with `AddSystem` and `RemoveSystem`:

```csharp
group.AddSystem(bodySystem);
group.AddSystem(healthSystem);
group.RemoveSystem(healthSystem);
```

Adding a system stamps it with the group's `GroupId` immediately, whether or not the group has spawned yet.

### Spawning and despawning

`Spawn()` starts every member that is not already started. Call it again after adding more members and only the new ones start — this is how a group spawns some systems up front and others later onto the same networked instance:

```csharp
group.Spawn();

// Later, once the player unlocks it:
group.AddSystem(inventorySystem);
group.Spawn();
```

`Spawn(networkSystem)` is the single-member shortcut: it adds the system to the group and starts it in one call.

```csharp
group.Spawn(inventorySystem);
```

`Despawn()` stops every member the group holds. A group despawn always cascades to the whole set; there is no per-system despawn through the group.

```csharp
group.Despawn();
```

## Reading membership

`NetworkSystem.GroupMemberCount` reports how many systems the group holds. On the server it reads the group's live member count, so it grows as members are added. On a receiver, which builds no `NetworkSystemGroup` of its own, it reports the count carried on the full header the first member arrived with.

That received count is what lets a receiver wait for the whole set instead of acting the moment the first member shows up: it knows how many systems to expect for a given `GroupId` before it treats the object as fully arrived.

```csharp
uint expected = someSystem.GroupMemberCount;
```

`GroupMemberCount` is zero for an ungrouped system.

## Controller retention

`NetworkSystemGroup.ControllerRetentionPolicyOverride` sets what happens to every member's controlling identity when the controller leaves, for the whole group at once. It is resolved less specifically than a system's own `ControllerRetentionPolicyOverride`: a member's own override wins if set, then the group's, then the engine default. Setting it on the group is how the systems making up one object are kept from disagreeing with each other about retention.

```csharp
group.ControllerRetentionPolicyOverride = ControllerRetentionPolicy.Retain;
```

What `Release` and `Retain` actually do is covered where controller retention itself is documented.

## Group-wide behavior elsewhere

Two other parts of the engine treat a group as a single unit rather than repeating this page's material:

- Spawn pacing admits a group whole rather than splitting it across ticks, even past the per-tick spawn ceiling.
- Interest resolution folds each member's despawn and stop votes across the whole group, so one member out of range or one member still wanted is enough to decide the fate of every member.

## INetworkSystemGroup

`INetworkSystemGroup` exists as a marker interface. As of this writing it declares no members — it names the concept of "a group" without yet defining a contract for it.
