---
title: "Judging a shot with rewound queries"
---

> **Using Unity?** See [Firing and judging a shot](../../unity/lag-compensation/firing-and-judging-a-shot.md).

## Every query takes a shooter and a view

The server judges a shot with one of `LagCompensationManager`'s queries. Each one rebuilds every registered hitbox where the shooter saw it and tests the shot against those rebuilt shapes. They all begin with the same two arguments:

- `shooterConnection`, the `Connection` that fired, normally `MessageContext.SenderConnection`. Its view is checked against what the server could have shown it, and hitboxes on any object it controls are skipped, so a shot never hits its own shooter. Pass `null` for a shot the server fires itself.
- `lagCompensationView`, the view the shooter captured when it fired, normally `LagCompensatedShot.View`. An empty view, `default`, means the present.

```csharp
private void OnShotReceived(in MessageContext messageContext, ShotMessage shotMessage)
{
    if (!_coreManager.TransportManager.IsServerStarted)
        return;

    LagCompensatedShot shot = shotMessage.Shot;

    if (_coreManager.LagCompensationManager.TryRaycast(messageContext.SenderConnection, shot.View, shot.Origin, shot.Direction, MaximumDistance, HitboxLayerMask, out LagCompensatedHit lagCompensatedHit))
    {
        // Apply damage to lagCompensatedHit.SystemId, scaled by which hitbox lagCompensatedHit.HitboxIndex names.
    }
}
```

The layer mask has one bit per hitbox layer. A query never moves anything and allocates nothing, so it can run as often as the game needs.

## The 3D queries

| Query | Returns | Use it for |
| --- | --- | --- |
| `TryRaycast` | the nearest hit | a hitscan shot |
| `RaycastAll` | every hit, nearest first | a piercing shot |
| `TrySphereCast` | the first hitbox a swept sphere touches | a thick shot that stops at the first thing it touches |
| `SphereCastAll` | every hitbox a swept sphere touches, nearest first | a thick piercing shot |
| `OverlapSphere` | every hitbox a sphere overlaps, nearest first | an explosion |
| `OverlapCapsule` | every hitbox a capsule overlaps, nearest first | a melee swing |
| `OverlapBox` | every hitbox a rotated box overlaps, nearest first | an area attack |

The casts take their arguments in the order Unity's physics queries do: origin, then radius for a sphere cast, then direction, then maximum distance. A direction does not need to be of unit length. A query with no direction, no reach or a negative radius finds nothing.

The `All` forms and the overlaps take a `List<LagCompensatedHit>`, clear it, fill it and return the count. Keep one list and reuse it across calls so nothing is allocated:

```csharp
private readonly List<LagCompensatedHit> _lagCompensatedHits = new();

int hitCount = lagCompensationManager.OverlapSphere(shooterConnection, view, blastCenter, BlastRadius, HitboxLayerMask, _lagCompensatedHits);

for (int i = 0; i < hitCount; i++)
{
    float falloff = 1f - _lagCompensatedHits[i].Distance / BlastRadius;
    // Apply damage scaled by falloff to _lagCompensatedHits[i].SystemId.
}
```

Every geometric test is exact. A swept sphere touches a hitbox exactly where a ray from its center enters the hitbox grown by the radius on every side.

## What a hit reports

`LagCompensatedHit` carries:

- `NetworkSystem`, the system the hitbox belongs to, or `null` when that system has stopped since the judged tick;
- `SystemId`, the Id the system had, which stays readable after it stops;
- `HitboxIndex`, the hitbox's index within its root, in registration order;
- `Layer`, the hitbox's layer;
- `Distance`, `Point` and `Normal`, the first contact.

What the contact means depends on the query:

- **Ray.** `Distance` is from the origin to the hit and `Point` is where the ray hit.
- **Cast.** `Distance` is how far the swept shape's center travelled before it touched the hitbox, and `Point` is the point on the hitbox it first touched.
- **Overlap.** `Point` is where the query first touches the hitbox as it fills out from its core: the hitbox's nearest point to a sphere's center or a capsule's segment, or the point of the hitbox inside a box nearest the box's center. `Distance` is how far that point lies from the core, never more than the radius for a sphere or capsule, so an explosion reads its falloff straight from it. When the core itself reaches the hitbox, `Distance` is zero and `Point` is the query's own origin: the sphere's or box's center, or where a capsule's segment, walked from its start, first enters the hitbox. Order those zero-distance capsule hits along the swing by the distance from the segment's start to each `Point`.

