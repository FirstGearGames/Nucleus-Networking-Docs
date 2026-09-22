---
title: "How distances are measured: pairwise and the spatial grid"
---

## Choosing a technique

`InterestManager.SetInterestTechnique(InterestTechnique interestTechnique, GridInterestAxes gridInterestAxes = GridInterestAxes.Xyz)` sets how every distance condition in a world resolves distance. It is one setting on the manager, not a flag per prefab, because the two techniques are built to reach identical verdicts: the difference is cost, never behavior.

```csharp
interestManager.SetInterestTechnique(InterestTechnique.SpatialGrid, GridInterestAxes.Xz);
```

The current choice reads back from `Technique` and `InterestAxes`.

`InterestTechnique.Pairwise` is the default. It measures each connection's nearest controlled object directly, with no index in front of it. It is the right answer where most objects are in range of most players anyway, which is most worlds at demo and mid scale.

`InterestTechnique.SpatialGrid` narrows candidates through the shared `SpatialInterestGrid` first, then measures the survivors exactly against the same cutoffs and the same ladder. Because the exact measurement is identical either way, the grid can never produce a different verdict from pairwise — it only changes what gets measured.

## When the grid pays off

The grid buys narrowing, and narrowing is only worth its own cost where the cutoff genuinely excludes most pairs. `InterestResolutionBenchmarkTests` resolves 1000 systems against 100 to 1000 players and measures both worlds:

- A world 400 metres across against a 25 metre cutoff: the grid runs at 1.4x to 1.7x the speed of pairwise.
- A world small enough that everything is in range of everything: the grid runs at 0.6x of pairwise, because the radius query buys no narrowing and the exact measurement still has to happen.

Pick the technique from the world's geometry, not from player count.

## Restricting the axes

`GridInterestAxes` chooses which axes a distance is measured across: `Xyz` (the full volume, and the default), `Xy`, `Xz`, or `Yz`. It applies to both techniques, not just the grid, so a world that plays out on a surface — top-down or side-on — can measure only in that surface and stop treating a tower directly overhead as a step away.

The choice resolves to a per-axis multiplier (one on each measured axis, zero on the omitted one) rather than a branch, so nothing on the hot path tests which axes are live. `Xyz` resolves to the mask of ones, which leaves the arithmetic identical to a world that never chose a plane at all.

## The technique settles once

`SetInterestTechnique` is refused, with a logged error, once any distance condition has registered in the world. A single pass cannot measure in two planes at once, and which one won would become an accident of evaluation order rather than a decision anyone made. Set the technique and the axes during setup, before anything carrying a distance rule spawns.

## SpatialInterestGrid

`SpatialInterestGrid` is the engine-free index `InterestTechnique.SpatialGrid` narrows through. It knows nothing about transforms; it answers "which of these points lie within this radius of this point."

- `BeginPass(uint pass)` opens a pass, clearing the grid when the pass has moved on. It returns `true` when the caller must re-insert this pass's points, so several callers can share one grid within a pass and only the first pays to build it.
- `Insert(uint id, Vector3 position)` files one identified point for the current pass. A non-finite position is dropped rather than filed.
- `CollectWithin(Vector3 center, float radius, HashSet<uint> results)` adds the identifiers of every inserted point within `radius` of `center`. Candidates are tested exactly before being added, so a result is genuinely in range and not merely in a probed cell.
- `IsIndexed(uint id)` reports whether an identifier filed any point at all this pass, which is how a caller tells "indexed and out of range" apart from "never indexed."
- `ConfigureAxes(GridInterestAxes gridInterestAxes)` chooses the plane, taking effect at the next rebuild rather than mid-pass.

`CellSize` is a public read-back with a private setter, not a fixed constant. `DefaultCellSize` (32 units) is a floor: each `BeginPass` that rebuilds widens the cell size to the widest radius any query asked about in the previous pass. Correctness never depends on the cell size — a query probes every cell its bounding box touches and tests each candidate exactly — so a mis-sized cell only costs more probes or more candidates, never a wrong answer.

## Scale caveat

Resolution is O(systems × connections), cadenced and staggered across systems. That is honest for demo and mid scale. A world of thousands of systems and peers wants a true spatial broadphase feeding candidate pairs directly; this pass does not fake one, and that remains future work.
