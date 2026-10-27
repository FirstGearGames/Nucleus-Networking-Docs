---
title: "Technical limitations"
---

## Some names exist in the code but nothing is wired to them

Some names exist in the engine but nothing wires them up yet. Treat them as documentation of intent, not as working settings.


## These features were built and then deliberately removed

These were built, shipped for a time, and then deliberately torn out. If you find a doc, comment or stale reference describing one, it is not a bug you rediscovered — it is history.

- **Distance-driven send-interval bands** — a middle interest tier that paced a distant object's sends instead of stopping it outright was removed from the shipped interest types. Per-member send interval and transmission mode still exist, but neither is driven by distance.
- **Full-world rollback physics** — client-side resimulation that restored the whole physics world to a snapshot tick and re-stepped it replaying client state was removed once projected sync proved it could stay pop-free without that cost. A reconcile's replay does step physics again today, but it rewinds only the bodies a validated behaviour predicts and holds the rest still; see [Predicting a body with a validated behaviour](../../unity/physics/predicting-a-body-with-a-validated-behaviour.md).

## These features are planned but not built yet

Distinct from the permanent limits above: these are absent because the work hasn't happened, not because the design forbids them. They may ship later.

- **Network profiler window** — an editor window attributing traffic to messages, objects and members. The counters it would read already exist; the window itself does not.

A browser/WebGL transport has no register entry either way: it has neither shipped nor been recorded as planned. Server-side rewind, lag-compensated queries and hitbox history are not on this list because they are built, as the Pro feature described in [How lag compensation works](../lag-compensation/how-lag-compensation-works.md).
