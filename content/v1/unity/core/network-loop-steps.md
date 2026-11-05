---
title: "The network loop steps"
---

> **Driving the core API directly?** See [The network loop steps](../../core-api/core/network-loop-steps.md).

Every frame walks the loop's named steps in one fixed order. A `NucleusBehaviour` hooks a step by overriding its virtual, such as `OnLateStateUpdate`. Each step is one flag of the `NetworkLoopSteps` enum. To hook steps from a class that is not a `NucleusBehaviour`, implement `INetworkLoopStepCallback`, as the core API page shows.

## The eleven steps run in this order

| Step | Virtual | Runs | What to know |
|---|---|---|---|
| `EarlyVariableUpdate` | `OnEarlyVariableUpdate` | Every frame | Packets are received before your callback, and received messages reach their handlers after it. |
| `EarlyStateUpdate` | `OnEarlyStateUpdate` | Each tick | State received this tick is not applied yet, so a read can still see last tick's value. |
| `LateStateUpdate` | `OnLateStateUpdate` | Each tick | `PresentedTick` has caught up to `Tick`, and the state and RPCs received this tick are applied before your callback. Read replicated state here or later. |
| `Reconcile` | `OnReconcile` | Each tick | |
| `EarlyFixedUpdate` | `OnEarlyFixedUpdate` | Each elapsed tick interval | |
| `LateFixedUpdate` | `OnLateFixedUpdate` | Each elapsed tick interval | |
| `VariableUpdate` | `OnVariableUpdate` | Every frame | Put code that must run every frame here. |
| `EarlySerialize` | `OnEarlySerialize` | Each tick | Write the values you want sent this tick here. |
| `LateSerialize` | `OnLateSerialize` | Each tick | Changed state is written before your callback, so a member write here rides the next tick. Messages, RPCs and kicks, including any sent from this callback, leave after it. |
| `TickAdvance` | `OnTickAdvance` | Each tick | `Tick` increments after your callback, so `LateVariableUpdate`, the frames until the next tick and every message handler read the tick their writes will ride. |
| `LateVariableUpdate` | `OnLateVariableUpdate` | Every frame | |

## Do not expect a tick step every frame

- A frame that does not reach the next tick runs only the three variable steps.
- A frame runs at most one tick. The fixed steps run once for each tick interval that has passed, so after a long frame they can run twice on one frame.
- Anything moved every frame should move by `StepDelta.NormalizedDelta`, not the raw frame delta. See [Tick rate and the loop in Unity](./unity-tick-rate-and-the-loop.md).

Messages, RPCs and kicks are sent on every frame, not only on frames that tick: on a frame without a tick they leave at `LateSerialize`'s place in the order, with no callback raised. One queued from `OnTickAdvance` or `OnLateVariableUpdate` leaves on the next frame.

Typed messages reach their handlers on `EarlyVariableUpdate`, and system RPCs on `LateStateUpdate`. See [When a message or call reaches its handler](../messaging/message-and-call-timing.md).
