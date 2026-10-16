---
title: "The rewind window and the view clamp"
---

> **Using Unity?** See [UnityLagCompensationManager](../../unity/lag-compensation/unity-lag-compensation-manager.md).

## How far back a shot can be judged

`LagCompensationManager.MaximumRewindMilliseconds` is how far back poses are kept and a shot may be judged. It defaults to `LagCompensationManager.DefaultMaximumRewindMilliseconds`, 500 milliseconds.

```csharp
coreManager.LagCompensationManager.MaximumRewindMilliseconds = 300;
```

It is read when a root registers, which sizes that root's history to the window at the current tick rate plus two ticks, so a change applies to roots registered afterwards. Set it before objects spawn. The oldest tick a query will answer for is worked out from the same setting on every query.

An honest client's view stays inside the window unless its latency exceeds it. Size the window to the slowest link the game is willing to favor the shooter for: a longer window lets a player on a slow link land shots on targets that have long since moved on, which the targets experience as being hit behind cover.

## A view the server could not have shown is clamped

A view older than the window, or newer than anything the server has recorded, is one the server could never have shown that shooter. Rather than refuse the shot, the query clamps the view into range and still judges it: an old view is judged at the oldest tick kept, and a view from the future at the newest tick recorded, both with a fraction of zero. A player on a very slow link still gets an answer, but cannot ask to be judged against an arbitrarily old world.

Each clamp raises `LagCompensationViewClampedViolation` against the shooter's `Connection`, at most once per query. It carries:

- `ReportedTick`, the tick the shooter reported;
- `ClampedTick`, the tick the shot was judged at instead.

It defaults to `ViolationAction.Ignore`. A shot fired by the server itself, with a `null` shooter, raises nothing.

## Watching for clamps

Subscribe to `ViolationManager.LagCompensationViewClampedViolationDetected` to be told about each clamp without changing the outcome:

```csharp
coreManager.ViolationManager.LagCompensationViewClampedViolationDetected += OnLagCompensationViewClamped;

private void OnLagCompensationViewClamped(in ViolationContext<LagCompensationViewClampedViolation> violationContext)
{
    LagCompensationViewClampedViolation violation = violationContext.Violation;

    // Count clamps per violationContext.Connection; violation.ReportedTick and violation.ClampedTick say how far out the view was.
}
```

The event is raised on the network loop, by the query that received the view. A single clamp is ordinary on a link that spiked. A steady stream from one connection is either a very slow link or a client asking to be judged against the oldest world it can get. To act on it, kicking for example, register a deciding handler with `RegisterViolationHandler<LagCompensationViewClampedViolation>`; see [Violations](../diagnostics/violations.md).

## Targets that stopped stay in the window

A target that stops, dies or despawns stays hittable until its last recorded tick leaves the window, so a shot fired just before the target went away is still judged against it. Its hit names no `NetworkSystem`; read `SystemId` instead.

## The spawn compensation cap lives here too

`LagCompensationManager` also holds the cap on [spawn compensation](../systems/spawn-compensation.md), the other half of the same problem: `MaximumSpawnCompensationMilliseconds`, defaulting to `DefaultMaximumSpawnCompensationMilliseconds` (150) and held by its setter to `MaximumSpawnCompensationCeilingMilliseconds` (500). Lag compensation judges a shot against the past; spawn compensation brings a freshly spawned object up to the present. The setting exists in every edition so code that sets it compiles against any build.