`Normal` is the hitbox's outward surface normal at the point, facing the query, and is never zero, so its negation always pushes the hitbox away from the query. At a box's edge or corner it is the direction there that faces the query.

An overlap's `Point` is a contact, not the hitbox's position. Code that needs where the hitbox itself was should look the hitbox up through its root.

## Ignoring an object

Every query, 3D and 2D, has an overload that takes a `NetworkSystem ignoredNetworkSystem` straight after the shooter. Pass the object to ignore, normally the shooter's own root object, or `null` to ignore nothing:

```csharp
bool isHit = lagCompensationManager.TryRaycast(shooterConnection: null, turretSystem, view, muzzle, aim, MaximumDistance, HitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

The shooter's connection already skips what that connection controls, so the overload is for the cases it cannot cover: a host firing for its own avatar, which passes a `null` shooter, or a turret or NPC the server fires for itself. Naming any member of a grouped object skips the whole object, because a grouped object records its hitboxes under one member, which need not be the member you hold. A history that has ended keeps the group its system had, so a shot judged just after the object despawned still skips it.

## A ray can start inside a hitbox

`CanQueriesStartInHitboxes` is on by default, matching Unity's `Physics2D.queriesStartInColliders`. A ray whose origin lies inside a hitbox, or a sphere or circle cast that starts touching one, hits it at distance zero, with its own origin as the point and a normal facing back along the query, and that hit is the nearest one.

Turn it off and a ray or cast ignores every hitbox it starts inside or touching: that hitbox is neither reported nor taken as the nearest hit, and the query goes on to whatever lies beyond. That suits a muzzle that sits inside some other object's hitbox. Overlaps are not affected; they still report every hitbox their volume touches, including one their center lies inside. The setting is read once per query, so it can change at any time.

```csharp
coreManager.LagCompensationManager.CanQueriesStartInHitboxes = false;
```

## 2D queries

The 2D queries take `System.Numerics.Vector2` and run in the plane Z = 0, where `Circle`, `Box2D` and `Capsule2D` hitboxes lie:

| Query | Mirrors |
| --- | --- |
| `TryRaycast2D`, `RaycastAll2D` | `TryRaycast`, `RaycastAll` |
| `TryCircleCast2D`, `CircleCastAll2D` | `TrySphereCast`, `SphereCastAll`, with arguments in `Physics2D.CircleCast`'s order |
| `OverlapCircle` | `OverlapSphere` |
| `OverlapCapsule2D` | `OverlapCapsule` |
| `OverlapBox2D` | `OverlapBox`, with the rectangle turned by `angleRadians` about Z, counterclockwise |

`OverlapBox2D` takes its angle in radians; a Unity angle in degrees is multiplied by `Mathf.Deg2Rad` first. A hit on a 2D hitbox has a `Point` and `Normal` with a Z of zero.

2D and 3D hitboxes are kept apart the way Unity keeps its 2D and 3D physics apart. A 2D query touches only circles, 2D boxes and 2D capsules, and a 3D query only spheres, boxes and capsules. A 3D query never touches a 2D hitbox, which has no depth for it to meet, so a 2D game that calls `TryRaycast` finds nothing.

A game that mixes the two can set `Can2DQueriesHit3DHitboxes` to let its 2D queries reach 3D hitboxes as well. A 2D ray and `OverlapBox2D` have no depth, so they touch a 3D hitbox only where the plane Z = 0 cuts it; an `OverlapBox2D` hit's `Point` keeps a Z of zero while its `Normal` is the 3D hitbox's own and can tilt out of the plane. A circle, a 2D capsule and a circle cast have their radius in every direction, so they reach a 3D hitbox as a ball or capsule lying in the plane, up to their radius either side of it. Like the setting above, it is read on every query.

## Walls are not in the history

Only hitboxes are recorded, so a rewound query sees no walls. Clip the shot against the present-time world first, with your own engine's raycast against level geometry, and pass the distance to the nearest wall as the query's maximum distance. Make sure that raycast passes over the colliders of the networked objects themselves: a present-time collider on a target running toward the shooter stands nearer than its rewound hitbox and would turn a clean hit into a miss. The Unity integration ships this check as [`LagCompensationWalls`](../../unity/lag-compensation/clipping-shots-at-walls.md).
