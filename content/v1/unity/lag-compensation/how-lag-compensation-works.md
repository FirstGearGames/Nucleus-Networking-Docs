---
title: "How lag compensation works"
---

> **Driving the core API directly?** See [How lag compensation works](../../core-api/lag-compensation/how-lag-compensation-works.md).

A client draws the world a little behind the server, so when a player fires at a moving target, the server has already moved it on. Lag compensation lets the server judge the shot against the world as the shooter saw it.

Lag compensation is Pro. In a free build every name below still exists, so the same scripts compile, but nothing is recorded and every query finds nothing.

## The server keeps its own hitbox history

The server never rewinds transforms, colliders or Unity's physics. It records **hitboxes** and tests shots against that record:

1. **Record.** A `NetworkHitboxRoot` on a networked object registers every `NetworkHitbox` under it. Once per tick the server records where each hitbox was, after animation has posed the bones, so an animated rig is recorded as it was drawn. See [Making an object hittable](./making-an-object-hittable.md).
2. **Capture.** On the frame the player fires, the client calls `CaptureShot`, which returns a `LagCompensatedShot`: the ray exactly as drawn, and a view of what was on screen. The client sends it to the server.
3. **Judge.** The server passes the shot to a query such as `TryRaycast`, which rebuilds every hitbox where the shooter saw it and tests the shot against those shapes. See [Firing and judging a shot](./firing-and-judging-a-shot.md).

A hitbox is not a collider, so `Physics.Raycast` never sees the past. Only the lag-compensated queries do. Walls are not recorded either; see [Clipping shots at walls](./clipping-shots-at-walls.md).

## The server handles these cases for you

- **Blending.** A view between two ticks rebuilds each hitbox between both ticks' poses, as the shooter's screen blended them.
- **Interval targets.** A target whose `NetworkTransform` position is sent on an interval is drawn later by clients, and the server judges it that much earlier.
- **Grouped objects.** A grouped object's hitboxes are recorded once, so a shot hits each hitbox once.
- **Stopped targets.** A target that despawns stays hittable until its last tick leaves the [rewind window](./unity-lag-compensation-manager.md), so a shot fired just before it went away still lands.
- **The shooter.** A shot never hits an object its shooter controls.
- **Hosts.** A host's view is the present, so its own shots are judged against the present.
