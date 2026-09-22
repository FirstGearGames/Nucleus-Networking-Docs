---
title: "Channels and What Is Guaranteed"
---

## Channel.Reliable and Channel.Unreliable

`Channel` is a two-value enum: `Reliable` (ordered and reliable) and `Unreliable`. Every message and every call is sent on one or the other, chosen at the send call:

```csharp
connection.SendMessage(Channel.Reliable, myMessage);
mySystem.SendRpc(RpcTarget.Observers, Channel.Unreliable, myRpc);
```

The channel is not a Nucleus feature built on top of the transport - it is a request passed straight through to it. The transport is what makes `Reliable` actually reliable: nothing in `RpcManager`, `MessageManager`, or `Connection` retries a send, buffers it for redelivery, or checks that it arrived. Pick `Reliable` and the transport guarantees order and delivery. Pick `Unreliable` and it guarantees neither.

## Calls and messages are not state

A call or a message is deliberately not state. It carries no acknowledgment, no redundancy, and no delta baseline, and it is never resent to reach eventual consistency. It either arrives once, or it does not arrive at all - there is no third outcome where the engine notices a loss and tries again.

That means the channel is the only reliability lever either mechanism has. If a call or a message must arrive, it has to ride `Channel.Reliable`; there is no other way to make that true. Conversely, sending something on `Channel.Unreliable` is an explicit statement that losing it occasionally is fine.

This holds identically for messages and calls. A message has no address beyond the connection it travels to; a call additionally names a `NetworkSystem` so the receiver resolves the object before a handler runs. Neither carries any redelivery machinery, so for both, choosing the channel is most of the decision about whether the send is safe to lose.

## Batching and framing

Messages and calls are batched per `Connection` and flushed at the end of the tick, one outbound writer per channel. Each one is length-framed: a message's body is written as `PackedBytes` with a known bit count, and a call's envelope (`RpcPacket`) carries the same for its body.

That framing is what keeps one bad payload from taking down the rest of the batch. Decoding runs per message and per call, not around the whole drain, so a body that fails to decode leaves nothing misaligned behind it - the reader already knows where that body ends from its declared length, and every payload packed after it in the same batch still dispatches normally.

## The MTU caveat

There is one case where the channel you asked for is not the channel you get. If a payload is larger than the transport's maximum transmission unit, it is silently promoted from `Unreliable` to `Reliable` - for both messages and calls. An unreliable transport cannot fragment an oversized payload, and sending it anyway would just mean it gets dropped without anyone knowing, so the engine reliably sends it instead of unreliably dropping it.

This promotion happens with no log line and no return value telling you it occurred. If you send something large on `Channel.Unreliable` expecting the loss tolerance that implies, that expectation quietly stops being true once the payload crosses the MTU. Keep payloads you actually intend to send unreliably well under the MTU if you're relying on that distinction.

## When neither one is the right tool

Messages and calls both fire once and are gone - nothing records that they happened for a peer that starts observing afterward. If a value needs to be correct for a late joiner, it belongs in a replicated member instead, which shows a new observer the value as of the last write rather than replaying past sends. See [State, a Message, or a Call?](../../state-message-or-call.md) and [How replicated state works](../state/state-replication-model.md).
