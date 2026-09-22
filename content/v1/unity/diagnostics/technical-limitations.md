---
title: "Technical limitations"
---

## Permanent design limits

These are not gaps waiting to be filled. Each is a deliberate boundary, and no configuration or future release moves it.

### Delta serialization is scoped on purpose

Delta serializers exist for numerics, quaternions, collections, nullables and generated composites. A type outside that set throws when the generator is asked to build a delta serializer for it, rather than falling back to a guess at how to encode a change. Silently mis-encoding a type nobody validated is worse than a build-time error naming exactly which type needs a full serializer instead.

### Tick rate is fixed for the session

`TickRate` is supplied once to `NetworkLoopManager`'s constructor, clamped to `MinimumTickRate` (5) through `MaximumTickRate` (128), and never exposed with a setter. Every rate-derived value in the engine, the loop provider's tick interval, the state retention window, each member's send interval in ticks, is baked from it once at construction. Changing the rate mid-session would leave all of those derivations describing a rate the loop no longer runs at, so there is no supported way to do it. Pick the rate before the `CoreManager` is built.

### One loop drives one manager

`NetworkLoopManager.InvokeNetworkLoopStep` claims the step with an interlocked compare-exchange against the thread currently running one. A second thread trying to drive the same loop while a step is in progress is turned away rather than run, and the rejection is logged (throttled to once per `SecondDriverReportIntervalSeconds`, 60 seconds) rather than silently dropped. A reentrant call from the thread that already holds the step still runs normally. Two update sources — for example a custom `INetworkLoopStepProvider` alongside a manually driven step — cannot share one `CoreManager`.

### Free and Pro differ by file presence, not by flag

`Nucleus.csproj` drops every `*.Pro.cs` file from compilation when built with `-p:NucleusEdition=Free`. Nothing is conditionally compiled and no preprocessor symbol distinguishes the editions; what a build contains is decided entirely by which files are on disk. Bit-packing brackets are the one setting that forks the wire between editions: Free and Pro pack differently, so a Free peer and a Pro peer exchanging state must both build the same edition. What the packing difference costs or saves is edition-specific and not part of this page.

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
