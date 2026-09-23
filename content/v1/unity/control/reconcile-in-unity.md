---
title: "Replaying a correction in Unity"
---

> **Driving the core API directly?** See [Reconciliation and replay](../../core-api/control/reconciliation.md).

## Override OnReconcile

`NucleusBehaviourBase` (the base every `NucleusBehaviour<TComponent0>` script inherits) exposes a per-tick loop-step virtual for reconciliation:

```csharp
protected virtual void OnReconcile(StepDelta stepDelta) { }
```

It runs on the `Reconcile` loop step, after a tick's replicated state has been applied and before that tick's own state is written back out - between the `OnLateStateUpdate` and `OnEarlyFixedUpdate` virtuals in declaration order. By the time `OnReconcile` runs, any correction the tick carried has already been set onto the system; this is where you replay the ticks that correction invalidated.

Overriding `OnReconcile` is enough to be called: `NucleusBehaviourBase` inspects your concrete type in `Awake` and only subscribes to the loop steps you actually override.

## Subscribe to ReconcileRequired

`OnReconcile` runs every tick, whether or not anything was corrected. `NetworkSystem.ReconcileRequired` tells you when a replay is actually needed:

```csharp
public delegate void ReconcileRequiredHandler(uint rewoundTick);
public event ReconcileRequiredHandler? ReconcileRequired;
```

Subscribe from `OnSystemLinked` and unsubscribe from `OnSystemUnlinked`, the pair `NucleusBehaviourBase` raises around a system's link lifetime:

```csharp
private uint _pendingRewoundTick = NetworkLoopManager.UnsetTick;

protected override void OnSystemLinked()
{
    NetworkSystem.ReconcileRequired += OnReconcileRequired;
}

protected override void OnSystemUnlinked()
{
    NetworkSystem.ReconcileRequired -= OnReconcileRequired;
}

private void OnReconcileRequired(uint rewoundTick)
{
    _pendingRewoundTick = rewoundTick;
}
```

`rewoundTick` is the local tick the server's values were rewound onto. The server's value at that tick already includes that tick's input, so replay starts at the tick after it. It is `NetworkLoopManager.UnsetTick` when the correction was a snap with no replay target (a server `SendReconcile` that landed with no processed-input echo to rewind against); skip the replay in that case.

## Replay each invalidated tick

Do the replay in `OnReconcile`, bracketing every re-simulated tick with `BeginReplayTick` / `EndReplayTick`:

```csharp
protected override void OnReconcile(StepDelta stepDelta)
{
    if (_pendingRewoundTick == NetworkLoopManager.UnsetTick)
        return;

    uint currentTick = CoreManager.NetworkLoopManager.Tick;

    for (uint tick = _pendingRewoundTick + 1; tick < currentTick; tick++)
    {
        NetworkSystem.BeginReplayTick(tick);

        // Re-run this tick's simulation: read its recorded input, advance movement/physics as it
        // would have run live.

        NetworkSystem.EndReplayTick();
    }

    _pendingRewoundTick = NetworkLoopManager.UnsetTick;
}
```

`BeginReplayTick(tick)` redirects every state member's writes onto that tick's ring slot instead of the live head, so re-simulating a past tick rebuilds its history rather than stomping the current one. `EndReplayTick()` restores writes to the live head. Re-simulate strictly past ticks this way; apply the current tick's values normally, outside the bracket.

## One event, one replay

A single inbound pass can correct several members on the same system: several predicted members that diverged, or a full-state correction the server sent with `SendReconcile`. `NetworkSystem` accumulates all of them internally and raises `ReconcileRequired` once, with the earliest rewound tick among them. A handler therefore replays once per correcting pass, not once per corrected member.

A server correction of your inputs does not raise `ReconcileRequired`. It raises `NetworkInputComponent.InputCorrected` with the corrected tick instead.

## See also

- The replay contract itself - `BeginReplayTick`, `EndReplayTick`, and what a redirected write means for a state member - is documented on the API reference page for `NetworkSystem`.
- For a controlled rigidbody, physics correction has its own convergence path; see the Physics category for `PhysicsConvergence`.
