---
title: "Level of detail in Unity"
---

> **Driving the core API directly?** See [Interest level of detail](../../core-api/interest/interest-level-of-detail.md).

Level of detail sorts each object's distance from each player into a Near, Medium or Far band. It is only a reading for your game: it does not cull an object or change what is sent or how often. Level of detail is Pro; a free build has no bands.

## Turn it on

1. On the **Unity Interest Manager** component, set the level of detail fields:

   | Field | Default | What it does |
   | --- | --- | --- |
   | **Level Of Detail Enabled** | | Turns the pass on for this world. |
   | **Near Distance** | | Past this distance an object bands as Medium. |
   | **Far Distance** | | Past this distance an object bands as Far. |
   | **Hysteresis** | `0.1` | The fraction of a rung an object must travel back inside before it returns to the nearer band, so an object on a boundary does not switch bands every pass. |
   | **Level Of Detail Cadence Ticks** | `10` | How many ticks pass between one measurement and the next. |

   The far distance must be larger than the near one, and both above zero. Otherwise the inspector shows an error, and nothing is banded until it is fixed.

2. Opt in each object that needs a band. Only opted-in objects are measured. Call this on its `NetworkSystem` from a `NucleusBehaviour` or any other script:

   ```csharp
   networkSystem.SetLevelOfDetailEnabled(true);
   ```

   Turning it off drops every band the system held, and a later read returns Near.

## Read the band for a player

```csharp
InterestLevelOfDetail level = networkSystem.GetInterestLevelOfDetail(connection);
```

- **Near**: inside the near distance. An unconfigured world, an unmeasurable position and a player's own controlled object also read as Near.
- **Medium**: between the near and far distances.
- **Far**: past the far distance.
