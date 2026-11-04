---
title: "Object pacing"
---

## An unpaced world sends its biggest tick to the peer least able to take it

A tick's update to a connection arrives whole or not at all, so the bigger the tick, the more likely it is to be lost. An unpaced world sends every new object as soon as interest allows it, which means the biggest ticks (a client joining a large world, a scene binding, a bundle releasing a world's worth of withheld spawns) land exactly on the peer least able to absorb them: one still building its connection, with nothing yet to fall back on.

Object pacing turns that one enormous tick into several ordinary ones. Each is complete and recoverable on its own, and the receiver's instantiation cost spreads over several frames instead of landing in one.

This is a Pro feature. The Free edition does no pacing and ignores the setting below.

## The budget is a number of kilobytes per client per tick

`ServerManager.MaximumObjectKilobytesPerTick` is the most whole-object data, in kilobytes (1 kB is 1,024 bytes), that any one `Connection` is sent on a single tick. Whole objects are new objects (spawns) and objects a client is sent again whole after a loss. Ordinary updates to objects a client already holds are not paced. Whatever does not fit is sent on the ticks that follow, oldest first.

- `DefaultMaximumObjectKilobytesPerTick` is `50`.
- `MinimumObjectKilobytesPerTick` is `1`. A value below it is read as `1`, so pacing cannot be switched off.
- The setting is a `byte`, so the widest budget it can hold is `255` kilobytes.

The budget is per connection, because what it bounds is one peer's tick.

```csharp
coreManager.ServerManager.MaximumObjectKilobytesPerTick = 20;
```

## These counters show how hard pacing is working

- `InterestManager.TotalSpawnsAdmitted` counts the spawns this peer has sent to its clients, once for each connection a spawn was sent to.
- `InterestManager.TotalSpawnsDeferred` counts the spawns that have had to wait.
- `InterestManager.ConnectionsAwaitingSpawnAdmissionCount` is how many connections are currently owed at least one waiting spawn. It is zero in a world that never fills the budget, which is where a well-tuned budget spends nearly all of its time.
- `Connection.SystemsAwaitingSpawnAdmissionCount` is the backlog for one connection. It rises on a burst and falls each tick as the budget lets objects through, until that peer holds the world.
- `InterestManager.SpawnAdmissionStallWarningTicks` (`90`) is how many ticks in a row a connection that is still owed spawns may receive none before the stall is logged. A stall means the world is spawning faster than `MaximumObjectKilobytesPerTick` lets that peer receive.

`TotalSpawnsDeferred` counts deferrals, not deferred systems: a system is counted once per connection when it first has to wait, not again on each tick it waits through. A world built out of `NetworkSystemGroup`s reads high here by construction, because a grouped system always waits so its group can start whole, and so counts here even on a tick where it starts straight afterwards. Read `TotalSpawnsDeferred` against `TotalSpawnsAdmitted` as a ratio of how hard the budget is working, not as a count of objects still waiting; use `ConnectionsAwaitingSpawnAdmissionCount` and `Connection.SystemsAwaitingSpawnAdmissionCount` for that.

## Pacing keeps these promises

- **A group is never left half started.** A `NetworkSystemGroup` starts replicating as a whole, even when the budget has room for only some of its members, and a group wider than the whole budget still starts, on a tick of its own. Its objects then count against the budget as they are sent, so a wide group can take more than one tick to arrive. In Unity the object is announced once every member has arrived.
- **An object wider than the whole budget still arrives.** No budget makes a tick smaller than the widest object it carries.
- **A peer's own controlled object never waits.** The object a connection controls is never held back.
- **Objects sent again after packet loss share the budget.** Whatever a client has to be sent again counts against the same budget, so recovering from loss never arrives as one huge burst either.
- **A host's own client is never paced.** Neither is an emulated peer, because a loopback connection has no network link to protect.
- **A receiver is never told that a spawn waited.** A receiver cannot tell a paced spawn from one that arrived late for any other reason. Pacing is a sender-side policy only.

## Choose a budget a client can take in one tick

Keep the budget low enough that one tick's worth of new objects arrives comfortably. Raise it for a fast LAN, or for a world of many small objects that should arrive faster. Lower it for slow links. As a guide, the budget times the tick rate should stay under what the slowest client's connection carries in a second: at 30 ticks a second, 8 kilobytes a tick is about 240 kilobytes a second. If `ConnectionsAwaitingSpawnAdmissionCount` sits near zero outside the bursts pacing exists for (a join, a scene binding, a bundle release), ordinary play fits inside the budget. A stall warning in the log means the world spawns faster than the budget lets a peer receive: raise the budget or spawn less at once.

## In Unity this budget is an inspector field

In the Unity integration, this budget is the **Maximum Object Kilobytes Per Tick** slider under the **Object Pacing** header on the Unity Server Manager component. The slider runs from `1` to `255`. In the Free edition the header and the field are absent, and every whole object is sent on the tick it is owed. See [Manager components reference](../../unity/core/unity-manager-components.md).
