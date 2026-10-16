---
title: "How lag compensation works"
---

> **Driving the core API directly?** See [How lag compensation works](../../core-api/lag-compensation/how-lag-compensation-works.md).

## A client aims at the past

A client draws the world a little behind the server: it holds received state back for interpolation, and every packet already spent half a round trip reaching it. When the player clicks a moving target, the server has already moved that target on, and by the time the shot arrives it has moved again. Judge the shot against the server's present and a player who aimed perfectly misses whatever is moving.

Lag compensation lets the server judge the shot against the world as the shooter saw it. It is a Pro feature. In a free build every name below still exists, so the same scripts compile, but nothing is recorded and every query finds nothing.

## Colliders are never moved

The server does not rewind transforms, colliders or Unity's physics. It keeps its own history of **hitboxes** and does its own geometry:

1. **Record.** A `NetworkHitboxRoot` on a networked object registers every `NetworkHitbox` under it with the server's lag compensation manager. Once per tick, after that tick's state is written, the server records where each hitbox was. On Unity this runs in `LateUpdate`, after animation has posed the bones, so an animated rig is recorded as it was drawn.
2. **Capture.** On the frame the player fires, the client calls `CaptureShot`, which returns a `LagCompensatedShot`: the ray exactly as drawn, and a view naming the server tick on screen and how far the screen had blended toward the next one. The client sends it to the server.
3. **Judge.** The server passes the shot to a query such as `TryRaycast`, which rebuilds every hitbox where the shooter saw it, blended exactly as the shooter's screen blended them, and tests the shot against those shapes.

Because only the history is read, `Physics.Raycast` never sees the past. A hitbox is not a collider and the physics engine never sees it; only the lag-compensated queries do.

## What the server takes care of

- **Blending.** A view between two ticks rebuilds each hitbox between both ticks' poses. The cheap test that rules whole objects out covers every hitbox at every recorded pose, active or not, so a blended hitbox is never culled.
- **Interval targets.** A target whose `NetworkTransform` position is sent on an interval is drawn later by clients, and the server judges it that much earlier by itself.
- **Grouped objects.** A grouped object's hitboxes are recorded once, under one member, so a shot hits each hitbox once.
- **Stopped targets.** A target that despawns stays hittable until its last tick leaves the rewind window, so a shot fired just before it went away still lands.
- **The shooter.** A shot never hits an object its shooter controls.
- **Hosts.** A host's own view is the present, so its own shots are judged against the present.

## The pages that follow

- [Making an object hittable](./making-an-object-hittable.md): `NetworkHitboxRoot`, `NetworkHitbox`, their inspectors, 2D hitboxes and making an object unhittable for a while.
- [Firing and judging a shot](./firing-and-judging-a-shot.md): capturing and sending a shot, every rewound query, ignoring an object and reading a hit.
- [Clipping shots at walls](./clipping-shots-at-walls.md): `LagCompensationWalls`, because walls are not in the history.
- [UnityLagCompensationManager](./unity-lag-compensation-manager.md): the rewind window, the 2D and start-inside settings, the spawn compensation cap, and the clamp violation.
- [Worked example: the HitscanRewind demo](./hitscan-rewind-demo.md).
