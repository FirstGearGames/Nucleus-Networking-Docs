---
title: "Making an object hittable"
---

> **Driving the core API directly?** See [Registering hitboxes](../../core-api/lag-compensation/registering-hitboxes.md).

## Two components

A networked object becomes hittable with two components:

- **`NetworkHitboxRoot`**, beside the object's `NetworkSystemObject`. It gathers every `NetworkHitbox` on its GameObject and children and registers them with the server's lag compensation manager.
- **`NetworkHitbox`**, on each part a shot should hit: a body, a head, a limb. Each one is a single sphere, box or capsule, or for a 2D game a circle, 2D box or 2D capsule, whose world pose the server records every tick. It is not a collider, and the physics engine never sees it.

The root registers when the object's system links and lets go when it unlinks, so a pooled object registers afresh on every life. Only a server records: the root does the same thing on every peer, and on a client the registration is refused quietly and the component does nothing. A root without a `NetworkSystemObject` on the same GameObject logs an error and disables itself.

## Where a hitbox takes its shape from

`NetworkHitbox`'s **Setup Mode** is a `HitboxSetupMode`:

- **`Automatic`**, the default, copies the shape from a collider on the same GameObject when the hitbox wakes. It looks for a `SphereCollider`, `BoxCollider`, `CapsuleCollider`, `CircleCollider2D`, `BoxCollider2D` or `CapsuleCollider2D`, in that order, trigger or not, so a hitbox added beside an existing collider matches it with no further setup. It writes what it copied into its own settings, so switching to `Manual` starts from the collider's values.
- **`Manual`** uses the shape typed into the hitbox itself, for a part with no collider, or a hitbox that should differ from the collider it has.

Any other collider, a `MeshCollider` or `PolygonCollider2D` for one, has no exact test and is refused with an error rather than approximated, and so is a `BoxCollider2D` with an edge radius, whose rounded corners have none either. An automatic hitbox with nothing it can copy shows a warning in its inspector and is left out of the root.

A manual hitbox has a **Shape** (`HitboxShape`), a **Center** in local space before scale, and the fields its shape uses: **Radius**, **Size** and **Height** (the full height, both rounded ends included). A capsule's **Direction** is a `HitboxAxis`, `X`, `Y` (the default) or `Z`, whose values match `CapsuleCollider.direction`, so a collider's direction converts by a plain cast. A 2D capsule runs along `X` for a horizontal capsule or `Y` for a vertical one, and its inspector offers just those two.

## Layers and per-region rules

A hitbox's layer is its GameObject's layer. A query's layer mask chooses which layers a shot can hit, so put each hitbox's GameObject on the layer your queries should filter by.

For per-region rules such as a headshot multiplier, put your own component on the hitbox's GameObject and read it from a hit, rather than spending a layer on each region:

```csharp
if (NetworkHitboxRoot.TryGetHitbox(lagCompensatedHit, out NetworkHitbox networkHitbox) && networkHitbox.TryGetComponent(out DamageZone damageZone))
    damage *= damageZone.Multiplier;
```

`NetworkHitboxRoot.TryGetHitbox(in LagCompensatedHit, out NetworkHitbox)` follows the hit's system to the networked object linked to it, and its `HitboxIndex` to the hitbox. A target whose system has stopped since the judged tick is still hit, but its hit names no system, so it cannot be followed back to a GameObject; `TryGetHitbox` returns `false`, and `lagCompensatedHit.SystemId` still names the target. A root also has an instance `TryGetHitbox(int hitboxIndex, out NetworkHitbox)` for an index you already hold.

## Scale and offsets follow Unity's colliders

A 3D hitbox's scale is its world scale, `Transform.lossyScale`, the product of every scale above it, which is what Unity's own colliders use, so a hitbox and its collider agree at every depth. The center offset goes through `Transform.TransformPoint`, so it is scaled and rotated by the whole parent chain too. Scale is recorded every tick, so an object that grows or shrinks is judged at the size it had on the viewed tick. The one case neither a collider nor a hitbox represents exactly is a non-uniformly scaled parent over a rotated child, which skews the child.

