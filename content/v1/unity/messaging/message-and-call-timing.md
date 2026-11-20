---
title: "When a Message or Call Reaches Its Handler"
---

## Outbound messages and calls leave once per frame

Sends are queued and go out once per frame, at the `NetworkLoopSteps.LateSerialize` step, after its callbacks. A message or call sent from a `LateSerialize` callback or any earlier step leaves this frame. One sent from a `TickAdvance` or `LateVariableUpdate` callback leaves next frame. Messages and calls sent in the same frame leave together.

## Inbound calls run on LateStateUpdate, after messages

Inbound calls are dispatched on `NetworkLoopSteps.LateStateUpdate`, after inbound messages and after the tick's state has applied. A call addressed to an object that spawned in the same tick finds its system already there.

## Run a call on the tick it was sent on

By default a call runs on the first tick after it arrives. Received state waits for the interpolation before it applies, so a call sent beside the server's state of one tick runs while the receiver is still showing an earlier one. Pass `RpcDispatch.TickAligned` to make the call wait for its tick instead:

```csharp
NetworkSystem.TrySendRpc(RpcTarget.Observers, Channel.Unreliable, new ExplosionRpc { Position = position }, rpcDispatch: RpcDispatch.TickAligned);
```

A call that arrives after its tick has passed still runs, and a reliable call keeps its order. [When a Message or Call Reaches Its Handler](../../core-api/messaging/message-and-call-timing.md#run-a-call-on-the-tick-it-was-sent-on) says exactly when each side runs one.

Use it when a call must line up with replicated state, such as an effect at an object's position. A call that should run as soon as possible, such as a chat line, keeps the default, `RpcDispatch.OnArrival`.

## Send order holds across types

A peer's messages reach their handlers in the order they were sent, whatever mix of message types they are.

## Host loopback delivery is always Immediate

When one half of a host sends a message or call to its other half, `TransportManager.HostLoopbackDelivery` is `HostLoopbackDelivery.Immediate`: the receiving half's handlers run at the send site, before the send returns, on whatever loop step the sender was on. Setting `HostLoopbackDelivery.Deferred` from game code is refused with a logged reason.

A handler reached this way may send something back. If it starts a spawn while the sending step is `LateSerialize` or `TickAdvance`, after the tick's state was sent, the spawn waits until the tick advances, like any other late spawn.

## A handler throw costs only its own payload

If a message or call handler throws, the exception is logged and that payload is dropped. Every other message or call in the same frame, from the same sender, still reaches its handler.
