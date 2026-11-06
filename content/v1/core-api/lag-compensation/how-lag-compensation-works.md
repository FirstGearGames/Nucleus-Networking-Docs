---
title: "How lag compensation works"
---

> **Using Unity?** See [Lag compensation in Unity](../../unity/lag-compensation/index.md).

## A client aims at the past

A client draws the world a little behind the server, so by the time a shot reaches the server, a moving target has moved on. Judged against the server's present, a perfectly aimed shot misses. Lag compensation lets the server judge a shot against the world as the shooter saw it. It is a Pro feature; see [What a free build does](#what-a-free-build-does).

## The server judges against its own hitbox history

`LagCompensationManager`, reached as `CoreManager.LagCompensationManager`, never moves objects, colliders or the physics engine. It keeps its own history of hitboxes:

1. **Record.** Each object that can be hit registers a hitbox root: a fixed list of hitbox shapes and an `IHitboxPoseSource` that reports where they are. The server records every root's poses once per tick and keeps them for `MaximumRewindMilliseconds`. See [Registering hitboxes](./registering-hitboxes.md).
2. **Capture.** On the frame the shooter fires, it calls `CaptureShot`, which returns a `LagCompensatedShot`: the ray exactly as drawn, plus a `LagCompensationView` naming what was on screen. The shooter sends the shot to the server. See [Capturing a shot](./capturing-a-shot.md).
3. **Judge.** The server passes the shot to a query such as `TryRaycast`, which rebuilds every hitbox as the shooter's screen showed it and tests the shot against them. See [Judging a shot with rewound queries](./rewound-queries.md).

A query only reads the history, so the server can run any number of them at any time without disturbing the live simulation.

Only a server records. Registering on a client is refused without an error, so integration code can register on every peer. When this peer's server stops, every history is released.

## A view is a tick and a blend

A `LagCompensationView` has a `Tick`, the older of the two server ticks the screen was blending between, and a `Fraction` toward the next tick, from 0 (exactly `Tick`) to 255 (exactly the next tick). On a server or host, the view is the newest recorded tick with a fraction of zero, because a server's screen shows the present.

A target whose position is sent with `TransmissionMode.Interval` is drawn behind by part of its interval. The server judges it where the shooter drew it, with no extra work from you.

## A stopped target stays hittable for the rest of the window

A root whose system stops or returns to its pool stops recording, but its history stays readable until its newest tick leaves the rewind window. So a target killed a moment before a shot arrives can still be hit by it. The hit's `LagCompensatedHit.NetworkSystem` is then `null`, and `LagCompensatedHit.SystemId` still names it.

A pooled system handed out again, or restarted under the same Id, starts a fresh history and can never be found through the old one.

Lag compensation judges a shot against the past. Its counterpart, [spawn compensation](../systems/spawn-compensation.md), brings a freshly spawned object up to the present.

## What a free build does

Every name on these pages exists in both editions, so the same code compiles against either. In a free build:

- every `TryRegisterHitboxRoot` call is refused, with one logged error for the whole session, and nothing is recorded;
- `CaptureView` returns an empty view, and `CaptureShot` carries its ray exactly with an empty view;
- every query finds nothing.
