---
title: "Spawn pacing"
---

## The problem

A tick's outbound to a connection is one MTU-segmented combined stream. A receiver can only read it once every segment has arrived, so losing one segment costs the whole tick. Redundancy multiplies that loss rather than avoiding it. An unpaced world spawns every system it can as soon as interest admits it, which means the biggest ticks — a client joining a large world, a scene binding, a bundle releasing a world's worth of withheld spawns — land exactly on the peer least able to absorb them: one still building its connection, with nothing yet to fall back on.

Spawn pacing turns that one enormous tick into several ordinary ones. Each is complete and recoverable on its own, and the receiver's instantiation cost spreads over several frames instead of landing in one.

This is a Pro feature.

## The ceiling

`InterestManager.MaximumSpawnsPerTick` is the most `NetworkSystem`s that may begin replicating to any one `Connection` on a single tick. Spawns beyond it are admitted on the ticks that follow, oldest first.

- `DefaultMaximumSpawnsPerTick` is `500`.
- `UnlimitedSpawnsPerTick` is `0` — set the ceiling to this and nothing is paced; every spawn is admitted on the tick it resolves, exactly as Free behaves.

The ceiling is per connection, because what it bounds is one peer's tick. It is measured per state flush, not per tick: everything admitted between two flushes rides the same combined stream regardless of how many loop steps it arrived over.

```csharp
interestManager.MaximumSpawnsPerTick = 200;
```

## Reading the queue

- `InterestManager.TotalSpawnsAdmitted` — spawns this peer has admitted to its clients, counting each system once per connection it was admitted to.
- `InterestManager.TotalSpawnsDeferred` — the running deferral count.
- `InterestManager.ConnectionsAwaitingSpawnAdmissionCount` — how many connections are currently owed at least one deferred spawn. Zero in a world that never reaches the ceiling, which is where a well-tuned ceiling spends nearly all of its time.
- `Connection.SystemsAwaitingSpawnAdmissionCount` — the backlog for one connection: it rises on a burst and falls by at most `MaximumSpawnsPerTick` each tick until that peer holds the world.
- `InterestManager.SpawnAdmissionStallWarningTicks` (`90`) — how many consecutive drains may admit nothing to a connection that is still owed spawns before the stall is logged. A backlog only stalls when the whole of every tick's budget is going to spawns resolved ahead of it — the world is spawning faster than the ceiling lets that peer receive.

`TotalSpawnsDeferred` counts deferrals, not deferred systems: every resolution pass that re-checks a still-queued system and defers it again adds to the count. A world built out of `NetworkSystemGroup`s reads high here by construction, because a group re-checks and re-defers as one unit on every pass its members are re-resolved. Read `TotalSpawnsDeferred` against `TotalSpawnsAdmitted` as a ratio — how hard the ceiling is working — not as a count of objects still waiting; use `ConnectionsAwaitingSpawnAdmissionCount` and `Connection.SystemsAwaitingSpawnAdmissionCount` for that.

## Correctness rules

- **A group is admitted whole.** A `NetworkSystemGroup` is queued and admitted together, even when the ceiling has budget free for only some of its members. Splitting a group across ticks would hand the receiver half an object — the one state the interest cull deliberately never produces. If a group's member count exceeds `MaximumSpawnsPerTick`, it is still admitted whole rather than starved forever, and the manager logs a warning naming the group.
- **A peer's own controlled object never waits.** The system a connection controls skips the queue's arithmetic, including any group it belongs to — a client that cannot act on its own object for several ticks is worse than any tick pacing saves.
- **A peer that already holds the object is never withheld.** Re-priming an existing observer is not a spawn, so the ceiling never defers it.
- **A host's own client is never paced**, nor is an emulated peer — there is no wire and no segmented stream to protect for a loopback connection.
- **Nothing on the wire says a spawn waited.** A paced batch is an ordinary state tick; a receiver cannot tell a paced spawn from one that arrived late for any other reason. Pacing is a sender-side policy only.

## Choosing a ceiling

Measure a real join or scene load's peak spawns-per-tick before and after setting `MaximumSpawnsPerTick`, rather than guessing a number. Set the ceiling above what ordinary play spawns at once, so pacing engages only on the bursts that would otherwise have cost a whole tick — a join, a scene binding, a bundle release — and leaves normal spawning untouched. If `ConnectionsAwaitingSpawnAdmissionCount` sits near zero outside those bursts, the ceiling is sized correctly; a stall warning in the log means it is set below what the world spawns and needs raising.

## Unity

In the Unity integration, this ceiling is the **Maximum Spawns Per Tick** field on the Unity Interest Manager component — see [Unity Interest Manager component](/unity/interest/unity-interest-manager-component).
