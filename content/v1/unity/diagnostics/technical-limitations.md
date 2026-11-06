---
title: "Technical limitations"
---

## These behaviors are not supported

Do not design a game that depends on either of these.

- **Send rate does not change with distance.** No shipped interest type slows an object's sends because it is far from a peer. Per-member send interval and transmission mode exist, but neither is driven by distance.
- **A replay does not roll back the whole physics world.** A reconcile's replay rewinds only the bodies a validated behaviour predicts and holds every other body still; see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md).

## These features are planned but not built yet

- **Network profiler window**: an editor window attributing traffic to messages, objects and members.

Lag compensation (server-side rewind, lag-compensated queries and hitbox history) is already built, as a Pro feature. See [How lag compensation works](../lag-compensation/how-lag-compensation-works.md).
