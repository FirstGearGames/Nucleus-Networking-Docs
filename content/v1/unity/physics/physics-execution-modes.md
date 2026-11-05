---
title: "Physics execution modes"
---

`UnityPhysicsManager` decides who steps Unity's physics: Nucleus once per network tick, or Unity on its own fixed step. The choice applies to the whole process and is read once when the session starts. Both fields are disabled in the inspector during play; stop play to change them.

## Choose the mode in the inspector

| Field | Default | Purpose |
|---|---|---|
| **Execution Mode** (`PhysicsExecutionMode`) | `NucleusPerTick` | Who steps physics. The read-only `ExecutionMode` property holds the active mode. |
| **Match Fixed Delta Time To Tick Rate** | off | Under `UnityRun` only, sets `Time.fixedDeltaTime` to one over the tick rate so Unity's fixed step matches the tick. The previous value is restored when the manager is destroyed. Ignored under `NucleusPerTick`. |

## NucleusPerTick steps every world on the tick

Nucleus sets `UnityEngine.Physics.simulationMode` to `SimulationMode.Script` and steps every physics world once per network tick. Projected physics on the default world requires this mode. The network loop runs on unscaled time, so physics keeps stepping at the tick rate while `Time.timeScale` is zero or slowed.

## UnityRun leaves the default world to Unity

The default world stays on Unity's own fixed step and carries no projected physics at all. `Rigidbody.Interpolate` works on it again. Projected physics still works in the local-physics worlds of stacked scenes, each stepped by its own `PhysicsSimulationDriver`.

Which scene steps which world is set per scene by the driver; see [PhysicsSimulationDriver](./physics-simulation-driver.md).

## Check which mode is live

- `UnityEngine.Physics.simulationMode` reads `Script` under `NucleusPerTick` and stays `FixedUpdate` under `UnityRun`.
- `Time.fixedDeltaTime` equals one over the tick rate only under `UnityRun` with the match field on.
