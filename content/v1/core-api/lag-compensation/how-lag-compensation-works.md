---
title: "How lag compensation works"
---

> **Using Unity?** See [Lag compensation in Unity](../../unity/lag-compensation/index.md).

## A client aims at the past

A client draws the world a little behind the server. It holds received state back for interpolation, and every packet it draws already spent half a round trip reaching it. When the player fires at a moving target, the server has already moved that target on, and by the time the shot arrives it has moved again. Judge the shot against the server's present and a player who aimed perfectly misses whatever is moving.

Lag compensation lets the server judge a shot against the world as the shooter saw it. It is a Pro feature; see [What a free build does](#what-a-free-build-does) below.

## Nothing in the scene is moved

`LagCompensationManager`, reached as `CoreManager.LagCompensationManager`, does not rewind objects, colliders or the physics engine. It keeps its own history and does its own geometry:

1. **Record.** Each networked object that can be hit registers a hitbox root: a fixed list of hitbox shapes and an `IHitboxPoseSource` that reports where they are. While this peer runs a server, the manager asks every root for its poses once per tick and keeps them for `MaximumRewindMilliseconds`.
2. **Capture.** On the frame the shooter fires, it calls `CaptureShot`, which returns a `LagCompensatedShot`: the ray exactly as drawn, plus a `LagCompensationView` naming the server tick on screen and how far the screen had blended toward the next one. The shooter sends the shot to the server in a message or remote call.
3. **Judge.** The server passes the shot's view, origin and direction to a query such as `TryRaycast`. The query rebuilds every hitbox between the two recorded ticks the view names, blended exactly as the shooter's screen blended them, and tests the shot against those rebuilt shapes.

Because only the history is read, a query can run at any moment on the server, any number of times, without disturbing the live simulation.

## Recording happens once per tick, after state is written

The manager records on the callbacks of `NetworkLoopSteps.LateSerialize`, which run only on frames that run a tick and after that tick's state has been written. The pose recorded for tick N is therefore the pose tick N's state carried to clients, which is exactly what a client will later draw for tick N.

Only a server records. A registration on a client is refused without an error, so integration code can register on every peer and let the server keep what it needs. When this peer's server stops, every history is released.

Each tick, every root's pose source is called on the network loop. A source that throws is logged, loses only its own slot for that tick, and every other root is still recorded.

## A view is two ticks and a blend

A `LagCompensationView` is a `Tick` and a `Fraction`. `Tick` is the older of two server ticks the screen was blending between, and `Fraction` is how far the screen had blended toward the tick after it, from 0 (exactly `Tick`) to 255 (exactly the next tick). On a client it is read from the pair of server ticks the received state is being presented between and this frame's subtick fraction. On a server or host it is the newest recorded tick with a fraction of zero, because a server's screen shows the present.

A tick spans several rendered frames, and every frame draws a different blend, which is why a shot must be captured on the frame it is fired rather than when the next tick's client state is built. See [Capturing a shot](./capturing-a-shot.md).

## Blended hitboxes are bounded by every recorded pose

A query first rules whole roots out with a cheap test against a bounding sphere, and only rebuilds the hitboxes of a root the query can reach. Each tick's bounding sphere covers every hitbox the root registered, active or not. When a view falls between two ticks, the two ticks' spheres are merged, so the covering sphere holds every hitbox drawn anywhere between its two poses.

That matters because a blended view takes the active hitboxes from whichever of the two ticks is nearer, while drawing each hitbox between both ticks' poses. A hitbox inactive on the older tick and active on the newer one is drawn partly at its older pose; a sphere around the active hitboxes alone would leave that pose out and cull a shot that hits it. For the same reason a pose source writes every hitbox's pose every tick, active or not.

A fraction of exactly 0 or 255 reads that tick's poses as stored and blends nothing.

## Targets sent on an interval are judged where they were drawn

A position sent every tick is drawn sweeping across one tick, so the shooter's view is right for it as it stands. A position sent with `TransmissionMode.Interval` across a window of several ticks is drawn sweeping across that whole window, which puts it that many ticks less one behind. Both peers build the member with the same interval, so the server shifts the view back for that target by itself without being told. A target with no `TransformComponent`, or one that has stopped, is judged at the view as reported.

## Grouped objects are recorded once

A grouped object links several systems, but its hitboxes belong to the object. Recording them under every member would let one shot hit each hitbox once per member, so an integration registers a grouped object's hitboxes once, under one member. The Unity integration prefers the member carrying the object's `TransformComponent`, because the interval shift above needs that member's transform. When a query is told to ignore an object, naming any member of a group skips the whole group, whichever member the hitboxes were recorded under.

## A stopped target stays hittable for the rest of the window

A root whose system stops, or returns to its pool, stops recording, but its history stays readable until its newest recorded tick leaves the rewind window. A target killed a moment before a shot arrives can still be hit by that shot. Its `LagCompensatedHit.NetworkSystem` is then `null`, and `LagCompensatedHit.SystemId` still names it.

A record belongs to one life of its system. A pooled system handed out again, or restarted under the same Id, starts a fresh record, so it can never be found through an old history.

## Spawn compensation is the other half

Lag compensation judges a shot against the past. [Spawn compensation](../systems/spawn-compensation.md) solves the opposite half: it brings a freshly spawned object, such as a projectile, up to the present through the latency it lost on the way. Its cap, `MaximumSpawnCompensationMilliseconds`, lives on `LagCompensationManager` for that reason.

## What a free build does

Every name on these pages exists in both editions, so the same code compiles against either. In a free build every `TryRegisterHitboxRoot` call is refused, with one logged error for the whole session, nothing is recorded, `CaptureView` returns an empty view, `CaptureShot` still carries its ray exactly with an empty view, and every query finds nothing.
