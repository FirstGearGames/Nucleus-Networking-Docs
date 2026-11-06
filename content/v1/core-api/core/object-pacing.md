---
title: "Object pacing"
---

> **Using Unity?** The budget is the **Maximum Object Kilobytes Per Tick** slider (1 to 255) under the **Object Pacing** header on the Unity Server Manager component. See [Manager components reference](../../unity/core/unity-manager-components.md).

Object pacing spreads a burst of new objects, such as a client joining a large world, a scene binding or a bundle releasing its withheld spawns, over several ordinary ticks instead of one huge one. A smaller tick is less likely to be lost, which matters most to a peer still joining, and the receiver's instantiation cost spreads over several frames.

This is a Pro feature. The Free edition does no pacing, ignores the settings below and has no **Object Pacing** header in Unity.

## Set a budget in kilobytes per client per tick

```csharp
coreManager.ServerManager.MaximumObjectKilobytesPerTick = 20;
```

`ServerManager.MaximumObjectKilobytesPerTick` is the most whole-object data, in kilobytes (1 kB is 1,024 bytes), that any one `Connection` is sent on a single tick. Whole objects are new objects (spawns) and objects a client is sent again whole after a loss. Ordinary updates to objects a client already holds are not paced. Whatever does not fit is sent on the following ticks, oldest first.

- `DefaultMaximumObjectKilobytesPerTick` is `50`.
- `MinimumObjectKilobytesPerTick` is `1`. A value below it is read as `1`.
- The widest budget is `255` kilobytes.
- `ServerManager.ObjectPacingEnabled` turns pacing on and off, and is on by default. Off, every whole object is sent on the tick it is owed, and objects still waiting are sent on the next tick.

## Choose a budget a client can take in one tick

Keep the budget times the tick rate under what the slowest client's connection carries in a second: at 30 ticks a second, 8 kilobytes a tick is about 240 kilobytes a second. Raise it for a fast LAN, or for a world of many small objects that should arrive faster. Lower it for slow links.

If `ConnectionsAwaitingSpawnAdmissionCount` sits near zero outside bursts (a join, a scene binding, a bundle release), ordinary play fits the budget. A stall warning in the log means the world spawns faster than the budget lets a peer receive: raise the budget or spawn less at once.

## Watch these counters

- `InterestManager.TotalSpawnsAdmitted` counts spawns sent to clients, once per connection a spawn was sent to.
- `InterestManager.TotalSpawnsDeferred` counts spawns that had to wait, once per connection when a system first waits, not again for each tick it waits.
- `InterestManager.ConnectionsAwaitingSpawnAdmissionCount` is how many connections are owed at least one waiting spawn.
- `Connection.SystemsAwaitingSpawnAdmissionCount` is one connection's backlog. It rises on a burst and falls each tick as the budget lets objects through.
- `InterestManager.SpawnAdmissionStallWarningTicks` (`90`) is how many ticks in a row a connection still owed spawns may receive none before the stall is logged.

Read `TotalSpawnsDeferred` against `TotalSpawnsAdmitted` as a ratio of how hard the budget is working, not as a count of objects still waiting; use the two awaiting counts for that. A world built from `NetworkSystemGroup`s reads high, because a grouped system always waits so its group can start whole, and is counted even when it starts on the next tick.

## Pacing keeps these promises

- **A group is never left half started.** A `NetworkSystemGroup` starts as a whole, even when the budget has room for only some of its members, and a group wider than the whole budget still starts, on a tick of its own. Its objects count against the budget as they are sent, so a wide group can take more than one tick to arrive. In Unity the object is announced once every member has arrived.
- **An object wider than the whole budget still arrives.**
- **A peer's own controlled object never waits.**
- **Objects sent again after packet loss share the budget,** so recovering from loss never arrives as one burst either.
- **A host's own client and emulated peers are never paced.**
- **A receiver cannot tell a paced spawn** from one that arrived late for any other reason.
