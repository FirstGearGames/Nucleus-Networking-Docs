---
title: "UnityLagCompensationManager"
---

> **Driving the core API directly?** See [The rewind window and the view clamp](../../core-api/lag-compensation/the-rewind-window.md).

`UnityLagCompensationManager` sets lag compensation and spawn compensation. Both are Pro; in a free build every value is stored and never read.

A scene without this component gets one automatically, so add it yourself only to change the defaults. Its values are applied when the session starts, and the fields are disabled during play. To change a value after that, set it from code on `NucleusLagCompensationManager`, which is the same object as `NucleusUnity.BoundCoreManager.LagCompensationManager`.

## Set the rewind window and query rules

| Inspector field | Engine setting | Default | What it does |
| --- | --- | --- | --- |
| **Rewind Ceiling (ms)** | `MaximumRewindCeilingMilliseconds` | 500 | The longest rewind window the server honours. **Max Rewind (ms)** is held to it. The slider runs to 2000. |
| **Max Rewind (ms)** | `MaximumRewindMilliseconds` | 500 | How far back hitbox poses are kept and a shot may be judged. Read when an object's hitboxes register, so it applies to objects spawned after it changes. The slider stops at **Rewind Ceiling (ms)**. |
| **2D Queries Hit 3D Hitboxes** | `Can2DQueriesHit3DHitboxes` | off | Lets 2D queries also hit 3D hitboxes, for a game that mixes the two. A 2D ray and `OverlapBox2D` touch a 3D hitbox where the plane Z = 0 cuts it, and a circle, a 2D capsule and a circle cast reach it as a ball or capsule of their radius lying in the plane. 3D queries never hit 2D hitboxes either way. |
| **Queries Start In Hitboxes** | `CanQueriesStartInHitboxes` | on | Lets a ray or cast hit a hitbox it starts inside, at distance zero, the way Unity's 2D queries hit a collider they start in. Turn it off when a muzzle can sit inside a hitbox the shot should pass through, such as another body part of a large creature; that hitbox is then ignored and the query goes on to what lies beyond. Overlaps are not affected. |

## Cap spawn compensation

| Inspector field | Engine setting | Default | What it does |
| --- | --- | --- | --- |
| **Max Spawn Compensation (ms)** | `MaximumSpawnCompensationMilliseconds` | 150 | The most a freshly spawned object, such as a projectile, may be caught up through the latency it lost, counted across every hop it travelled. It also bounds how long a catch-up runs. The slider runs from 0 to the engine ceiling, 500, which the runtime clamps to. |

A client watching somebody else's shot is owed the time the server already spent plus what the delivery cost it, and the two together are held to this one figure. On a local link the measured latency never asks for the whole of it, so raise it to watch the catch-up. See [Spawn compensation](../../core-api/systems/spawn-compensation.md).

## The view clamp violation

A shooter whose view is older than **Max Rewind (ms)**, or newer than anything the server recorded, is reporting a moment the server could never have shown it. The query clamps the view into range and still judges the shot, so a player on a very slow link still gets results. It also raises `LagCompensationViewClampedViolation` against the shooter, carrying the `ReportedTick` and the `ClampedTick` the shot was judged at. The default action is `ViolationAction.Ignore`.

There is no inspector for violations. Subscribe from code in `Start`:

```csharp
private CoreManager _coreManager;

private void Start()
{
    _coreManager = NucleusUnity.BoundCoreManager;
    _coreManager.ViolationManager.LagCompensationViewClampedViolationDetected += OnLagCompensationViewClamped;
}

private void OnDestroy()
{
    if (_coreManager is not null)
        _coreManager.ViolationManager.LagCompensationViewClampedViolationDetected -= OnLagCompensationViewClamped;
}

private void OnLagCompensationViewClamped(in ViolationContext<LagCompensationViewClampedViolation> violationContext)
{
    LagCompensationViewClampedViolation violation = violationContext.Violation;

    Debug.Log($"Connection [{violationContext.Connection.Id}] reported tick [{violation.ReportedTick}], judged at [{violation.ClampedTick}].");
}
```

A single clamp is ordinary on a link that spiked. A steady stream from one client is either a very slow link or a client asking to be judged against the oldest world it can get. To act on it, register a deciding handler; see [Handling violations in Unity](../diagnostics/handling-violations-in-unity.md).
