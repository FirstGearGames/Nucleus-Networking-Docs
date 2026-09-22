---
title: "Interest level of detail"
---

> **Using Unity?** See [Level of detail in Unity](../../unity/interest/level-of-detail-in-unity)

## Scope

Level of detail is a measurement, not a behavior. Nothing in the engine acts on a band: it does not cull an object, it does not change what a system sends, and it does not touch the per-member send interval, which is configured separately. A band tells the game how far an object is from a peer, in three steps instead of a raw distance. What the game does with that reading is up to the game.

## Building a ladder

`InterestLevelOfDetailLadder.TryCreate` validates two ascending rungs and builds the ladder they describe:

```csharp
if (InterestLevelOfDetailLadder.TryCreate(nearDistance: 20f, farDistance: 60f, hysteresis: InterestLevelOfDetailLadder.DefaultHysteresis, out InterestLevelOfDetailLadder ladder))
{
    interestManager.SetLevelOfDetail(ladder);
}
```

`TryCreate` refuses:

- Either rung being non-finite, zero, or negative.
- `nearDistance` greater than or equal to `farDistance` — equal rungs would describe a band no distance can land in.
- A `hysteresis` that is `NaN`, negative, or greater than or equal to `InterestLevelOfDetailLadder.MaximumHysteresis` (`1f`).

`InterestLevelOfDetailLadder.DefaultHysteresis` is `0.1f`. On failure, `TryCreate` writes an unconfigured ladder to the `out` parameter and returns `false`.

## Configuring the world

`InterestManager.SetLevelOfDetail` installs the ladder:

```csharp
interestManager.SetLevelOfDetail(ladder);
```

The current ladder reads back from `InterestManager.LevelOfDetail`. Its `IsConfigured` property reports whether it holds two valid rungs, and `WidestDistance` is the far rung, unsquared, in metres. Passing an unconfigured ladder turns level of detail off: every pair then resolves to `InterestLevelOfDetail.Near`.

`InterestManager.LevelOfDetailCadenceTicks` sets how many ticks pass between one resolution of a system's band and the next; it defaults to `InterestManager.DefaultLevelOfDetailCadenceTicks` (`10`).

## Opting a system in

A `NetworkSystem` is measured only if it opts in:

```csharp
networkSystem.SetLevelOfDetailEnabled(true);
```

`NetworkSystem.IsLevelOfDetailEnabled` reports the current opt-in state. Turning it off drops any band already held for that system, so a later read answers `Near` rather than the last value measured before tracking stopped.

Read the resolved band for a specific connection with `GetInterestLevelOfDetail`:

```csharp
InterestLevelOfDetail band = networkSystem.GetInterestLevelOfDetail(connection);
```

## The bands

`InterestLevelOfDetail` has three values: `Near` (0), `Medium` (1), and `Far` (2). `Near` is not the finest level of detail — it is the absence of level of detail entirely. An unconfigured ladder, a position that cannot currently be measured, and a peer's own controlled object all resolve to `Near`, on the same footing as an object nobody ever measures.

## Hysteresis at a boundary

Each rung's release boundary is precomputed from `1 - hysteresis` at ladder construction, not tested against the raw rung distance every time. A rung is tested at its release boundary only while the object already sits in that band or a coarser one, so coarsening happens at the rung itself and refining happens a dead band inside it.

Without that dead band, an object sitting exactly on a rung — or a player walking back and forth across one — would flap between two bands on every resolution, and anything reading the band would see a stream of changes describing jitter rather than movement. With the default 10% hysteresis, a 40-metre rung holds a 4-metre release band: comfortably wider than the distance an ordinary walking speed covers between resolutions.

## Pro feature

Level of detail is part of Nucleus Pro.

## Forcing a re-measure

`RefreshInterest` takes an `isLevelOfDetailRemeasured` argument to force a system's band to be re-resolved off its cadence slot, for a system that moved discontinuously and cannot wait out its stagger.
