---
title: "Diagnosing desync"
---

## Work the layers in order

"It looks wrong on the other peer" is four different bugs with one symptom. Check them in this order, because each rules out the ones below it:

1. **Is the object there at all?** If the receiver never spawned it, or it vanished, this is interest: an `IInterestCondition` culled the pair (`InterestEffect.Spawn`, resolving to `InterestMembership.Unspawned`), or a real despawn happened.
2. **Is it there but frozen?** This is `InterestEffect.Stop`: the pair resolved to `InterestMembership.Stopped`, which keeps the receiver's object but stops sending it updates. It looks like a dead connection, but it is not.
3. **Is it there and moving, but wrong?** A member holds a value that does not match the sender. Either the value never changed on the receiver, or it changed to something incorrect.
4. **Is it there and correct, but late?** This is interpolation and the retention window, not a data bug.

Do not skip ahead. A value that "looks wrong" because the object was culled five seconds ago is not a serializer bug.

## Split a wrong value into never arrived or arrived wrong

At step 3, decide which of these you have before touching a serializer:

- **The value never changes on the receiver.** This is observation or access. Is the Connection an observer of that `NetworkSystem`? Did an interest condition stop it (step 2)? Does the sender own or control the member it is changing? Usually the write never left the sender or never reached this receiver.
- **The value changes, but to the wrong thing.** This is serialization or prediction. Look at how the member is sent (`TransmissionMode.Divine` or `TransmissionMode.Interval`), or, for a controlled member, at prediction and reconciliation on the controlling side.

## Read the violation stream first

Most desyncs that are protocol faults raise a violation before you notice anything visually. Register an `IViolationObserver` to hear every type, or subscribe to a per-type event such as `UnauthorizedMemberChangeViolationDetected`. See [Violations](./violations.md).

The types worth knowing when chasing desync:

- `UnauthorizedMemberChangeViolation`: a peer changed a member of a `NetworkSystem` it does not control.
- `PredictedMemberChangeViolation`: a controller sent a value for a predicted member, which should only travel as client state.
- `EmptyCollectionDeltaViolation`: a collection change with no operations, which a compliant sender cannot produce. Usually a crafted packet or mismatched builds.
- `InvalidStateAckViolation`: a peer acknowledged a tick above anything sent to it.
- `RetentionExceededViolation`: a peer's acknowledged tick fell beyond the retention window, so it was re-sent the whole world. A single raise is ordinary heavy loss. Chronic raises mean the peer's latency exceeds `SystemManager.StateRetentionMilliseconds`, or it is withholding acknowledgments.
- `RecoveryUnconfirmedViolation`: recoveries were served to a Connection without it confirming one.
- `UnauthorizedSpawnViolation`: a client sent state naming a system id the server does not hold.

A matching raise points straight at the subsystem. If nothing is raised, the fault is in something violations do not police: an interest decision, ordinary loss inside the retention window, interpolation lag, or a prediction mismatch.

## Reproduce receive bugs with two processes

Some bugs only appear on a client in a separate process, never on a host's own client. If a bug shows up between two processes but not on a host, test with a separate server and client.

## Some faults are timing, not data

Each callback runs on a fixed step of the tick loop and only sees state applied before that step. You are looking at a step-ordering problem if:

- A value read in one callback is stale compared to the same value read in another on the same tick.
- A change does not take until the next tick, or takes twice.
- Symptoms vary with frame rate, or with several fixed updates landing inside one variable update.

Fix these by moving the callback to the right step, not by touching serialization. See [The network loop steps](../core/network-loop-steps.md).

## Narrow it to a reproduction

1. Cut to one object and one member.
2. Set the member's `TransmissionMode` to `Interval`. If the bug disappears, it is in `Divine` transmission; if not, `Divine` was never the cause.
3. Add packet loss (a `NetworkConditions` with a `PacketLossChance`, passed to `TransportManager.SetNetworkConditions`) to see whether the symptom depends on loss.
4. Only then read a packet, now that you know which member, which ticks, and whether it never arrived or arrived wrong.
