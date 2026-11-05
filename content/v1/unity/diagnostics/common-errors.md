---
title: "Common errors and what causes them"
---

Search this page for the text of a log line to find what produced it and what to change. Every line below is quoted verbatim from the engine.

## A message was written off the loop thread

`"[Caller<MessageType>] ran on thread [X] while a network loop step is executing on thread [Y]. This work must not run concurrently with the loop; it races the outbound WriterPool and can corrupt sent packets."`

**Cause.** A message was written from a thread other than the one running the network loop.

**Fix.** Move the work onto the loop. If it resumes after an `await`, route it through the loop rather than sending from wherever the continuation landed.

This check exists only in `DEBUG` builds. A Release build still has the race but never logs it, so diagnose in Debug and confirm the fix in Release.

## Loop-owned state was touched off the loop thread

`"[Caller] touched the loop-owned collection [Name] on thread [X] while a network loop step is executing on thread [Y]. This work must run on the network loop thread; touching the collection off the loop races the loop and can silently corrupt it."`

**Cause.** An async continuation resumed off the loop thread and touched state the loop owns.

**Fix.** Switch back onto the loop before touching loop-owned state.

This check is also `DEBUG`-only. In Release the race still happens, silently.

## Two threads are driving one manager

`"Step [X] was turned away on thread [...] because this manager is already executing a step on thread [...]. One loop must drive one manager, and a second driver races every collection the loop owns. A manager whose owner never supplied a step provider, leaving the default one driving the loop from the thread pool, is the usual cause. At least [N] steps have been turned away since the previous report."`

**Cause.** Two threads are stepping the same manager's loop, usually because the owner never supplied its own `INetworkLoopStepProvider`, so the default provider steps the loop from the thread pool alongside whatever else steps it.

**Fix.** Make sure exactly one driver steps the manager by supplying the owner's own step provider (a Unity integration's loop provider, or a test harness driving ticks by hand).

The line is logged at most once per minute per manager. The count in `At least [N] steps have been turned away` includes every step turned away since the last report, so it tells you how severe the problem is.

## A violation was logged

`"Violation [TypeName] from Connection [...]"`, sometimes followed by `"...settled on a kick, but this peer is not a server; the kick is not enforced."` or `"Disconnecting Connection [...] for violation [TypeName]."`

A violation writes one of these lines only when its `ViolationContext<T0>.Log` is set or it kicks. Most types default to `Ignore` and write nothing, so register an `IViolationObserver` to see them. Look up `TypeName` in the [Violation reference](./violation-reference.md) for its payload, its default action and what to check first.

## A recovery named a system this peer no longer has

`"A Recovery entry from Connection [...] references unknown NetworkSystem Id [X]; that entry is skipped."`

The sender believed this peer still held a system it no longer has. The entry is skipped and the rest of the recovery continues.

`InvalidStateAckViolation`, `RetentionExceededViolation` and `RecoveryUnconfirmedViolation` default to `Ignore`, because a peer on a bad link raises them now and then. Raises that keep recurring for the same Connection mean its latency exceeds the retention window, or it is not acknowledging correctly.

## A peer's state could not be read

`"A StatePacket subpacket from Connection [...] declares [X] body bits but only [Y] remain; discarding the rest of the tick."`

`"State subpacket [Type] from Connection [...] left the reader at [...] bits but its framed boundary was [...] (declared [X] body bits, off by [Y]). The stream is misaligned; discarding the rest of the tick."`

The receiver could not read a peer's state the way it was written, so the rest of the tick is discarded. A reader and writer disagree about a type's shape: look at the type's serializer, not at game logic.

## A peer sent an unknown packet type

`"Connection [...] sent unrecognised PacketType [X]; the packet is discarded."`

The peer is running an older or newer build that sends a packet type this build does not know. The packet is discarded and the peer is not kicked.
