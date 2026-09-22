---
title: "When a Message or Call Reaches Its Handler"
---

## Outbound: LateVariableUpdate

Messages and calls sent by your code do not go on the wire the instant you call the send method. They queue, and the queue flushes on `NetworkLoopSteps.LateVariableUpdate`, the last step of a variable update. Both flush at the same step, so a message and a call sent in the same frame leave together.

## Inbound calls: LateStateUpdate, deliberately after messages

Inbound calls are dispatched on `NetworkLoopSteps.LateStateUpdate`, after the tick's state has applied. That is later than inbound messages, and on purpose: state, including a spawn that arrived this same tick, has already landed by `LateStateUpdate`. A call addressed to an object that spawned in the same frame resolves against a system that already exists, instead of being stepped over because the object wasn't there yet.

## Send order holds across types

A peer's messages reach their handlers in the order they were sent, regardless of how many different message types are mixed in. This isn't per-type ordering — `MessageManager` backs local delivery with one ordered list (`_pendingLocalMessages`) rather than one queue per type, so the drain walks sends in the order they happened, not grouped by type.

## Host loopback: Immediate, and only Immediate

A host is one `CoreManager` holding both the server and client roles. When one half addresses a message or call to the other, `TransportManager.HostLoopbackDelivery` decides when that delivery runs. Only `HostLoopbackDelivery.Immediate` is settable from game code: the receiving half's handlers run at the send site, before the send call returns, on whatever loop step the sender happened to be on.

`HostLoopbackDelivery.Deferred` exists in the enum but is refused with a logged reason when a game tries to set it. It's kept only so the engine's own tests can measure what the alternative would cost — handlers running one step later, at `EarlyVariableUpdate` on the following frame, the same step a real remote peer's copy would land on. Deferred delivery is message-only; a call is always dispatched at the send site because its delivery has to run the server's own admission (resolve the system, check the sender's permission, decide relay) inline.

## Re-entrancy

Because `Immediate` runs a handler at the send site, a handler that sends something back re-enters the same pass that sent the original message or call. The engine supports this. The one consequence worth knowing: if a handler reached this way starts a spawn, and the sending step is already past `LateVariableUpdate`, that spawn is deferred to the next tick — the same deferral any other late spawn gets, not a special case for loopback.

## A handler throw costs only its own payload

Both `MessageManager` and `RpcManager` wrap each individual message or call dispatch in its own `try`/`catch`, not the whole batch. A handler that throws is logged and the payload is dropped; every other message or call in the same drain — from the same sender, in the same frame — still reaches its own handler. A batch-wide guard would have cost a client everything the server sent that frame over one bad payload; the per-payload boundary is why it doesn't.