## 2D hitboxes

A `Circle`, `Box2D` or `Capsule2D` hitbox is recorded in the plane Z = 0, whatever depth its object sits at, so sorting depth never moves it out of a shot. It reads its transform the way Unity's 2D colliders do: a half turn about Y, a sprite flip, mirrors it, and a tilt about its own X or Y axis foreshortens a box or capsule, exactly as the collider does. A circle stays round and takes the larger of its world X and Y scales. A tilt about any other axis makes the collider a parallelogram, which the hitbox follows as the rectangle along the flattened X axis.

2D hitboxes are judged only by the 2D queries, and 3D hitboxes only by the 3D ones, unless **2D Queries Hit 3D Hitboxes** is ticked on the [lag compensation manager](./unity-lag-compensation-manager.md).

## Seeing what will be recorded

A selected `NetworkHitbox` draws the exact shape the server will record, in orange, scaled exactly as it will be, so it can be checked against the collider's own outline. A selected `NetworkHitboxRoot` draws every hitbox it gathers, inactive ones included, so a whole rig can be checked at once.

The `NetworkHitbox` inspector shows the setup mode, then either the shape fields or a readout of the shape copied from the collider. It warns when no collider it can copy is found, and when no `NetworkHitboxRoot` is on its GameObject or above it, since such a hitbox is never recorded.

## The hitbox root inspector

In edit mode the `NetworkHitboxRoot` inspector does three things.

**Add Hitboxes From Colliders** adds an automatic `NetworkHitbox` beside every solid collider under the root that a hitbox can copy and that has no hitbox yet, inactive GameObjects included. The same command is in the root's context menu. It skips a trigger, which a shot passes through; a collider whose GameObject already has a hitbox, since a GameObject holds one; a collider no hitbox can copy; and a collider that is not the one an automatic hitbox on that GameObject would copy first. The Console lists what was added and what was skipped and why, and one undo takes back everything a click added.

**The hitbox table** lists every hitbox the root will find, in the order it gathers them, with its GameObject, shape, layer, whether it is 2D or 3D, and whether it is usable. The **#** column is the `HitboxIndex` a hit reports. A hitbox with no usable shape takes no index, so every hitbox after it reports an index one lower than its place in the list, as the column shows. Click a name to find it, and double-click to select it.

**Warnings** flag a root that would record nothing: no `NetworkSystemObject` on its GameObject, no `NetworkHitbox` found, no hitbox with a usable shape, or more than 64 usable hitboxes, the most one root can hold. It also lists any unusable hitboxes, and notes a root that mixes 2D and 3D hitboxes. **Tools > Nucleus > Build > Validate Network Prefabs** logs the same errors for every prefab, using the same rules.

While playing, the inspector shows how many hitboxes were gathered and whether the server is recording the root (`IsRecording`).

## The hitboxes are gathered once

A root gathers its hitboxes once, when the object wakes, inactive ones included. Add every hitbox to the prefab rather than at runtime. A hitbox that is disabled, or whose GameObject is inactive, on a given tick is recorded but never hit on that tick.

## Making an object unhittable for a while

Disable the root to make the whole object unhittable, for a downed, spawn-protected or ragdolled player:

```csharp
networkHitboxRoot.enabled = false;
```

A disabled root reports every hitbox inactive, so it is never hit. It keeps recording while disabled, writing every pose as usual, so a shot judged at a tick it was disabled on misses it however late the shot arrives, and it is hittable again from the first tick recorded after `enabled = true`. Neither component shows an enable checkbox in the inspector, so do it from code, on the server. Its colliders stay in the scene throughout, and [`LagCompensationWalls`](./clipping-shots-at-walls.md) passes over them either way.

## Grouped objects record once

A grouped object links several systems to one GameObject, but its hitboxes belong to the object, so the root records them once, under one member, and a shot hits each hitbox once. It prefers the member carrying the object's `TransformComponent`, because a target whose position arrives on an interval is judged where its transform was drawn, which only that member's history knows. Until that member links, the first member to link stands in, and nothing it recorded is lost. A member that leaves on its own hands the recording to one that remains.
