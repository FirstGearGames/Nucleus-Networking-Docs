---
title: "What scales and what does not"
---

## Four levers cut replication cost

From largest saving to smallest:

1. **Don't send it at all.** An unmet `InterestEffect.Spawn` keeps a peer from ever holding an object it has no reason to see. Nothing is queued or sent.
2. **Stop sending it.** An unmet `InterestEffect.Stop` pauses replication to a peer that already holds the object, without removing it. The object still exists on the peer.
3. **Send it less often.** `SendInterval` paces a member's updates under `TransmissionMode.Interval`: `SendInterval.Normal` sends every changed tick, and a wider interval sends at most one update per interval. A member on `TransmissionMode.Divine` sets its own rate. A spawn, resync, recovery or reconcile always carries the current value.
4. **Send it smaller.** `TransmissionMode` and per-value compression shrink each write without removing any.

## Find which of three bottlenecks you have

"Replication is too expensive" is usually one of three problems, and fixing the wrong one does nothing.

- **Per-client egress:** how many bytes one peer's connection pushes per second, as `TotalBytesSent` and the per-object and state-only bandwidth stat providers measure. Fix it with spawn and stop culling first, then send interval and compression.
- **Per-tick burst size:** how much lands in a single tick. A join, a scene load, a bundle release or a peer walking back into range can put many spawns into one tick, and a large tick is costly to lose. `ServerManager.MaximumObjectKilobytesPerTick` (default 50) caps how many kilobytes of new objects one peer is sent per tick, so a large join arrives over several ticks. It does not lower the join's total cost or steady-state egress. A higher `GlobalRedundancy` makes a burst more expensive, because the extra bandwidth applies to the whole burst.
- **The resolution pass:** the server CPU spent deciding who sees what. Every registered `IInterestCondition` is evaluated per (system, Connection) pair every `InterestManager.EvaluationCadenceTicks`, so the cost grows with systems times connections however few pairs end up replicating. A world with no condition registered skips it. Cadence and staggering are the only levers.

## Read the counters before pulling a lever

The bandwidth counters (`TotalBytesSent`, `TotalBytesReceived`, `TotalStatePacketPayloadBitsSent`, `TotalStatePacketPayloadBitsReceived`) and the per-object and state-only stat provider rows show what a world costs. Every figure covers the whole peer, so a per-object number is an average: divide by object count, or use the per-object stat provider row, which does it for you. See [Network statistics](../diagnostics/network-statistics.md).

## These scaling features do not exist

Do not design a world around any of these:

- **No bandwidth cap on ordinary traffic.** Object pacing caps new objects per tick, but nothing caps the rest of a connection's traffic, and nothing decides what goes first when a peer falls behind.
- **No per-object send priority.** Every eligible object is served the same way.
- **No broadphase hook for interest.** An integration cannot hand the interest pass a pre-narrowed set of candidates. Every world uses the per-pair pass.

## Most levers are Pro-only

Distance and spatial-grid culling, level-of-detail interest and object pacing (`MaximumObjectKilobytesPerTick`) are Pro-only. Free has the broadcast-to-everyone default and the interest system without those conditions.

Pro also compresses values more tightly than Free. This is fixed by the edition that built the peer and cannot be toggled per world.

## Work out a budget for a small world

Take 50 objects, each with one `NetworkMember` sending every tick at `SendInterval.Normal`, replicated to 20 connections.

- **Egress:** each connection carries its own 50 objects' updates per tick, so per-connection egress grows with the number of objects it can see.
- **Resolution pass:** one distance condition means 50 × 20 = 1,000 pair evaluations every `EvaluationCadenceTicks`. A cadence of 1 runs all 1,000 every tick. A cadence of 10 spreads them to about 100 per tick, at the cost of verdicts up to 10 ticks old.
- **Join burst:** a joining peer is owed all 50 spawns at once. Fifty small objects fit inside the default 50 kB budget, so pacing never engages.

This world does not need any lever pulled yet.
