---
title: "What area of interest is"
---

> **Using Unity?** See [What area of interest is](../../unity/interest/area-of-interest.md) and [Unity Interest Manager](../../unity/interest/unity-interest-manager-component.md).

## Without any condition, every system replicates to every client

With no interest condition registered, Nucleus replicates every started `NetworkSystem` to every authenticated client, every tick. Interest conditions only restrict that default; nothing they return can give a connection more than it would get with no conditions at all. With no condition registered anywhere, interest evaluation costs almost nothing.

## Conditions only restrict

An `IInterestCondition` returns an opinion for each effect it declared: `None` (no opinion), `Unmet` (veto the effect for this pair) or `Met` (no restriction). Only `Unmet` restricts. Conditions can be registered globally on the `InterestManager` or on a single system, and they stack: the most restrictive verdict per effect wins. See [Writing an interest condition](./writing-an-interest-condition.md) and [Registering interest conditions](./registering-interest-conditions.md).

Interest resolves one `(NetworkSystem, Connection)` pair at a time, and a changed verdict takes effect on the tick it is decided, so a system just culled for a connection does not serialize to it that tick. A condition must be a pure read: it must not start or stop systems, change observers, or block.

## There are two effects

`InterestEffect` has two flags:

- **Spawn**: whether the system exists for the connection at all. While unmet, the system does not spawn there, and one already spawned is despawned.
- **Stop**: whether the system is still replicating to the connection. While unmet, the system stops for that connection but its object is kept, so it can stay visible without costing replication.

See [Stopping versus culling](./stopping-versus-culling.md).

## Conditions are evaluated on a staggered cadence

`InterestManager.EvaluationCadenceTicks` sets how many ticks pass between evaluations of any one system's conditions. The default is 5, and 1 evaluates every system every tick. Systems are staggered across the cadence by their `Id`, so each tick evaluates roughly one cadence-th of the world.

Two cases skip the cadence and are evaluated on the tick they happen: a connection that just authenticated is evaluated against every started system, and a system that just started is evaluated against every authenticated connection.

Evaluation cost grows with systems times connections. See [What scales and what does not](./what-scales.md).

## A new connection waits until its link is measured

A connection is not registered as an observer, and so not evaluated, until its link is measured (`Connection.CanReceiveState`). That is typically one round trip after it authenticates, and immediate for a host's own client.
