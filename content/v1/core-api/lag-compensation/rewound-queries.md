---
title: "Judging a shot with rewound queries"
---

> **Using Unity?** See [Firing and judging a shot](../../unity/lag-compensation/firing-and-judging-a-shot.md).

## Every query takes a shooter and a view

Each `LagCompensationManager` query rebuilds every registered hitbox where the shooter saw it and tests the shot against them. All of them start with the same two arguments:

- `shooterConnection`: the `Connection` that fired, normally `MessageContext.SenderConnection`. Its view is checked against what the server could have shown it, and hitboxes on any object it controls are skipped, so a shot never hits its own shooter. Pass `null` for a shot the server fires itself.
- `lagCompensationView`: the view captured when the shot was fired, normally `LagCompensatedShot.View`. An empty view, `default`, means the present.

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

The layer mask has one bit per hitbox layer. A query never moves anything and allocates nothing, so it can run as often as you need.

## Pick a 3D query

| Query | Returns | Use it for |
| --- | --- | --- |
| `TryRaycast` | the nearest hit | a hitscan shot |
| `RaycastAll` | every hit, nearest first | a piercing shot |
| `TrySphereCast` | the first hitbox a swept sphere touches | a thick shot that stops at the first thing it touches |
| `SphereCastAll` | every hitbox a swept sphere touches, nearest first | a thick piercing shot |
| `OverlapSphere` | every hitbox a sphere overlaps, nearest first | an explosion |
| `OverlapCapsule` | every hitbox a capsule overlaps, nearest first | a melee swing |
| `OverlapBox` | every hitbox a rotated box overlaps, nearest first | an area attack |

Casts take their arguments in Unity's physics query order: origin, then radius for a sphere cast, then direction, then maximum distance. A direction does not need to be of unit length. A query with no direction, no reach or a negative radius finds nothing. Every geometric test is exact.

The `All` forms and the overlaps take a `List<LagCompensatedHit>`, clear it, fill it and return the count. Reuse one list so nothing is allocated:

```csharp
private readonly List<LagCompensatedHit> _lagCompensatedHits = new();

int hitCount = lagCompensationManager.OverlapSphere(shooterConnection, view, blastCenter, BlastRadius, HitboxLayerMask, _lagCompensatedHits);

for (int i = 0; i < hitCount; i++)
{
    float falloff = 1f - _lagCompensatedHits[i].Distance / BlastRadius;
    // Apply damage scaled by falloff to _lagCompensatedHits[i].SystemId.
}
```

## Read what a hit reports

`LagCompensatedHit` carries:

- `NetworkSystem`: the system the hitbox belongs to, or `null` when that system has stopped since the judged tick.
- `SystemId`: the system's Id, readable even after it stops.
- `HitboxIndex`: the hitbox's index within its root, in registration order.
- `Layer`: the hitbox's layer.
- `Distance`, `Point` and `Normal`: the first contact.

The contact depends on the query:

- **Ray:** `Distance` is from the origin to the hit, and `Point` is where the ray hit.
- **Cast:** `Distance` is how far the swept shape's center travelled before touching the hitbox, and `Point` is where it first touched.
- **Overlap:** `Point` is the hitbox's nearest point to a sphere's center or a capsule's segment, or, for a box, the point of the hitbox inside it nearest its center. `Distance` is how far that point lies from the core, never more than the radius for a sphere or capsule, so an explosion can read falloff straight from it. When the core itself reaches the hitbox, `Distance` is zero and `Point` is the query's own origin: the sphere's or box's center, or where a capsule's segment, walked from its start, first enters the hitbox. Order those zero-distance capsule hits along the swing by the distance from the segment's start to each `Point`.

`Normal` is the hitbox's outward surface normal at the point, facing the query, and is never zero, so its negation always pushes the hitbox away from the query. At a box's edge or corner it is the direction there that faces the query.

An overlap's `Point` is a contact, not the hitbox's position. To find where the hitbox itself was, look it up through its root.

## Ignore an object

Every query, 3D and 2D, has an overload that takes a `NetworkSystem ignoredNetworkSystem` right after the shooter. Pass the root of the object to ignore, or `null` to ignore nothing:

```csharp
bool isHit = lagCompensationManager.TryRaycast(shooterConnection: null, turretSystem, view, muzzle, aim, MaximumDistance, HitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

The shooter's connection already skips what it controls, so use this overload when that does not cover it: a host firing for its own avatar with a `null` shooter, or a turret or NPC the server fires for.

- Naming any member of a grouped object skips the whole object, even after it despawned.
- Every object parented under the ignored one with `SystemManager.EnsureSetSystemParent`, at any depth, is skipped too, so a carried weapon or shield never blocks its owner's shot. Pass the root: naming a nested object leaves its parent hittable. Detaching an object ends the skip from that tick on.
- A nested object that despawned before the shot is judged is matched only by its own system and group, not through its old parent.

## A ray can start inside a hitbox

`CanQueriesStartInHitboxes` is on by default, matching Unity's `Physics2D.queriesStartInColliders`. A ray whose origin is inside a hitbox, or a sphere or circle cast that starts touching one, hits it at distance zero, with its own origin as the point and a normal facing back along the query. That hit is the nearest one.

Turn it off and a ray or cast ignores every hitbox it starts inside or touching, and goes on to whatever lies beyond. This suits a muzzle that sits inside another object's hitbox. Overlaps are not affected. It is read on every query, so you can change it at any time.

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

`OverlapBox2D` takes radians; multiply a Unity angle in degrees by `Mathf.Deg2Rad` first. A hit on a 2D hitbox has a `Point` and `Normal` with a Z of zero.

A 2D query touches only 2D hitboxes, and a 3D query only 3D hitboxes, so a 2D game that calls `TryRaycast` finds nothing.

Set `Can2DQueriesHit3DHitboxes` to let 2D queries reach 3D hitboxes too. It is read on every query.

- A 2D ray and `OverlapBox2D` touch a 3D hitbox only where the plane Z = 0 cuts it. An `OverlapBox2D` hit's `Point` keeps a Z of zero, but its `Normal` is the 3D hitbox's own and can tilt out of the plane.
- A circle, a 2D capsule and a circle cast reach a 3D hitbox up to their radius either side of the plane.

## Walls are not in the history

Only hitboxes are recorded, so a rewound query sees no walls. Clip the shot first:

1. Raycast the present-time world with your engine against level geometry, skipping the networked objects' own colliders. A target's present-time collider can stand nearer than its rewound hitbox and turn a clean hit into a miss.
2. Pass the distance to the nearest wall as the query's maximum distance.

The Unity integration ships this as [`LagCompensationWalls`](../../unity/lag-compensation/clipping-shots-at-walls.md).
