---
title: "Diagnosing desync"
---

## Work the layers in order

"It looks wrong on the other peer" can be four different bugs. Check them in this order, because each one rules out the ones below it:

1. **Is the object there at all?** If the receiver never spawned it, or it vanished, this is interest: an `IInterestCondition` culled the pair (`InterestEffect.Spawn`, resolving to `InterestMembership.Unspawned`), or the object really was despawned.
2. **Is it there but frozen?** This is `InterestEffect.Stop`: the pair resolved to `InterestMembership.Stopped`, so the receiver keeps the object but is sent no more updates. It looks like a dead connection, but it is not.
3. **Is it there and moving, but wrong?** A member holds a value that does not match the sender. See the next section.
4. **Is it correct, but late?** This is interpolation and the retention window, not a data bug.

Do not skip ahead. A value that looks wrong because the object was culled five seconds ago is not a serializer bug.

## Tell a missing value from a wrong one

Split layer 3 again before you touch a serializer:

- **A value that never changes on the receiver** is an observation or access problem. Is the Connection an observer of that `NetworkSystem`? Did an interest condition stop it? Does the sender own or control the member it is changing? Usually the write never left the sender, or never reached this receiver.
- **A value that changes, but to the wrong thing**, is a serializer or prediction problem. Look at how the member is written (`TransmissionMode.Divine` or `TransmissionMode.Interval`) or, for a controlled member, at prediction and reconciliation on the controlling side.

## Read the violation stream first

Most protocol faults raise a violation before you would notice anything on screen. Register an `IViolationObserver` to hear every type, or subscribe a per-type event such as `UnauthorizedMemberChangeViolationDetected` (see [Handling violations in Unity](./handling-violations-in-unity.md)).

The types that matter for desync are `UnauthorizedMemberChangeViolation`, `PredictedMemberChangeViolation`, `EmptyCollectionDeltaViolation`, `InvalidStateAckViolation`, `RetentionExceededViolation`, `RecoveryUnconfirmedViolation` and `UnauthorizedSpawnViolation`. The [Violation reference](./violation-reference.md) says what each means and what to check first.

A matching raise names the subsystem directly. If nothing is raised, the cause is something violations do not police: an interest decision, ordinary loss inside the retention window, interpolation lag, or a prediction mismatch carried in a well-formed packet.

## Reproduce with two processes, not only a host

Some bugs only show on a client in a separate process, never on a host's own client. Test with two separate processes (two clients, or a client against a dedicated server) as well as with a host.

## Some faults are timing, not data

Some symptoms come from which network loop step a callback runs on, not from the data. A callback only sees what was applied before its step ran. Signs of a step-ordering problem:

- A value read in one callback is stale compared to the same value read in another callback on the same tick.
- A change does not take effect until the following tick, or takes effect twice.
- The symptom varies with frame rate, or with several fixed updates landing in one variable update.

Fix these by moving the callback to the right step, not by changing serialization.

## Narrow it to a reproduction

Once you know the layer and which of the two failure modes it is, shrink the repro before reading a single packet:

1. Cut to one object and one member.
2. Set the member's `TransmissionMode` to `Interval`. If the bug disappears, it is in the `Divine` path.
3. Add packet loss deliberately (a `NetworkConditions` with a `PacketLossChance`, passed to `TransportManager.SetNetworkConditions`) to see whether the symptom depends on loss.
4. Only then read a packet, knowing which member, which tick range, and whether the value never arrived or arrived wrong.
