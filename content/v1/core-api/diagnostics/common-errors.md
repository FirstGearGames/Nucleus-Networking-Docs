---
title: "Common errors and what causes them"
---

Every line below is quoted exactly as the engine writes it.

## Find your log line

- ["ran on thread [X] while a network loop step is executing on thread [Y]..."](#a-message-was-written-off-the-loop-thread): off-loop writer work
- ["touched the loop-owned collection [...] on thread [X] while a network loop step is executing on thread [Y]..."](#loop-owned-state-was-touched-off-the-loop-thread): off-loop collection access
- ["Step [X] was turned away on thread [...] because this manager is already executing a step on thread [...]..."](#two-threads-are-driving-one-manager): a second driver stepping the loop
- ["Violation [X] from Connection [...]"](#a-violation-was-raised-against-a-peer): a violation raised against a peer
- ["A Recovery entry from Connection [...] references unknown NetworkSystem Id [...]; that entry is skipped."](#recovery-named-something-the-receiver-cannot-use): recovery named a system the local world no longer has
- ["...acknowledges [an impossible tick]..." (InvalidStateAckViolation)](#recovery-named-something-the-receiver-cannot-use): an acknowledgment above the local tick
- ["...retention window was exceeded..." (RetentionExceededViolation)](#recovery-named-something-the-receiver-cannot-use): an acknowledged tick fell out of the retention window
- ["A StatePacket subpacket from Connection [...] declares [X] body bits but only [Y] remain; discarding the rest of the tick."](#a-state-update-could-not-be-read): a state update that could not be read
- ["State subpacket [X] from Connection [...] left the reader at [...] bits but its framed boundary was [...]..."](#a-state-update-could-not-be-read): a state update that could not be read
- ["Connection [...] sent unrecognised PacketType [X]; the packet is discarded."](#a-peer-runs-a-different-build): version skew, not a kick

## A message was written off the loop thread

`"[Caller<MessageType>] ran on thread [X] while a network loop step is executing on thread [Y]. This work must not run concurrently with the loop; it races the outbound WriterPool and can corrupt sent packets."`

**Cause.** Something wrote a message from a thread other than the one running a network loop step.

**Fix.** Move the work onto the loop. If it resumes after an `await`, route it through the loop rather than sending from wherever the continuation landed.

This check exists only in a `DEBUG` build. A Release build still has the race but logs nothing, so reproduce in Debug and confirm the fix in Release.

## Loop-owned state was touched off the loop thread

`"[Caller] touched the loop-owned collection [Name] on thread [X] while a network loop step is executing on thread [Y]. This work must run on the network loop thread; touching the collection off the loop races the loop and can silently corrupt it."`

**Cause.** An async continuation resumed off the loop thread and touched state the loop owns. This can corrupt it or drop an entry.

**Fix.** Switch back onto the loop before touching loop-owned state.

This check also exists only in a `DEBUG` build. In Release the race remains, unreported.

## Two threads are driving one manager

`"Step [X] was turned away on thread [...] because this manager is already executing a step on thread [...]. One loop must drive one manager, and a second driver races every collection the loop owns. A manager whose owner never supplied a step provider, leaving the default one driving the loop from the thread pool, is the usual cause. At least [N] steps have been turned away since the previous report."`

**Cause.** Two threads are stepping the same manager's loop. Usually the owner never supplied its own `INetworkLoopStepProvider`, so the default background-timer provider drives the loop from the thread pool alongside whatever else steps it.

**Fix.** Make sure exactly one driver steps the manager: supply the owner's own step provider (a Unity integration's loop provider, or a harness driving ticks by hand).

The line is logged at most once per minute per manager. The count (`At least [N] steps have been turned away`) shows the real severity: a count of 1 differs greatly from one in the thousands.

## A violation was raised against a peer

`"Violation [TypeName] from Connection [...]"`, sometimes followed by `"...settled on a kick, but this peer is not a server; the kick is not enforced."` or `"Disconnecting Connection [...] for violation [TypeName]."`

The first line is written when the violation carries a log entry. The second and third follow a `Kick`. Most types default to `Ignore` and write nothing, so register an `IViolationObserver` to see them. Look up `TypeName` in the [Violation reference](./violation-reference.md) for its payload, its cause and what to check first.

The offending operation is always rejected. The action only decides what happens to the Connection. See [Violations](./violations.md).

## Recovery named something the receiver cannot use

`"A Recovery entry from Connection [...] references unknown NetworkSystem Id [X]; that entry is skipped."`

The sender believed the receiver still held a system the local world no longer has. The entry is skipped and the rest of the recovery continues.

`InvalidStateAckViolation`, `RetentionExceededViolation` and `RecoveryUnconfirmedViolation` default to `Ignore`. A single raise is ordinary for a peer on a bad link. Raises that keep recurring for the same Connection mean its latency exceeds the retention window, or something is wrong with how it acknowledges.

## A state update could not be read

`"A StatePacket subpacket from Connection [...] declares [X] body bits but only [Y] remain; discarding the rest of the tick."`

`"State subpacket [Type] from Connection [...] left the reader at [...] bits but its framed boundary was [...] (declared [X] body bits, off by [Y]). The stream is misaligned; discarding the rest of the tick."`

The receiver could not read a state update the way the sender wrote it. This points at the two builds disagreeing about a type's serialized shape, not at game logic. The rest of the tick is discarded so nothing unreadable is applied.

## A peer runs a different build

`"Connection [...] sent unrecognised PacketType [X]; the packet is discarded."`

An older or newer build sent a packet type this build does not know. The packet is discarded without a violation, since a version mismatch is not proof of a hostile peer.
