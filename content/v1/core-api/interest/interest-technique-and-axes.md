---
title: "How distances are measured: pairwise and the spatial grid"
---

## Choose a technique

`InterestManager.SetInterestTechnique(InterestTechnique interestTechnique, GridInterestAxes gridInterestAxes = GridInterestAxes.Xyz)` sets how every distance condition in a world measures distance. Both techniques reach identical verdicts; only the cost differs.

```csharp
interestManager.SetInterestTechnique(InterestTechnique.SpatialGrid, GridInterestAxes.Xz);
```

The current choice reads back from `Technique` and `InterestAxes`.

- `InterestTechnique.Pairwise` (the default) measures each connection's nearest controlled object directly. Use it where most objects are in range of most players, which is most small and mid-sized worlds.
- `InterestTechnique.SpatialGrid` narrows candidates through the shared `SpatialInterestGrid`, then measures the survivors exactly against the same cutoffs. Use it in a world much wider than its cutoff. In a world where everything is in range of everything, it is slower than pairwise.

Pick the technique from the world's geometry, not from player count.

## Restrict the axes for a flat world

`GridInterestAxes` chooses which axes a distance is measured across: `Xyz` (the default), `Xy`, `Xz` or `Yz`. It applies to both techniques. A top-down or side-on world can measure only in its plane, so a tower directly overhead no longer counts as a step away.

## The technique is locked once a distance condition registers

`SetInterestTechnique` is refused, with a logged error, once any distance condition has registered in the world. Set the technique and the axes during setup, before anything with a distance rule spawns.

## Query SpatialInterestGrid directly

`SpatialInterestGrid` is the index `InterestTechnique.SpatialGrid` uses. It knows nothing about transforms. It answers "which of these points lie within this radius of this point".

- `TryBeginPass(uint pass)` opens a pass. It returns `true` when the caller must insert this pass's points, so several callers can share one grid in a pass and only the first builds it.
- `Insert(uint id, Vector3 position)` adds one point for the current pass. A non-finite position is dropped.
- `CollectWithin(Vector3 center, float radius, HashSet<uint> results)` adds the id of every inserted point within `radius` of `center`. Results are exact.
- `IsIndexed(uint id)` reports whether an id added any point this pass, which tells "indexed and out of range" apart from "never indexed".
- `ConfigureAxes(GridInterestAxes gridInterestAxes)` chooses the plane, from the next rebuild.

`CellSize` reads the current cell size, which is never below `DefaultCellSize` (32 units).
