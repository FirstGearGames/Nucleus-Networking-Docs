---
title: "UnityLagCompensationManager"
---

> **Driving the core API directly?** See [The rewind window and the view clamp](../../core-api/lag-compensation/the-rewind-window.md).

## The inspector seat for lag compensation

`UnityLagCompensationManager` is the inspector-side counterpart of the engine's `LagCompensationManager`. It is added to the `UnityCoreManager`'s GameObject automatically when a scene does not carry one, so a scene only needs it placed to change the defaults. Every value is pushed onto the engine once, in `ManagersInstantiated`, when the session starts, so the inspector disables the fields during play. After that, `NucleusLagCompensationManager` is the engine manager they were pushed onto, the same object as `NucleusUnity.BoundCoreManager.LagCompensationManager`, and code can change its fields directly.

Lag compensation and spawn compensation are Pro. In a free build every value is stored and never read. The inspector says so in its header.

## Lag Compensation

| Inspector field | Engine setting | Default | What it does |
| --- | --- | --- | --- |
| **Max Rewind (ms)** | `MaximumRewindMilliseconds` | 500 | How far back hitbox poses are kept and a shot may be judged. Read when an object's hitboxes register, so it applies to objects spawned after it changes. The slider runs to 2000; a longer window is legal from code but already far past any playable link. |
| **2D Queries Hit 3D Hitboxes** | `Can2DQueriesHit3DHitboxes` | off | Lets 2D queries also hit 3D hitboxes, for a game that mixes the two. 3D queries never hit 2D hitboxes either way. |
| **Queries Start In Hitboxes** | `CanQueriesStartInHitboxes` | on | Lets a ray or cast hit a hitbox it starts inside, at distance zero, the way Unity's 2D queries hit a collider they start in. When off, that hitbox is ignored and the query goes on to what lies beyond it. Overlaps are not affected. |

With **2D Queries Hit 3D Hitboxes** ticked, a 2D ray and `OverlapBox2D` touch a 3D hitbox where the plane Z = 0 cuts it, and a circle, a 2D capsule and a circle cast reach it as a ball or capsule of their radius lying in the plane.

Turn **Queries Start In Hitboxes** off when a muzzle can sit inside a hitbox the shot should pass through, such as another body part of a large creature, and the shot should carry on to whatever lies beyond.

## Spawn Compensation

| Inspector field | Engine setting | Default | What it does |
| --- | --- | --- | --- |
| **Max Spawn Compensation (ms)** | `MaximumSpawnCompensationMilliseconds` | 150 | The most a freshly spawned object may be caught up through the latency it lost, counted across every hop it travelled. The slider runs from 0 to the engine ceiling, 500, so the inspector cannot author a value the runtime would clamp. |

Spawn compensation is the other half of lag compensation: lag compensation judges a shot against the past, and spawn compensation brings a fresh object, such as a projectile, up to the present. A client watching somebody else's shot is owed what the server already spent plus what the delivery cost it, and the two together are held to this one figure. It also bounds how long a catch-up runs. Raise it to watch the catch-up; on a local link the measured latency never asks for the whole of it. See [Spawn compensation](../../core-api/systems/spawn-compensation.md).

## The view clamp violation

A shooter whose view is older than **Max Rewind (ms)**, or newer than anything the server recorded, is reporting a moment the server could never have shown it. The query clamps the view into range and still judges the shot, so a player on a very slow link still gets results, and raises `LagCompensationViewClampedViolation` against the shooter, carrying the `ReportedTick` and the `ClampedTick` the shot was judged at. It defaults to `ViolationAction.Ignore`.

There is no inspector for violations. Subscribe from code, after the manager root has woken:

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
