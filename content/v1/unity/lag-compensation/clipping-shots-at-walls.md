---
title: "Clipping shots at walls"
---

> **Driving the core API directly?** See [Walls are not in the history](../../core-api/lag-compensation/rewound-queries.md#walls-are-not-in-the-history).

## Walls are judged in the present

Lag compensation records hitboxes, not level geometry, so a rewound query sees no walls. A shot is therefore judged in two steps on the server: clip it against the present-time scene to find how far it can travel, then pass that distance as the range of the lag-compensated query, so the past is judged only within what is left.

`LagCompensationWalls` is the clip:

```csharp
float range = LagCompensationWalls.GetDistance(shot.Origin.ToUnity(), shot.Direction.ToUnity(), maximumRange, wallLayerMask);

bool isHit = lagCompensationManager.TryRaycast(shooterConnection, shot.View, shot.Origin, shot.Direction, range, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

It returns the distance from the origin to the nearest wall along the shot, or the full range when no wall is in reach. Pass it as the range of `TryRaycast` or any other 3D query from the same origin, and `GetDistance2D`'s result to `TryRaycast2D` or any other 2D query.

## Why not a plain Physics.Raycast

A plain `Physics.Raycast` stops on the colliders of networked objects too. An automatic `NetworkHitbox` needs a live collider beside it, so the raycast stops on the target's present-time collider. When the target runs toward the shooter, that collider stands nearer than its rewound hitbox, and a clean hit is judged a miss. A ray from a third-person camera stops on the shooter's own character controller at almost no distance at all.

`LagCompensationWalls` reports the nearest collider on the wall layers that belongs to no networked hitbox object. A collider is passed over when its GameObject has a `NetworkHitbox`, or when it sits on or under a GameObject carrying a `NetworkHitboxRoot`, enabled or not. A disabled root's colliders are passed over too, so making an object unhittable never turns it into cover.

## Triggers never stop a shot

A trigger never stops a shot, whatever `Physics.queriesHitTriggers` and `Physics2D.queriesHitTriggers` say: the casts never report one. A shooter standing inside a pickup or checkpoint volume still fires, and a trigger lying flush with a wall never carries a shot past it. `GetDistance2D` turns `Physics2D.queriesHitTriggers` off for its casts and puts it back before it returns.

## A direction it cannot follow returns zero

The direction does not need to be of unit length. A direction with no length, or one too long to measure (infinite or not a number), returns zero, which stops the shot where it starts, so a client can never clear a shot through walls by sending a direction the check cannot follow.

## The 2D form

`GetDistance2D(Vector2 origin, Vector2 direction, float maximumDistance, LayerMask wallLayerMask)` does the same in the default 2D physics world. A 2D shot fired from the shooter's own center starts inside its own collider, which a 2D raycast hits at distance zero while `Physics2D.queriesStartInColliders` is on. That collider belongs to a networked hitbox object, so it is passed over like any other, and the shot is still clipped only by a wall. `GetDistance2D` keeps `queriesStartInColliders` for its first cast, turns it off for the casts after, and puts it back before it returns. A wall the shot itself starts inside stops it at distance zero while the setting is on, as an ordinary 2D raycast would.

## Scenes in their own physics world

`GetDistance(origin, direction, maximumDistance, wallLayerMask)` looks for walls in `Physics.defaultPhysicsScene`, which holds none of the walls of a scene loaded into its own local physics world. A networked scene loads that way when `UnitySceneLoader.LocalPhysicsEnabled` is on, which the scene manager's stacked-scene simulation setting turns on; see [Local physics scenes](../physics/local-physics-scenes.md). Where that can happen, pass the shooter's physics world first:

```csharp
float range = LagCompensationWalls.GetDistance(shooterScene.GetPhysicsScene(), shot.Origin.ToUnity(), shot.Direction.ToUnity(), maximumRange, wallLayerMask);
```

Passing it is always safe, because for a scene without a world of its own that is the default world. `GetDistance2D` always looks in the default 2D world, because Nucleus only gives a scene a local world for 3D physics.

## It allocates nothing and runs on the main thread

Nothing is kept between calls and nothing is allocated. Call it on the main thread, as with every Unity physics query; a message handler in a Unity session already runs there, because Unity drives the network loop from `Update` and `LateUpdate`.

That step is a known limit: a wall whose near face lies within it, behind the surface of a hitbox object's collider being passed over, is not seen, because the next cast starts past that face and a raycast does not report a collider it starts inside.
