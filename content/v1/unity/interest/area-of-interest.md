---
title: "What area of interest is"
---

> **Driving the core API directly?** See [What area of interest is](../../core-api/interest/area-of-interest.md).

With no interest rule, every started `NetworkSystem` replicates to every authenticated client, every tick. Interest rules only restrict that default: no rule can send a client something it would not otherwise get. A world with no rules pays almost nothing for interest.

## Rules stack, and the strictest one wins

Rules come from two places, and both stack:

- **World Rules** on the [Unity Interest Manager](./unity-interest-manager-component.md) apply to every system that starts.
- **Rules** on a prefab's [Network Interest Object](./network-interest-object-component.md) apply to that object only.

For each effect it declares, a rule answers `Met`, `Unmet` or `None` (no opinion). Only `Unmet` restricts, and the most restrictive answer across every rule wins.

Interest is decided for one object and one client at a time, and a changed verdict takes effect on the tick it is decided. A rule you write must only read: it must not start or stop systems, change observers, or block.

## A rule can stop spawning, stop updates, or both

- **Spawn** (`InterestEffect.Spawn`): whether the object exists for the client at all. While unmet, the object never spawns there, and one already spawned is despawned like an ordinary despawn.
- **Stop** (`InterestEffect.Stop`): whether the object still receives updates. While unmet, the object stays on the client, frozen, and costs nothing to keep current. Only a later unmet Spawn removes it.

See [Frozen or gone: what a stop does to the object](./stopping-objects-in-unity.md) for what each looks like on the client.

## Evaluation runs on a cadence

**Evaluation Cadence Ticks** on the Unity Interest Manager sets how many ticks pass between evaluations of any one object. The default is 5, and 1 evaluates every object every tick. The work is spread across those ticks rather than done all at once.

A client that just authenticated, and a system that just started, are evaluated at once.

The work grows with objects times clients. See [What scales and what does not](./what-scales.md).
