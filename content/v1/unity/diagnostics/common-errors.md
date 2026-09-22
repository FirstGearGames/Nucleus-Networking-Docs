---
title: "Common errors and what causes them"
---

Paste the text of a log line into this page's index to find what produced it and what to change. Every line below is quoted verbatim from the engine.

## Index

- ["ran on thread [X] while a network loop step is executing on thread [Y]..."](#off-loop-writer-work) — off-loop writer work
- ["touched the loop-owned collection [...] on thread [X] while a network loop step is executing on thread [Y]..."](#off-loop-collection-access) — off-loop collection access
- ["Step [X] was turned away on thread [...] because this manager is already executing a step on thread [...]..."](#second-driver) — a second driver stepping the loop
- ["Violation [X] from Connection [...]"](#violation-lines) — a violation raised against a peer
- ["A Recovery entry from Connection [...] references unknown NetworkSystem Id [...]; that entry is skipped."](#recovery-and-retention) — recovery named a system the local world no longer has
- ["...acknowledges [an impossible tick]..." (InvalidStateAckViolation)](#recovery-and-retention) — an ack above the local tick
- ["...retention window was exceeded..." (RetentionExceededViolation)](#recovery-and-retention) — acked tick fell out of the retention window
- ["A StatePacket subpacket from Connection [...] declares [X] body bits but only [Y] remain; discarding the rest of the tick."](#serializer-and-framing-faults) — declared-body-bits mismatch
- ["State subpacket [X] from Connection [...] left the reader at [...] bits but its framed boundary was [...]..."](#serializer-and-framing-faults) — framed-boundary mismatch
- ["Connection [...] sent unrecognised PacketType [X]; the packet is discarded."](#version-skew) — version skew, not a kick

## Off-loop writer work

`"[Caller<MessageType>] ran on thread [X] while a network loop step is executing on thread [Y]. This work must not run concurrently with the loop; it races the outbound WriterPool and can corrupt sent packets."`

**Cause.** Something serialized or accumulated a message from a thread other than the one currently running a network loop step. The outbound `WriterPool` is rented from the loop during serialization, so a concurrent caller can be handed a `Writer` that is already in use.

**Fix.** Move the work onto the loop. If it's resuming after an `await`, route it through the loop rather than sending inline from wherever the continuation happened to land.

This guard is compiled only in `DEBUG`. A Release build has no such check and fails silently: the race still happens, it just never gets a log line naming it. Reproduce and diagnose the fault in Debug, then confirm the fix in Release.

## Off-loop collection access

`"[Caller] touched the loop-owned collection [Name] on thread [X] while a network loop step is executing on thread [Y]. This work must run on the network loop thread; touching the collection off the loop races the loop and can silently corrupt it."`

**Cause.** An async continuation resumed off the loop thread and then touched a collection the loop owns without locking — chiefly the system routing table or the authority's open-scene table. The loop mutates and enumerates these with no lock of its own, so a foreign thread touching them races the loop's reads and writes and can tear the collection or drop an entry.

**Fix.** Switch back onto the loop before touching loop-owned state, rather than acting from wherever the continuation resumed.

Also `DEBUG`-only. Same consequence in Release: the guard disappears, the race doesn't.

## Second driver

`"Step [X] was turned away on thread [...] because this manager is already executing a step on thread [...]. One loop must drive one manager, and a second driver races every collection the loop owns. A manager whose owner never supplied a step provider, leaving the default one driving the loop from the thread pool, is the usual cause. At least [N] steps have been turned away since the previous report."`

**Cause.** Two threads are stepping the same manager's loop. The usual case is an owner that never supplied its own `INetworkLoopStepProvider`, so the default background-timer provider is driving the loop from the thread pool at the same time as whatever else is stepping it.

**Fix.** Make sure exactly one driver steps the manager — supply the owner's own step provider (a Unity integration's loop provider, a test harness driving ticks by hand) rather than letting two sources call in.

This line is throttled to at most once per minute per manager, because the incident it was built for produced hundreds of thousands of identical lines in minutes. Every turned-away step is still counted even when not logged, and the reported count (`At least [N] steps have been turned away`) is what tells you the real severity — a report you see once with a count of 1 is very different from one with a count in the thousands, even though the line text looks the same either way.

## Violation lines

`"Violation [TypeName] from Connection [...]"`, sometimes followed by `"...settled on a kick, but this peer is not a server; the kick is not enforced."` or `"Disconnecting Connection [...] for violation [TypeName]."`

Every violation logs through this same shape, keyed by its type name. Look up `TypeName` in the violation reference for the payload fields it carries and what triggered it:

- `EmptyCollectionDeltaViolation` — a collection member delta declaring no operations; a compliant sender can't produce one.
- `InvalidStateAckViolation` — a Connection acknowledged a state tick above the local tick.
- `PredictedStateChangeViolation` — a controller sent state for a member that should only ride upstream as input.
- `RecoveryUnconfirmedViolation` — a served recovery went unconfirmed for the full patience window and had to be re-served.
- `RetentionExceededViolation` — an acked tick fell beyond the retention window, forcing a full-world recovery.
- `RpcFloodViolation` — more remote calls arrived in one drain than the receiver admits.
- `RpcSendPermissionViolation` — a remote call was sent without permission (often a well-behaved client racing a permission revocation).
- `UnauthorizedSpawnViolation` — a client sent a full serialize for a system Id the authority doesn't hold.
- `UncontrolledStateChangeViolation` — a Connection sent state for a system it doesn't control.
- `UnexpectedBundleRequestViolation` / `UnexpectedSceneRequestViolation` — a client sent a request only the server/authority ever sends.
- `UnsolicitedBundleReportViolation` / `UnsolicitedSceneReportViolation` — a client reported a load or unload it was never asked to make.

Each violation has a default `ViolationAction` (`Log`, `Ignore`, or `Kick`) and a registered handler can override it per Connection. The action only governs the Connection consequence — the offending operation itself is always rejected regardless of what the action does.

## Recovery and retention

`"A Recovery entry from Connection [...] references unknown NetworkSystem Id [X]; that entry is skipped."`

The sender believed the peer still held a system that the local world no longer has. The entry is skipped and the rest of the recovery continues.

`InvalidStateAckViolation`, `RetentionExceededViolation`, and `RecoveryUnconfirmedViolation` (see the violation index above) round out recovery diagnosis. All three default to `Ignore` rather than a kick: a single raise of any of them is ordinary behavior for a peer on a bad link — heavy loss, a retention window that's too short for the peer's latency, or a recovery that got lost along with everything else. What separates a lossy link from an actual bug is repetition: an occasional raise is the cost of an imperfect network, while raises that keep recurring for the same Connection mean its latency genuinely exceeds the retention window, or something is wrong with how it acknowledges.

## Serializer and framing faults

`"A StatePacket subpacket from Connection [...] declares [X] body bits but only [Y] remain; discarding the rest of the tick."`

`"State subpacket [Type] from Connection [...] left the reader at [...] bits but its framed boundary was [...] (declared [X] body bits, off by [Y]). The stream is misaligned; discarding the rest of the tick."`

Both mean a declared bit count didn't match what was actually read or what remained in the buffer. This is a serializer question, not a gameplay one — it points at a reader/writer pair that disagree about a type's shape, not at anything the game did wrong. The rest of the tick is discarded to avoid reading garbage as if it were the next subpacket.

## Version skew

`"Connection [...] sent unrecognised PacketType [X]; the packet is discarded."`

The header was read, but nothing on this side knows how to interpret that `PacketType`. This is what version skew between peers looks like on the wire: an older or newer build sent a packet type the receiver has never heard of. The packet is silently discarded rather than treated as a violation — an unrecognised type on its own isn't proof of a hostile peer, only of a version mismatch, so it's not a kick.
