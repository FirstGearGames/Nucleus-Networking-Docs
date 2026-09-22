---
title: "Level of detail in Unity"
---

> **Driving the core API directly?** See [Interest level of detail](../../core-api/interest/interest-level-of-detail).

A band changes nothing about what is sent. It neither culls an object nor alters its rate; it is a measurement your game reads and acts on.

## Enabling it

Level of detail is set on the **Unity Interest Manager** component:

- **Level Of Detail Enabled** — turns the pass on for this world.
- **Near Distance** — the distance past which an object bands as Medium.
- **Far Distance** — the distance past which an object bands as Far.
- **Hysteresis** — the fraction of a rung an object must travel back inside before it returns to the nearer band. Default `0.1`.
- **Level Of Detail Cadence Ticks** — how many ticks pass between one resolution and the next. Default `10`.

The far distance must be larger than the near one, and both above zero. Equal rungs make a band unreachable, and until that is fixed nothing is banded at all.

## Why two rungs, not more

The ladder has exactly two boundaries: near/medium and medium/far. That gives three bands — Near, Medium, Far — and nothing finer. A band is a measurement your game reacts to, not a rate the engine drives, so more rungs only add more cases for your code to branch on without changing what gets sent.

Hysteresis exists for the player who walks back and forth across a boundary. Without it, a position sitting exactly on a rung flips bands every resolution. The hysteresis fraction holds the object in its farther band until it has come back far enough inside the nearer rung, so a boundary a player straddles doesn't chatter between two bands tick after tick.

## Opting an object in

An object is measured only where it asked to be. Call `SetLevelOfDetailEnabled` on its `NetworkSystem` from a `NucleusBehaviour` or any other script:

```csharp
networkSystem.SetLevelOfDetailEnabled(true);
```

Measuring a distance for an object nobody will ask the band of is the one cost this feature has, so it's opt-in per system rather than on for the world. Turning it off drops every band the system held; a later read answers Near again rather than whatever was last measured.

## Reading the band for a player

```csharp
InterestLevelOfDetail level = networkSystem.GetInterestLevelOfDetail(connection);
```

- **Near** — inside the near rung, which is no level of detail at all. This is also what an unconfigured ladder, an unmeasurable position, and a peer's own controlled object all resolve to.
- **Medium** — between the near rung and the far one.
- **Far** — beyond the far rung.

## Pro feature

Level of detail is Pro. The whole file set behind it is `*.Pro.cs`; a free build has no bands at all.
