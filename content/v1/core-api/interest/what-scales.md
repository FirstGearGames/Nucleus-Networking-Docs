---
title: "What scales and what does not"
---

## The four levers

There are four ways to spend less on replication, and they save different amounts because they cut at different points in the pipeline.

**Don't send it at all.** `InterestEffect.Spawn` governs whether a Connection is ever made an observer of a system in the first place. A condition that vetoes spawn keeps a peer from ever holding an object it has no reason to see. This is the cheapest lever there is: nothing is queued and nothing is sent.

**Stop sending it.** `InterestEffect.Stop` pauses replication to a peer that already holds the object without reclaiming it client-side. Cheaper than a fresh spawn later, but the object still exists on the peer and still occupies whatever bookkeeping a held object costs.

**Send it less often.** `SendInterval` paces a member's updates: `SendInterval.Normal` sends every changed tick, and a wider interval accumulates changes and sends at most one update per interval. This only applies under `TransmissionMode.Interval`; a member on `TransmissionMode.Divine` governs its own rate instead. A spawn, resync, recovery or reconcile always carries the current value regardless of the interval, so this lever never affects the moments that matter most.

**Send it smaller.** `TransmissionMode` and per-value compression level shrink each individual write without changing how often it happens. This is the smallest saving of the four, because it doesn't remove a send, a tick, or a peer's membership — it just makes the send that was already happening cost less.

## Three different bottlenecks

"Replication is too expensive" is not one problem. It's usually one of three, and each has its own fix.

**Per-client egress.** How many bytes one peer's connection pushes per second. This is what `TotalBytesSent` and the per-object/state-only bandwidth stat providers measure. The fix is fewer or smaller sends to that peer: spawn/stop culling first, interval and compression second.

**Per-tick burst size.** How much of that egress lands in a single tick rather than spread across several. A join, a scene load, a bundle release, or a peer walking back into range can put every system's spawn into one tick, and a large tick is costly to lose. `InterestManager.MaximumSpawnsPerTick` (default 500, 0 for unlimited) is the lever here. It caps how many objects one peer is given in a single tick, so a large join arrives over a few ticks instead of all at once. It does not lower what the join costs in total, and it does nothing for steady-state egress; a world under the ceiling never touches it.

**The O(systems × connections) resolution pass.** How much work the server itself does deciding who sees what, independent of what gets sent. Every registered `IInterestCondition` is evaluated per (system, Connection) pair on `InterestManager.EvaluationCadenceTicks`, and that cost scales with systems times connections regardless of how few of those pairs end up replicating. A world with no condition registered skips evaluation entirely and replicates broadcast-to-everyone. A world with conditions pays the evaluation cost even for pairs that resolve to "don't spawn." This is a CPU-time bottleneck, not a bandwidth one, and cadence/staggering is the only lever the engine currently has for it.

Fixing the wrong one does nothing: pacing spawns doesn't lower steady-state egress, and shrinking each send doesn't stop a burst from landing in one tick.

## Reading the cost you have

The bandwidth counters (`TotalBytesSent`, `TotalBytesReceived`, `TotalStatePacketPayloadBitsSent`, `TotalStatePacketPayloadBitsReceived`) and the per-object/state-only stat provider rows are how you read what a world is actually costing, before deciding which lever to pull. Every one of these figures covers the whole peer — total traffic for that connection, not a single object's line item — so a per-object number is a derived average, not something counted directly. Divide by object count yourself, or use the shipped per-object stat provider row, which already does it. How those counters are wired up and sampled is covered under Diagnostics; this page is about which lever their numbers point you toward.

## Burst versus steady state

A spike on a join and a steady per-tick overspend are different failures with different fixes. A join spike is bounded and temporary: it costs frames and, if unpaced, risks losing a whole wide tick; the fix is `MaximumSpawnsPerTick`, and it doesn't touch what the world costs once everyone has finished joining. A steady overspend is what egress and resolution-pass measurements are for, and its fix is spawn/stop culling or interval/compression tuning, not pacing.

Redundancy makes a burst worse than it looks. A higher `GlobalRedundancy` buys better tolerance of packet loss at the cost of extra bandwidth, and a burst pays that extra on its whole size, on top of the ordinary traffic running alongside it. This is the concrete reason pacing a burst is worth doing even though it doesn't move the steady-state number: a wide, unpaced tick multiplies its own cost, and a paced one doesn't.

## What the engine does not have

Don't design a world around any of these — none of them exist:

- **No per-connection byte-budget scheduler.** There's no cap on how many bytes a peer's connection may spend per tick, and no priority or staleness scheduling deciding what gets sent first when a peer is behind. The spatial grid and per-connection spawn pacing exist; a bandwidth cap does not.
- **No per-object send priority.** Nothing lets you mark one object as more urgent than another when a peer is bandwidth-constrained. Every eligible object is served the same way.
- **No broadphase seam for interest.** There's no hook letting an integration hand the interest pass a pre-narrowed candidate set; evaluation is the O(systems × connections) pass described above for every world. The spatial grid narrowing that exists today is internal to distance/grid conditions, not an integration seam.

## Edition effects on the budget

Several of the levers above only exist in Pro: distance and spatial-grid interest culling (the conditions that drive `InterestEffect.Spawn`/`Stop`), level-of-detail interest, and per-connection spawn pacing (`MaximumSpawnsPerTick`) are all Pro-only. Free still has the four-lever framework and the broadcast-to-everyone default, but the conditions that make spawn/stop culling and burst pacing possible are Pro.

Compression is the other edition split. Pro compresses values more tightly than Free. It is not something you can toggle per world; it is fixed by which edition built the peer.

## A worked budget for a small world

Say a world has 50 objects, each with one `NetworkMember` sending a full-precision value every tick at `SendInterval.Normal`, replicated to 20 connections.

Steady-state egress, ignoring redundancy: 50 objects × 20 connections = 1,000 per-peer-per-tick sends. If each update costs roughly the same regardless of which peer receives it, the total is 20 connections' worth of "50 objects' updates per tick" — the per-connection egress is what scales with object count, not the total across all connections, because each connection only ever carries its own 50-object slice.

Resolution-pass cost, if you add one distance condition: 50 systems × 20 connections = 1,000 pair evaluations every `EvaluationCadenceTicks` ticks. At a cadence of 1 that's 1,000 evaluations/tick; staggering it across a cadence of, say, 10 spreads that to roughly 100 evaluations on any given tick, at the cost of resolving each pair up to 10 ticks stale.

Burst size on a join: a joining peer is registered against every started system at once — all 50 objects' spawns land on one tick unless spawn pacing caps it. At the default `MaximumSpawnsPerTick` of 500, a 50-object world never touches the ceiling; the burst is whatever 50 spawns cost, in one tick, with no pacing needed. That ceiling only starts mattering once system count times joining-peer count starts approaching it — this world is nowhere close.

The arithmetic is the budget: egress scales with objects × connections that can see them, the resolution pass scales with objects × connections regardless of visibility, and burst size scales with objects per joining peer against the pacing ceiling. Three different multiplications, three different levers, and a 50-object/20-connection world doesn't need any of them pulled yet.
