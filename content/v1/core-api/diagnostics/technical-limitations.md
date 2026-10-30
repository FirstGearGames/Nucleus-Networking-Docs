---
title: "Technical limitations"
---

## Some names exist in the code but nothing is wired to them

Some names exist in the engine but nothing wires them up yet. Treat them as documentation of intent, not as working settings.


## These behaviors are not supported

Do not design a game that depends on either of these.

- **Send rate does not change with distance.** No shipped interest type slows an object's sends because it is far from a peer. Per-member send interval and transmission mode exist, but neither is driven by distance.
- **A replay does not roll back the whole physics world.** A reconcile's replay steps physics again, but it rewinds only the bodies a validated behaviour predicts and holds every other body still; see [Predicting a body with a validated behaviour](../../unity/physics/predicting-a-body-with-a-validated-behaviour.md).

## These features are planned but not built yet

These may ship in a later version.

- **Network profiler window** — an editor window attributing traffic to messages, objects and members. The counters it would read already exist; the window itself does not.

There is no browser or WebGL transport, and one is not currently planned. Server-side rewind, lag-compensated queries and hitbox history are not on this list because they are built, as the Pro feature described in [How lag compensation works](../lag-compensation/how-lag-compensation-works.md).
