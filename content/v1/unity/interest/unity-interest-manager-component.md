---
title: "Unity Interest Manager"
---

## Overview

`UnityInterestManager` is the inspector-side driver for the core `InterestManager`. It carries the world-wide interest rules this peer is authored with, controls how often interest is re-resolved, and, in Pro, how spawns are paced and how distance is measured. Every field is pushed onto the core `InterestManager` in `ManagersInstantiated`, so script execution order cannot lose a setting. Both host switches are copied at that point, so ticking either in the inspector mid-session changes nothing. The engine reads its own `InterestManager.HostInterestEnabled` on every pass, but whether a host hides objects is decided once, when the peer first becomes a host with its own client linked.

## World Rules

A `[SerializeReference]` list of `AuthoredInterestCondition` entries. Each one registers against every `NetworkSystem` that starts, for the whole world — not one object. On `Reset`, the list is seeded with a single entry: the Scene rule (`AuthoredSceneInterestCondition`).

Conditions can only restrict. Anything registered here narrows what would otherwise replicate to everybody. If no entry in the list gates scenes, the inspector raises a warning: a client will receive objects from scenes it never loaded, several open instances of one scene cannot be told apart by distance, and nothing at runtime reports the fault — it just lands objects in the wrong scene.

## Evaluation Cadence Ticks

Default: `5` (`InterestManager.DefaultEvaluationCadenceTicks`).

How many ticks pass between one interest evaluation pass and the next for any one system. A joining client and a newly started system are always resolved immediately, off the cadence. Systems are staggered by Id, so a given tick evaluates roughly one cadence-th of the world rather than all of it at once.

## Host Interest Enabled / Host Visibility Enabled

- **Host Interest Enabled**: resolves this peer's own client against the interest rules too, so a host can be told which objects its client half would not have been sent. Off by default: the pass costs the host connection an ordinary condition pass per evaluated pair, and a world that never reads the answer would be paying for nothing. Nothing is culled from a host by this switch alone.
- **Host Visibility Enabled**: hides an object while the report above says the host's own client half would not have been holding it. On by default. Setting **Host Interest Enabled** is the whole of turning host hiding on, since this switch is already set (see [Making a host see what its players see](./host-visibility-in-unity.md)). Clearing it keeps the report without acting on it, letting a world hide more than renderers, dim instead, or drive its own behavior from `NetworkSystem.HostInterestChanged`.

When enabled, a `NetworkHostVisibility` component is put on each networked object as it links, only once the peer turns out to be a host.

## Free Build

In a free build the inspector draws only **World Rules**, **Evaluation Cadence Ticks**, and the two host switches. **Maximum Spawns Per Tick** and the entire **Distance Measurement** and **Level Of Detail** sections belong to Pro-only partial files (`UnityInterestManager.SpawnPacing.Pro.cs`, `UnityInterestManager.LevelOfDetail.Pro.cs`). Those fields do not exist in a free build, so the editor skips drawing them rather than disabling them.

## Maximum Spawns Per Tick — Pro

Default: `500`; `0` means unpaced.

How many objects may start replicating to any one client per tick; the rest wait for the ticks after. When set to `0` (`InterestManager.UnlimitedSpawnsPerTick`), the inspector shows an info note: spawns are not paced, and a join or scene load arrives as one tick however large it is.

## Distance Measurement — Pro

- **Interest Technique**: how every distance in this world is measured (pairwise comparison, or a spatial grid).
- **Interest Axes**: which axes distances are measured across (full volume, or height dropped for surface play).

Both fields must be settled before anything carrying a distance rule spawns. Changing either after a distance condition has registered is refused, and the engine logs an error.

## Level Of Detail — Pro

- **Level Of Detail Enabled**: measures each opted-in object's distance from each player into a Near, Medium or Far band your game can read. It changes nothing about what is sent or how often, and nothing is culled by it.
- **Near Distance**: inside this distance an object reads as Near (no level of detail).
- **Far Distance**: past this distance an object reads as Far, the coarsest band.
- **Hysteresis**: how far inside a rung an object must travel before it returns to the nearer band, as a fraction of that rung; stops an object sitting on a boundary from switching band every pass.
- **Cadence Ticks**: how many ticks pass between one distance measurement of an object and the next.

The rungs must be positive and strictly ascending (far greater than near). If they are equal or zero, the inspector shows an error: nothing is banded until this is fixed.
