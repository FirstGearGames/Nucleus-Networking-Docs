---
title: "Objects this peer does not control"
---

Most objects in a session run on peers that don't control them: every client watching another client's character, and the server itself when a client is the controller. Nothing about the network loop skips these objects. Every `NucleusBehaviour` hook still fires, every tick, on every peer — control only changes what the code inside the hook should do.

## What still fires

`NucleusBehaviourBase` dispatches its per-step hooks (`OnEarlyVariableUpdate`, `OnEarlyTickUpdate`, `OnEarlyStateUpdate`, `OnLateStateUpdate`, `OnReconcile`, `OnEarlyFixedUpdate`, `OnLateFixedUpdate`, `OnVariableUpdate`, `OnEarlyStateWrite`, `OnLateStateWrite`, `OnLateTickUpdate`, `OnLateVariableUpdate`) whenever the concrete type overrides them, regardless of whether this peer controls the linked system. `OnControllerChanged` is the same: it runs on every peer the moment control moves, not just the one gaining or losing it.

Control is a question a hook answers for itself, with `IsController`:

```csharp
protected override void OnEarlyStateWrite(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    // Write gameplay state here; a non-controlling peer skips this and falls through to nothing.
}
```

`IsController(ControllerType controllerType)` returns false whenever no system is linked yet, and otherwise the system's own answer. `EnsureIsController` is the loud version of the same check — it returns the same bool but logs a warning on every failing call, not throttled. Neither of them stops the hook from running; a script that doesn't call one of them on a non-controlling peer does its writing work anyway, against state it doesn't own.

`IsStarted(Invoker)` is a separate axis entirely — server-started or client-started — and answers independently of who controls the object. A host can be `IsStarted(Invoker.Server)` and still not be the controller of a client-controlled object.

## NetworkTransform on a proxy

`NetworkTransform` is written from wherever the controller is and applied everywhere else. Two inspector fields govern what a proxy does with it, both on by default:

- **Kinematic Management Enabled** (`_kinematicManagementEnabled`, default `true`) holds an attached `Rigidbody` kinematic on every non-controlling peer — including the server while a client controls the system — and returns it to simulation on the controller. The switch is a straight assignment, applied only when the role actually changes: `_rigidbody.isKinematic = !isController;`. Turn it off only when other code already owns that rigidbody's kinematic state.
- **Interpolate Scale Enabled** (`_interpolateScaleEnabled`, default `true`) has a proxy interpolate the replicated scale alongside position and rotation. Disabled, the local scale keeps whatever value it already holds — it's excluded from the sweep, not zeroed.

Both only matter on a peer that isn't the controller. On `VariableUpdate`, a non-controlling, started system calls `_transformComponent.Interpolate(_interpolateScaleEnabled)`; on `EarlyStateWrite`, a controller calls `_transformComponent.WriteState()`. A given peer runs exactly one side of that split per tick, decided by the same `IsController(ControllerType.AnyController)` check every other hook uses.

## Buffering: State Interpolation

`UnitySystemManager` exposes `_stateInterpolation`, defaulting to `1` in the inspector, and applies it as `NucleusSystemManager.StateInterpolation`. It's how many ticks are allowed to pass before a `StatePacket` can be applied. A proxy isn't drawing the instant a value arrives — it's drawing from a small buffer of recently-received ticks, which is what lets `NetworkTransform` interpolate between two real values instead of snapping to each one the moment it lands. Raising it trades latency for smoothness against jitter and loss; the default of `1` is the smallest buffer the inspector allows.

## The subtick fraction

Interpolation doesn't jump from tick to tick — within a tick it sweeps, and the fraction it's swept by is the subtick percentage. It's owned by the engine-shared `NetworkLoopStepDriver`, not by the Unity loop provider:

```csharp
public float SubtickPercentage => _tickIntervalMilliseconds <= 0f ? 0f : _elapsedTickUpdateTime / _tickIntervalMilliseconds;
```

`AdvanceEarly` publishes it right before `VariableUpdate` runs:

```csharp
_networkLoopManager.SetSubtickPercentage(SubtickPercentage);

_networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.VariableUpdate, BuildStepDelta(frameDeltaMilliseconds, hasFixedDelta: false));
```

Anything that reads it — `NetworkTransform`'s sweep included — reads it back through `NetworkLoopManager.SubtickPercentage`. `UnityNetworkLoopStepProvider` does **not** publish this itself; its own remarks are explicit that the subtick fraction for interpolation smoothing is not published from there, because publishing after its `Update` returned would leave `VariableUpdate` smoothing against the previous frame's fraction instead of the current one. What the Unity provider does own is the split around that shared driver: `Update`, at `[DefaultExecutionOrder(-10000)]`, runs the early steps; `LateUpdate` runs the state-write and late steps.

## A pose follower, not a simulation

A proxy isn't simulating anything. It's told where the controller's transform is — position, rotation, and, if enabled, scale — and it follows that pose. Velocity is never sent. That's also why kinematic management matters: while a rigidbody is kinematic, Unity's physics can't push back against a written pose, and nothing local — a collision, a force, a script nudging `transform.position` — should be moving a proxy either, since whatever it moves gets overwritten, or fought, on the very next tick it receives.

See [NetworkTransform](../state/network-transform) for the rest of its inspector fields, and [NetworkMember](../../api/state/network-member) for the per-member interpolation snap threshold that cuts a large discontinuity instead of sweeping across it.
