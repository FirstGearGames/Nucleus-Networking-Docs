---
title: "What area of interest is"
---

## The default

Without any interest condition registered, Nucleus replicates every started NetworkSystem to every authenticated client, every tick. This is the broadcast-to-everyone default, and it is not something interest opts you into: it is what the engine does before interest exists at all.

Interest layers restriction over that default. It never grants a connection anything the default did not already give it. Register no condition anywhere and the evaluation pass does nothing at all - it costs one comparison per tick and stops.

## Conditions only restrict

An `IInterestCondition` returns an `InterestResult` carrying an `InterestOpinion` for each effect it declared in its `Capabilities`. That opinion is one of three values: `None` (no opinion, leave it to the others), `Unmet` (veto the effect for this pair), or `Met` (satisfied, no restriction).

`None` is the fold identity. The resolver combines every stacked condition's opinion with a fold equivalent to AND, so an abstaining condition never fights another condition's verdict. Only `Unmet` ever restricts anything; `Met` and `None` are indistinguishable to the resolution and differ only in what the condition means to say. Nothing a condition returns can push a connection past the streamed default - the whole vocabulary is restriction.

Conditions can be registered globally on the `InterestManager`, covering every system that starts from then on, or per-system through the system's own registration. Both stack, and the most restrictive verdict per effect wins across all of them.

## Resolution is per pair, inside serialization

Interest resolves one `(NetworkSystem, Connection)` pair at a time. The evaluation runs inside the serialization pass, ahead of the state passes, so a verdict that changes a pair's membership takes effect on the same tick it was decided - a system that just got culled for a connection does not serialize to it that tick.

Because resolution happens on this hot path, an `IInterestCondition` implementation must be a pure read: it must not start or stop systems, mutate observers, or block.

## The two effects

`InterestEffect` has two flags, and a condition declares which of them it ever speaks to:

- **Spawn** - whether the system exists for the connection at all. An unmet spawn condition means the system never spawns there, and a system already spawned is despawned exactly as an ordinary despawn releases it.
- **Stop** - whether the system is still replicating for the connection. An unmet stop condition freezes the system for that connection while keeping its object retained, so it can stay visible without costing replication; only a later unmet spawn condition reclaims it.

See stopping-versus-culling for what each looks like from the receiving connection's side.

## Cadence and stagger

`InterestManager.EvaluationCadenceTicks` sets how many ticks pass between evaluations of any one system's conditions; the default is 5. A value of 1 evaluates every system every tick. Systems are staggered across the cadence by their `Id`, so on any given tick roughly one cadence-th of the world is evaluated rather than the whole of it landing on one tick.

The cadence is skipped for two cases that cannot wait for a stagger slot to come around: a connection that just authenticated is evaluated against every started system immediately, and a system that just started is evaluated against every authenticated connection immediately. Both land on the tick they happen, before anything serializes, rather than trickling in as each system's stagger slot arrives.

## The cost

The evaluation is O(systems × connections). It is cadenced and staggered to keep that honest, which is fine for demo and mid scale; a world of thousands of systems and connections wants a spatial broadphase feeding it candidate pairs instead, and that is future work rather than something the current pass fakes.

A connection is not registered as an observer the moment it authenticates. Registration - and so interest evaluation - waits for its link to be measured (`Connection.CanReceiveState`), because every timing decision the sender makes about a peer is denominated in its round trip time. A connection authenticated before its link is measured is held back and registered the moment that measurement completes, typically one round trip later, and immediately for a host's own client.

## Where to go next

On the API track, see registering-interest-conditions for `InterestManager.AddCondition` and per-system registration. On the Unity track, see the Unity Interest Manager and Network Interest Object components.
