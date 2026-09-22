---
title: "Technical limitations"
---

## Defined but inert

Some names exist in the engine but nothing wires them up yet. Treat them as documentation of intent, not as working settings.

- **Remote-timeout selection** — `RemoteTimeoutType` (`Disabled`, `Release`, `Development`) is a real, documented enum, but no engine code reads it to decide when dead-connection timeouts run. Setting it has no effect today.

## Removed, not missing

These were built, shipped for a time, and then deliberately torn out. If you find a doc, comment or stale reference describing one, it is not a bug you rediscovered — it is history.

- **Distance-driven send-interval bands** — a middle interest tier that paced a distant object's sends instead of stopping it outright was removed from the shipped interest types. Per-member send interval and transmission mode still exist, but neither is driven by distance.
- **Full-world rollback physics** — client-side resimulation that restored the whole physics world to a snapshot tick and re-stepped it replaying inputs was removed once projected sync proved it could stay pop-free without that cost.

## Not built today

Distinct from the permanent limits above: these are absent because the work hasn't happened, not because the design forbids them. They may ship later.

- **Server-side rewind** — validating a shot against the world as the shooter saw it. Planned, not built.
- **Lag-compensated queries** — raycast, sphere and box overlap resolved against historical state at sub-tick accuracy. Planned, not built.
- **Network profiler window** — an editor window attributing traffic to messages, objects and members. The counters it would read already exist; the window itself does not.

Hitbox history and a browser/WebGL transport have no register entry either way — neither shipped nor recorded as planned.
