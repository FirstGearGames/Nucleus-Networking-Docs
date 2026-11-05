---
title: "The rewind window and the view clamp"
---

> **Using Unity?** See [UnityLagCompensationManager](../../unity/lag-compensation/unity-lag-compensation-manager.md).

## Set how far back a shot can be judged

`LagCompensationManager.MaximumRewindMilliseconds` is how far back poses are kept and a shot may be judged. It defaults to `LagCompensationManager.DefaultMaximumRewindMilliseconds`, 500 milliseconds. It is held to `MaximumRewindCeilingMilliseconds`, which also defaults to 500 milliseconds. A window set above the ceiling reads as the ceiling until the ceiling is raised, so the two can be set in either order.

```csharp
coreManager.LagCompensationManager.MaximumRewindMilliseconds = 300;
```

Set it before objects spawn: each root's history length is fixed when the root registers. Queries read the current value every time.

An honest client's view stays inside the window unless its latency exceeds it. Size the window to the slowest link you are willing to favor the shooter for. A longer window lets a player on a slow link hit targets that have long since moved on, which the targets feel as being hit behind cover.

## A view the server could not have shown is clamped

A view older than the window, or newer than anything recorded, is clamped and still judged: an old view at the oldest tick kept, a future view at the newest tick recorded, both with a fraction of zero.

Each clamp raises `LagCompensationViewClampedViolation` against the shooter's `Connection`, at most once per query, with:

- `ReportedTick`: the tick the shooter reported.
- `ClampedTick`: the tick the shot was judged at instead.

It defaults to `ViolationAction.Ignore`. A shot the server fires itself, with a `null` shooter, raises nothing.

## Watch for clamps

Subscribe to `ViolationManager.LagCompensationViewClampedViolationDetected` to hear about each clamp without changing the outcome. It is raised on the network loop.

```csharp
coreManager.ViolationManager.LagCompensationViewClampedViolationDetected += OnLagCompensationViewClamped;

private void OnLagCompensationViewClamped(in ViolationContext<LagCompensationViewClampedViolation> violationContext)
{
    LagCompensationViewClampedViolation violation = violationContext.Violation;

    // Count clamps per violationContext.Connection; violation.ReportedTick and violation.ClampedTick say how far out the view was.
}
```

A single clamp is normal on a link that spiked. A steady stream from one connection is either a very slow link or a client asking to be judged against the oldest world it can get. To act on it, for example by kicking, register a deciding handler with `RegisterViolationHandler<LagCompensationViewClampedViolation>`; see [Violations](../diagnostics/violations.md).

## The spawn compensation cap is set here too

`LagCompensationManager.MaximumSpawnCompensationMilliseconds` caps [spawn compensation](../systems/spawn-compensation.md). It defaults to `DefaultMaximumSpawnCompensationMilliseconds` (150), and its setter holds it to at most `MaximumSpawnCompensationCeilingMilliseconds` (500). It exists in every edition, so code that sets it compiles against any build.
