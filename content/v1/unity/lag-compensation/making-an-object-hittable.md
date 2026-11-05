---
title: "Making an object hittable"
---

> **Driving the core API directly?** See [Registering hitboxes](../../core-api/lag-compensation/registering-hitboxes.md).

## Add the two components

1. Add a `NetworkHitboxRoot` beside the object's `NetworkSystemObject`. It gathers every `NetworkHitbox` on its GameObject and children. Without a `NetworkSystemObject` on the same GameObject, it logs an error and disables itself.
2. Add a `NetworkHitbox` to each part a shot should hit, such as a body, a head or a limb. Each is a single sphere, box or capsule, or in 2D a circle, 2D box or 2D capsule. It is not a collider, and the physics engine never sees it.
3. Put each hitbox's GameObject on the layer your queries filter by. A hitbox's layer is its GameObject's layer.

To do step 2 in one click, use **Add Hitboxes From Colliders** on the root; see [Check what will be recorded](#check-what-will-be-recorded).

Add every hitbox to the prefab. The root gathers its hitboxes once, when the object wakes, inactive ones included, so a hitbox added at runtime is never recorded. Only the server records; on a client the root does nothing.

## Choose where a hitbox takes its shape from

**Setup Mode** (`HitboxSetupMode`) has two values:

- **`Automatic`**, the default, copies the shape from a collider on the same GameObject when the hitbox wakes. It looks for a `SphereCollider`, `BoxCollider`, `CapsuleCollider`, `CircleCollider2D`, `BoxCollider2D` or `CapsuleCollider2D`, in that order, trigger or not. It writes what it copied into its own settings, so switching to `Manual` starts from the collider's values.
- **`Manual`** uses the shape typed into the hitbox, for a part with no collider or a hitbox that should differ from its collider.

A `MeshCollider`, a `PolygonCollider2D`, or a `BoxCollider2D` with an edge radius cannot be tested exactly, so it is refused with an error rather than approximated. An automatic hitbox with nothing it can copy shows a warning in its inspector and is left out of the root.

A manual hitbox has these fields:

- **Shape** (`HitboxShape`).
- **Center**, in local space before scale.
- **Radius**, **Size** and **Height**, as the shape uses them. **Height** is the full height, both rounded ends included.
- **Direction**, for a capsule: a `HitboxAxis` of `X`, `Y` (the default) or `Z`. Its values match `CapsuleCollider.direction`, so a plain cast converts one to the other. A 2D capsule offers only `X` (horizontal) and `Y` (vertical).

## Layers and per-region rules

A query's layer mask chooses which hitbox layers a shot can hit. For per-region rules such as a headshot multiplier, put your own component on the hitbox's GameObject and read it from the hit, rather than spending a layer on each region:

```csharp
if (NetworkHitboxRoot.TryGetHitbox(lagCompensatedHit, out NetworkHitbox networkHitbox) && networkHitbox.TryGetComponent(out DamageZone damageZone))
    damage *= damageZone.Multiplier;
```

`NetworkHitboxRoot.TryGetHitbox(in LagCompensatedHit, out NetworkHitbox)` finds the hitbox a hit names. If the target's system has stopped since the judged tick, the hit is still reported but names no system, so `TryGetHitbox` returns `false`; `lagCompensatedHit.SystemId` still names the target. For an index you already hold, a root also has an instance `TryGetHitbox(int hitboxIndex, out NetworkHitbox)`.

## Scale and offsets follow Unity's colliders

A 3D hitbox scales by `Transform.lossyScale` and places its **Center** through `Transform.TransformPoint`, as Unity's colliders do, so a hitbox and its collider agree at every depth. Scale is recorded every tick, so an object that grows or shrinks is judged at the size it had on the viewed tick. Neither a collider nor a hitbox represents exactly a non-uniformly scaled parent over a rotated child.

## 2D hitboxes lie in the plane Z = 0

A `Circle`, `Box2D` or `Capsule2D` hitbox is recorded in the plane Z = 0, whatever depth its object sits at, so sorting depth never moves it out of a shot. It follows its transform the way Unity's 2D colliders do:

- A half turn about Y, such as a sprite flip, mirrors it.
- A tilt about its own X or Y axis foreshortens a box or capsule.
- A circle stays round and takes the larger of its world X and Y scales.
- A tilt about any other axis makes the collider a parallelogram, which the hitbox follows as the rectangle along the flattened X axis.

2D hitboxes are judged only by the 2D queries, and 3D hitboxes only by the 3D ones, unless **2D Queries Hit 3D Hitboxes** is ticked on the [lag compensation manager](./unity-lag-compensation-manager.md).

## Check what will be recorded

A selected `NetworkHitbox` draws the exact shape the server will record, in orange, so you can compare it with the collider's outline. A selected `NetworkHitboxRoot` draws every hitbox it gathers, inactive ones included.

The `NetworkHitbox` inspector shows its setup mode, then either the shape fields or the shape copied from the collider. It warns when it finds no collider it can copy, and when no `NetworkHitboxRoot` is on its GameObject or above it, since such a hitbox is never recorded.

In edit mode, the `NetworkHitboxRoot` inspector offers:

- **Add Hitboxes From Colliders**, also in the root's context menu. It adds an automatic `NetworkHitbox` beside every solid collider under the root that has none yet, inactive GameObjects included. It skips triggers, which a shot passes through; colliders whose GameObject already has a hitbox, since a GameObject holds one; colliders no hitbox can copy; and any collider that is not the one an automatic hitbox on that GameObject would copy first. The Console lists what was added and what was skipped and why, and one undo takes back a whole click.
- **The hitbox table**, listing every hitbox in the order the root gathers them, with its GameObject, shape, layer, 2D or 3D, and whether it is usable. The **#** column is the `HitboxIndex` a hit reports. A hitbox with no usable shape takes no index, so every hitbox after it reports an index one lower than its place in the list. Click a name to find it, and double-click to select it.
- **Warnings** for a root that would record nothing: no `NetworkSystemObject` on its GameObject, no `NetworkHitbox` found, no hitbox with a usable shape, or more than 64 usable hitboxes, the most one root can hold. It also lists unusable hitboxes, and notes a root that mixes 2D and 3D hitboxes.

To log the same errors for every prefab, open the Nucleus window (**Tools > Nucleus**), select the **Build** tab, and click **Validate** next to **Validate Network Prefabs**.

While playing, the root inspector shows how many hitboxes were gathered and whether the server is recording the root (`IsRecording`).

## Make an object unhittable for a while

A hitbox that is disabled, or whose GameObject is inactive, on a given tick is recorded but never hit on that tick. To make the whole object unhittable, for a downed, spawn-protected or ragdolled player, disable the root from code on the server:

```csharp
networkHitboxRoot.enabled = false;
```

Neither component shows an enable checkbox in the inspector. A disabled root keeps recording, so a shot judged at a tick it was disabled on misses it however late the shot arrives. It is hittable again from the first tick recorded after `enabled = true`. Its colliders stay in the scene throughout, and [`LagCompensationWalls`](./clipping-shots-at-walls.md) passes over them either way.
