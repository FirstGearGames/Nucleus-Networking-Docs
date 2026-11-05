---
title: "Interest level of detail"
---

> **Using Unity?** See [Level of detail in Unity](../../unity/interest/level-of-detail-in-unity.md)

Level of detail tells the game how far an object is from a peer, in three bands instead of a raw distance. The engine never acts on a band: it does not cull an object, change what a system sends, or touch the per-member send interval. What the game does with the band is up to the game. Level of detail is part of Nucleus Pro.

## Set up level of detail

1. Build a ladder with `InterestLevelOfDetailLadder.TryCreate` and install it with `InterestManager.SetLevelOfDetail`:

   ```csharp
   if (InterestLevelOfDetailLadder.TryCreate(nearDistance: 20f, farDistance: 60f, hysteresis: InterestLevelOfDetailLadder.DefaultHysteresis, out InterestLevelOfDetailLadder ladder))
   {
       interestManager.SetLevelOfDetail(ladder);
   }
   ```

2. Opt each system in. Only opted-in systems are measured:

   ```csharp
   networkSystem.SetLevelOfDetailEnabled(true);
   ```

3. Read the band for a connection:

   ```csharp
   InterestLevelOfDetail band = networkSystem.GetInterestLevelOfDetail(connection);
   ```

Level of detail reads positions through the world's position reader. Without one, it logs an error once and every pair reads as `Near`. See [Supplying positions to the interest system](./supplying-interest-positions.md).

## TryCreate refuses an invalid ladder

`TryCreate` returns `false`, and writes an unconfigured ladder to the `out` parameter, when:

- Either rung is non-finite, zero or negative.
- `nearDistance` is greater than or equal to `farDistance`.
- `hysteresis` is `NaN`, negative, or greater than or equal to `InterestLevelOfDetailLadder.MaximumHysteresis` (`1f`).

`InterestLevelOfDetailLadder.DefaultHysteresis` is `0.1f`.

## Read back and tune the ladder

- `InterestManager.LevelOfDetail` reads back the installed ladder. Its `IsConfigured` reports whether it holds two valid rungs, and `WidestDistance` is the far rung in metres.
- Installing an unconfigured ladder turns level of detail off. Every pair then reads `Near`.
- `InterestManager.LevelOfDetailCadenceTicks` sets how many ticks pass between measurements of a system's band. It defaults to `InterestManager.DefaultLevelOfDetailCadenceTicks` (`10`).
- `NetworkSystem.IsLevelOfDetailEnabled` reports a system's opt-in. Turning it off drops the band held for that system, so a later read answers `Near`.

## There are three bands, and Near means no level of detail at all

`InterestLevelOfDetail` has three values: `Near` (0), `Medium` (1) and `Far` (2). `Near` is not the finest level of detail. It means no level of detail: an unconfigured ladder, a position that cannot be measured, and a peer's own controlled object all read `Near`, the same as an object nobody measures.

## Hysteresis stops an object flapping between bands

An object moves to a coarser band at the rung itself, but moves back only once it is `hysteresis` inside the rung. Without that gap, an object sitting on a rung would flip between two bands on every measurement. With the default 10%, a 40-metre rung moves an object back at 36 metres.

## Force a re-measure after a jump

`InterestManager.RefreshInterest(networkSystem, isLevelOfDetailRemeasured: true)` re-measures a system's band before its next cadence slot, for a system that moved suddenly, such as by teleport.
