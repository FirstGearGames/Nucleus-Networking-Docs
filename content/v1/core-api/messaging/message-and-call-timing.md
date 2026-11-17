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

## Run a call on the tick it was sent on

By default a call runs on the first tick after it arrives. Received state waits for the interpolation before it applies, so a call sent beside the server's state of one tick runs while the receiver is still showing an earlier one. Pass `RpcDispatch.TickAligned` to make the call wait for its tick instead:

```csharp
TrySendRpc(RpcTarget.Observers, Channel.Unreliable, new ExplosionRpc { Position = position }, rpcDispatch: RpcDispatch.TickAligned);
```

- A client runs a tick-aligned call from the server right after the server's state of the tick it was sent on has applied.
- The server runs a tick-aligned call from a client that controls an object right after it simulates that client's tick the call was sent on. From any other client, it runs the call in the tick that applies that client's state of the same tick.
- A call that arrives after its tick has passed runs when it arrives. It is never dropped.
- On `Channel.Reliable`, calls still run in the order they were sent, so a call sent after a waiting tick-aligned call waits behind it, whichever it asked for.
- The server waits for a client's call for at most the interpolation plus one tick, and then runs it.
- When the server passes a client's call on to other clients, the call stays tick-aligned, and each client runs it on the tick the server passed it on.
- On a host, calls between its own server and client halves run at the send site, as every call between them does.

Use it when a call must line up with replicated state, such as an effect at an object's position. A call that should run as soon as possible, such as a chat line, keeps the default, `RpcDispatch.OnArrival`.

## Send order holds across message types

A peer's messages reach their handlers in the order they were sent, whatever mix of types they are.

## A host delivers to itself immediately

When a host's server half and client half send to each other, the receiving half's handlers run at the send site, before the send call returns. This is `TransportManager.HostLoopbackDelivery` set to `HostLoopbackDelivery.Immediate`, the only value game code may set. Setting `HostLoopbackDelivery.Deferred` is refused with a logged reason. Calls always run at the send site on a host.

A handler that sends something back runs inside the original send, which is supported. One effect: if such a handler starts a spawn while the sending step is `LateSerialize` or `TickAdvance`, the spawn is deferred until the tick advances, like any other late spawn.

## A handler that throws loses only its own payload

The exception is logged and that one message or call is dropped. A payload that fails to decode is dropped the same way. Every other message and call in the same frame still reaches its handler.
