---
title: "Clipping shots at walls"
---

> **Driving the core API directly?** See [Walls are not in the history](../../core-api/lag-compensation/rewound-queries.md#walls-are-not-in-the-history).

## Clip the shot before you judge it

Lag compensation records hitboxes, not level geometry, so a rewound query sees no walls. On the server, judge a shot in two steps:

1. Clip it against the present scene with `LagCompensationWalls.GetDistance`, which returns the distance to the nearest wall along the shot, or the full range when no wall is in reach.
2. Pass that distance as the range of `TryRaycast` or any other 3D query from the same origin. For 2D, pass `GetDistance2D`'s result to `TryRaycast2D` or any other 2D query.

```csharp
float range = LagCompensationWalls.GetDistance(shot.Origin.ToUnity(), shot.Direction.ToUnity(), maximumRange, wallLayerMask);

bool isHit = lagCompensationManager.TryRaycast(shooterConnection, shot.View, shot.Origin, shot.Direction, range, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

Call it on the main thread, as with every Unity physics query. A message handler in a Unity session already runs there. It allocates nothing.

## Don't clip with a plain Physics.Raycast

A plain `Physics.Raycast` also stops on the colliders of networked objects. An automatic `NetworkHitbox` needs a live collider beside it, so the raycast stops on the target's present-time collider. When the target runs toward the shooter, that collider stands nearer than its rewound hitbox, and a clean hit is judged a miss. A ray from a third-person camera stops on the shooter's own character controller almost at once.

`LagCompensationWalls` passes over a collider when its GameObject has a `NetworkHitbox`, or when it sits on or under a GameObject carrying a `NetworkHitboxRoot`, enabled or not. A disabled root's colliders are passed over too, so making an object unhittable never turns it into cover.

One limit follows: a wall whose near face lies inside a passed-over collider of a hitbox object is not seen.

## Triggers never stop a shot

A trigger never stops a shot, whatever `Physics.queriesHitTriggers` and `Physics2D.queriesHitTriggers` say. A shooter standing inside a pickup or checkpoint volume still fires, and a trigger flush with a wall never carries a shot past it.

## A direction it cannot follow returns zero

A direction with no length, or an infinite or NaN one, returns zero, which stops the shot where it starts. A client can never clear a shot through walls by sending a direction the check cannot follow. Any other direction need not be of unit length.

## Use GetDistance2D for 2D

`GetDistance2D(Vector2 origin, Vector2 direction, float maximumDistance, LayerMask wallLayerMask)` does the same in the default 2D physics world. A 2D shot fired from the shooter's center starts inside its own collider, which is passed over like any other hitbox object's collider. A wall the shot itself starts inside stops it at distance zero while `Physics2D.queriesStartInColliders` is on, as an ordinary 2D raycast would.

## Pass the physics scene when scenes have their own

`GetDistance(origin, direction, maximumDistance, wallLayerMask)` looks in `Physics.defaultPhysicsScene`, which holds none of the walls of a scene loaded into its own local physics world. A networked scene loads that way when `UnitySceneLoader.LocalPhysicsEnabled` is on, which the scene manager's stacked-scene simulation setting turns on; see [Local physics scenes](../physics/local-physics-scenes.md). Where that can happen, pass the shooter's physics scene first:

```csharp
float range = LagCompensationWalls.GetDistance(shooterScene.GetPhysicsScene(), shot.Origin.ToUnity(), shot.Direction.ToUnity(), maximumRange, wallLayerMask);
```

This is always safe, because a scene without its own world returns the default one. `GetDistance2D` always uses the default 2D world, because Nucleus only gives a scene a local world for 3D physics.
