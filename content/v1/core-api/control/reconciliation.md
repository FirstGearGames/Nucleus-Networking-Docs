---
title: "Reconciliation and replay"
---

> **Using Unity?** See [Replaying a correction in Unity](../../unity/control/reconcile-in-unity.md).

A predicted member on a controller can diverge from the server: the local prediction and the server's outcome disagree beyond wire tolerance, or the ring history is too shallow to still hold the echoed tick. When that happens the member is rewound to the server's value and the owning `NetworkSystem` asks game code to replay forward from the rewind point. Reconciliation is this rewind-and-replay contract.

## ReconcileRequired

`NetworkSystem.ReconcileRequired` is an event of type `ReconcileRequiredHandler(uint rewoundTick)`. It fires once per inbound apply pass, after every connection's packets for that pass have landed, not once per corrected member. If a tick's packets correct several members across a system, they are all folded into a single raise, carrying the earliest rewound tick among them.

`rewoundTick` is the local tick that member histories were rewound onto. The server's value parked there already includes that tick's input, so replay from the tick after it. It is `NetworkLoopManager.UnsetTick` when the correction was a snap with no replay target: a full-state correction sent with `SendReconcile` that landed with no processed-input echo to rewind onto.

Only two things raise it: a predicted member rewound onto the server's value, and a server `SendReconcile`. A server correction of the controller's inputs does not; that raises `NetworkInputComponent.InputCorrected` with the corrected tick instead.

```csharp
public delegate void ReconcileRequiredHandler(uint rewoundTick);

public event ReconcileRequiredHandler? ReconcileRequired;
```

Subscribe to this event to drive a replay. It raises during the same apply pass that produced the correction, ahead of the `Reconcile` loop step, so a handler that defers its actual re-simulation to that step sees the tick's complete corrected state rather than a partial one.

## BeginReplayTick and EndReplayTick

Re-simulating a past tick means running the same game logic that produced it the first time, but the result has to land in that tick's slot in the member ring, not at the live head. `BeginReplayTick` and `EndReplayTick` are the write redirect that makes this possible:

```csharp
public void BeginReplayTick(uint tick);
public void EndReplayTick();
```

`BeginReplayTick(tick)` redirects every state member's value writes on the system onto the ring slot for `tick`, until `EndReplayTick()` restores them to the live head. Every replayed tick must be bracketed by a matching begin/end pair: a write issued outside a redirect lands at the head and stomps the value the framework is still comparing against, instead of rebuilding history for the tick it belongs to.

Re-simulate strictly past ticks (everything before the current one) through this redirect. Apply the final, current-tick values normally, without a redirect.

## Where the corrected value lands

The rewind that triggers `ReconcileRequired` writes the server's value into the echoed tick's own ring slot. Every ring slot for a later tick — the predictions built on top of the now-wrong state — is cleared, because they were computed from a value the replay is about to overwrite. The ring's head parks on the corrected slot, so the member's current value reads as the server's value until the replay moves it forward again.

This is what makes `rewoundTick` a correct base to resume from: nothing later in the ring can still be trusted, and the corrected slot is the last one that can. The replay itself starts at `rewoundTick + 1`, since the corrected value already includes that tick's input.

## A correction is not a stop

Landing the corrected value is not the end of the job. The replay has to carry the object forward from the tick after `rewoundTick` through to the current tick, re-running each intermediate tick's simulation under `BeginReplayTick`/`EndReplayTick` and feeding it that tick's original inputs, before letting the final tick apply live. Stopping at the rewound tick leaves the object sitting at a past state while the rest of the game has already moved on; the visible object would freeze or teleport instead of continuing to predict.

## SendReconcile

`SendReconcile(Connection)` is the server side of a forced, full-state correction: the server pushes a system's complete current state to one connection outright, rather than waiting for the controller's own prediction to drift out of tolerance on its own. The correction is queued and sent to that connection at the end of the tick.

```csharp
public void SendReconcile(Connection connection);
```

Only the server can call it; a client attempting to reconcile a system is refused with a logged error, and nothing is queued. A reconcile is the one kind of correction that must never travel upstream, since accepting one from a client would let it overwrite any system on the server outright.

A server reaches for this when it needs to force a correction outside the normal predicted-member compare: for example, after a gameplay event that invalidates a controller's prediction in a way the ordinary tolerance check would not catch (a teleport, a respawn, an out-of-band state change the client had no input to predict). On arrival, the receiving system applies the full state and then requests a replay itself, so `ReconcileRequired` fires even for systems whose predicted members had nothing to compare against.

## See also

Physics convergence followers can hide the visual jump a rewind produces — see the Physics documentation for how a follower interpolates toward the corrected pose instead of snapping to it.
