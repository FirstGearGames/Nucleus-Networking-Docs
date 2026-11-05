---
title: "When a Message or Call Reaches Its Handler"
---

## Outbound messages and calls leave once per frame

Sends queue, and the queue goes out once per frame at the `NetworkLoopSteps.LateSerialize` step, after its callbacks.

- Sent from a `LateSerialize` callback or any earlier step: leaves this frame.
- Sent from a `TickAdvance` or `LateVariableUpdate` callback: leaves next frame.

Messages and calls sent in the same frame leave together.

## Inbound calls run after the tick's state applies

Inbound calls are dispatched on `NetworkLoopSteps.LateStateUpdate`, later than inbound messages. A call addressed to an object that spawned in the same frame finds the system already there.

## Send order holds across message types

A peer's messages reach their handlers in the order they were sent, whatever mix of types they are.

## A host delivers to itself immediately

When a host's server half and client half send to each other, the receiving half's handlers run at the send site, before the send call returns. This is `TransportManager.HostLoopbackDelivery` set to `HostLoopbackDelivery.Immediate`, the only value game code may set. Setting `HostLoopbackDelivery.Deferred` is refused with a logged reason. Calls always run at the send site on a host.

A handler that sends something back runs inside the original send, which is supported. One effect: if such a handler starts a spawn while the sending step is `LateSerialize` or `TickAdvance`, the spawn is deferred until the tick advances, like any other late spawn.

## A handler that throws loses only its own payload

The exception is logged and that one message or call is dropped. A payload that fails to decode is dropped the same way. Every other message and call in the same frame still reaches its handler.
