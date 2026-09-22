---
title: "Diagnosing desync"
---

## Work the layers in order

"It looks wrong on the other peer" is four different bugs wearing one symptom. Check them in this order, because each rung rules out the ones below it:

1. **Is the object there at all?** If the receiver never spawned it, or the object vanished when it shouldn't have, this is interest: an `IInterestCondition` culled the pair (`InterestEffect.Spawn`, resolving to `InterestMembership.Unspawned`), or a despawn genuinely happened.
2. **Is it there but frozen?** The object exists on the receiver but stopped updating a while ago. This is `InterestEffect.Stop`: the pair resolved to `InterestMembership.Stopped`, which retains the receiver's object and drops it from the delta stream rather than despawning it. It looks identical to a dead connection from the outside; it isn't.
3. **Is it there and moving, but wrong?** Position, rotation, or some other member holds a value that doesn't match the sender. This is a state question: either the value never changed on the receiver, or it changed to something incorrect.
4. **Is it there, correct, but late?** The value is right eventually, just visibly behind. This is interpolation and the retention window, not a data bug.

Don't skip ahead. A value that "looks wrong" because the object was actually culled five seconds ago and you're staring at a stale render is not a serializer bug, and chasing it as one wastes time.

## Never arrived vs. arrived and wrong

Once you're at rung 3, split it again before touching a serializer:

- **A value that never changes on the receiver** is an observation or access question. Is the Connection actually registered as an observer of that `NetworkSystem`? Did an interest condition stop it (rung 2, revisit it)? Does the sender even own or control the member it's trying to change? A member that never updates usually means the write never left the sender, or never reached this receiver, not that the receiver decoded it wrong.
- **A value that changes, but to the wrong thing**, is a serializer or prediction question. The receiver is getting deltas and applying them, so the pipeline is working; the value it lands on is what's wrong. That points at how the member is being written or projected (`TransmissionMode.Divine` vs `TransmissionMode.Interval`), or, for a controlled member, at prediction/reconciliation on the controlling side.

These two failure modes live in different subsystems. Don't debug a serializer because a value never showed up, and don't debug interest because a value arrived and was simply incorrect.

## Read the violation stream first

Most desyncs that are actually protocol faults - not just late or stale data - raise a violation before you'd notice anything visually. `ViolationManager` is the framework-wide pipeline for this: register a `ViolationHandler<T0>` to decide the `ViolationAction` for one violation type, or an `IViolationObserver` to hear every type raised, or subscribe the matching per-type event (for example `UncontrolledStateChangeViolationDetected`) to just watch.

The types worth knowing when chasing desync:

- `UncontrolledStateChangeViolation` - a peer sent a state change for a `NetworkSystem` it doesn't control.
- `PredictedStateChangeViolation` - a controller sent state for a predicted member, which should only ride upstream as input.
- `EmptyCollectionDeltaViolation` - a collection delta declared no operations, which a compliant sender can't produce; usually a crafted packet or a diverged serializer pair.
- `InvalidStateAckViolation` - a peer acknowledged a tick above anything ever sent to it.
- `RetentionExceededViolation` - a peer's acknowledged tick fell beyond the retention window and had to be re-served the whole world. A single raise is ordinary heavy loss; chronic raises mean the peer's latency exceeds `SystemManager.StateRetentionMilliseconds`, or it's deliberately withholding acknowledgments.
- `RecoveryUnconfirmedViolation` - consecutive recoveries were served to a Connection without it ever confirming one.
- `UnauthorizedSpawnViolation` - a client's full serialize named a system identifier the authority doesn't hold, which would have spawned an object on the authority.

If a symptom in rungs 1-3 has a matching raise, that's your subsystem, directly. **If nothing is raised at all**, the fault sits in something the violation pipeline doesn't police: a legitimate interest decision, ordinary loss inside the retention window, an interpolation lag, or a prediction mismatch that's still a well-formed packet. Absence of a violation is evidence, not a dead end.

## The host special case

A host still serializes its own client's packets normally on the send side - nothing is skipped there. What changes is receipt: the arriving loopback copy is discarded unread rather than deserialized, because whatever it carries either duplicates what the sending half already applied in-process, or is a stale re-apply of the same object the host itself authored.

This means a bug on the receive-and-apply path - deserialization, violation checks that only run on an incoming packet, interest resolution for an arriving state, anything downstream of "a packet was read" - never runs for a host's own client at all. If a repro only shows up between two separate processes (two real clients, or a client against a dedicated server) and never on a host testing against its own client, look at the receive path first. Host loopback simply never exercises it.

## Timing faults

Some symptoms point at the tick loop, not at data. The loop runs its steps in a fixed order - network reads happen early, state is read and applied at the start of a step, serialized and sent at the end of one - and a callback only sees what's already been applied by the point it runs on. Signs you're looking at a step-ordering problem rather than a data problem:

- A value read in one callback is stale compared to the same value read in a different one on the same tick - check which steps each callback runs on, not the value itself.
- A change looks like it "doesn't take" until the following tick, or takes twice - it's being written on the wrong side of a state-apply boundary, or read before the write it depends on has happened.
- Symptoms vary with frame rate or with multiple fixed updates landing inside one variable update - that's the loop's own cadence, not the network.

Fixing these means moving the callback to the correct step relative to when state applies and when it's written, not touching serialization at all.

## Narrowing to a reproduction

Once you know which rung and which of the two failure modes, shrink the repro before reading a single packet:

1. Cut to one object and one member. A whole scene desyncing is the same bug as one member desyncing, just noisier to look at.
2. Turn projection off - set the member's `TransmissionMode` to `Interval`. If the bug disappears, it's in the projection path; if it doesn't, projection was never the cause.
3. Raise loss deliberately (`SimulatedPacketLossChance` on the transport) to see whether the symptom is loss-shaped - arrives late, arrives out of order, never arrives - versus present on every send.
4. Only then read a packet. By this point you know which member, which tick range, and which of "never arrived" or "arrived wrong" you're chasing, so there's an actual question to answer instead of a blind capture.
