---
title: "Physics execution modes"
---

`UnityPhysicsManager` decides who steps Unity's physics worlds: Nucleus, once per network tick, or Unity itself on its own fixed step. The choice is process-global and read once when the session starts.

## The component

`UnityPhysicsManager` exposes the chosen mode as the read-only `ExecutionMode` property. Two inspector fields configure it:

- **Execution Mode** (`PhysicsExecutionMode`): which mode is active. Defaults to `PhysicsExecutionMode.NucleusPerTick`.
- **Match Fixed Delta Time To Tick Rate** (`bool`): whether Unity's fixed step is aligned to the tick rate. Defaults to off, and only applies under `PhysicsExecutionMode.UnityRun`.

The mode is applied before any `PhysicsSimulationDriver` registers, so the very first driver already sees the chosen mode.

Both fields are read once at session start and are disabled in the inspector while playing; stop play mode to change them.

## PhysicsExecutionMode.NucleusPerTick

The default. Nucleus sets `UnityEngine.Physics.simulationMode` to `SimulationMode.Script` and steps every physics world itself, once per network tick, so physics always advances in step with the tick. Nucleus projected physics on the default world requires this mode. Because the network loop runs on unscaled time, physics in this mode keeps stepping at the tick rate while `Time.timeScale` is zero or slowed.

## PhysicsExecutionMode.UnityRun

Not a cheaper version of the same thing — a hard limit. The default world is left on Unity's own auto-simulated step and is never Nucleus-stepped, so it carries no projected physics at all in this mode. `Rigidbody.Interpolate` works again on the default world, because Unity is the one advancing it. Projected physics still works, but only in the local-physics worlds a stacked scene's own `PhysicsSimulationDriver` registers — the default world is excluded from what Nucleus steps.

## Matching the fixed step to the tick

**Match Fixed Delta Time To Tick Rate** applies only under `PhysicsExecutionMode.UnityRun`; it is ignored under `NucleusPerTick`, where the tick already is the step. When enabled, the manager sets `Time.fixedDeltaTime` to one over the network loop's tick rate, so Unity's own fixed step lands on the same cadence as the tick.

The previous value is restored when the manager is destroyed, so a play session doesn't leave the project's fixed step changed behind it.

## Mode versus driver

The execution mode is process-global, chosen once by the `UnityPhysicsManager` in the scene that starts the session. A `PhysicsSimulationDriver` is per scene, registering which scene steps which physics world. This page answers which cadence steps a world; see [PhysicsSimulationDriver](./physics-simulation-driver.md) for which scene owns which world.

## Checking which mode is live at runtime

- `UnityEngine.Physics.simulationMode` reads `Script` under `NucleusPerTick` and stays `FixedUpdate` under `UnityRun`.
- `Time.fixedDeltaTime` equals one over the tick rate only when `UnityRun` is active and the match toggle is on; otherwise it stays at the project default.
