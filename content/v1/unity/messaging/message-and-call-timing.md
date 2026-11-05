---
title: "When a Message or Call Reaches Its Handler"
---

## Outbound messages and calls leave once per frame

Sends are queued and go out once per frame, at the `NetworkLoopSteps.LateSerialize` step, after its callbacks. A message or call sent from a `LateSerialize` callback or any earlier step leaves this frame. One sent from a `TickAdvance` or `LateVariableUpdate` callback leaves next frame. Messages and calls sent in the same frame leave together.

## Inbound calls run on LateStateUpdate, after messages

Inbound calls are dispatched on `NetworkLoopSteps.LateStateUpdate`, after inbound messages and after the tick's state has applied. A call addressed to an object that spawned in the same tick finds its system already there.

## Send order holds across types

A peer's messages reach their handlers in the order they were sent, whatever mix of message types they are.

## Host loopback delivery is always Immediate

When one half of a host sends a message or call to its other half, `TransportManager.HostLoopbackDelivery` is `HostLoopbackDelivery.Immediate`: the receiving half's handlers run at the send site, before the send returns, on whatever loop step the sender was on. Setting `HostLoopbackDelivery.Deferred` from game code is refused with a logged reason.

A handler reached this way may send something back. If it starts a spawn while the sending step is `LateSerialize` or `TickAdvance`, after the tick's state was sent, the spawn waits until the tick advances, like any other late spawn.

## A handler throw costs only its own payload

If a message or call handler throws, the exception is logged and that payload is dropped. Every other message or call in the same frame, from the same sender, still reaches its handler.
