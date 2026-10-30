---
title: "Channels and What Is Guaranteed"
---

## Channel.Reliable and Channel.Unreliable

`Channel` is a two-value enum: `Reliable` (ordered and reliable) and `Unreliable`. Every message and every call is sent on one or the other, chosen at the send call:

```csharp
connection.SendMessage(Channel.Reliable, myMessage);
mySystem.TrySendRpc(RpcTarget.Observers, Channel.Unreliable, myRpc);
```

The channel is passed straight through to the transport, and the transport alone makes `Reliable` reliable: Nucleus adds no retries or delivery checks of its own. Pick `Reliable` and the transport guarantees order and delivery. Pick `Unreliable` and it guarantees neither.

## Calls and messages are not state

A call or a message is not state. It carries no acknowledgment and no redundancy, and it is never resent to reach eventual consistency. It either arrives once, or it does not arrive at all - there is no third outcome where the engine notices a loss and tries again.

That means the channel is the only reliability lever either mechanism has. If a call or a message must arrive, it has to ride `Channel.Reliable`; there is no other way to make that true. Conversely, sending something on `Channel.Unreliable` is an explicit statement that losing it occasionally is fine.

This holds identically for messages and calls. A message has no address beyond the connection it travels to; a call additionally names a `NetworkSystem` so the receiver resolves the object before a handler runs. Neither carries any redelivery machinery, so for both, choosing the channel is most of the decision about whether the send is safe to lose.

## Batching

Messages and calls are batched per `Connection` and sent once per frame.

One bad payload does not take down the rest of the batch. Each message and call is read on its own, so a body that fails to read is dropped and every payload sent after it in the same batch still dispatches normally.

## A large unreliable send stays unreliable

A message or call larger than the transport's maximum transmission unit keeps the channel you asked for. A reliable one is handed to the transport, which splits it and delivers every piece. An unreliable one is split by the engine into pieces that each fit one datagram, on every transport, and the receiving peer rebuilds it once all of its pieces have arrived.

A split unreliable payload arrives whole or not at all. Losing any one piece loses the payload, so the more pieces it needs, the more often it is lost, and the receiver drops it once it has waited five seconds for a missing piece. An unreliable payload too large to split at all, more than 255 pieces or close to 300 KB at the default transmission unit, is dropped with an error, so send data that large reliably.

## When neither one is the right tool

Messages and calls both fire once and are gone - nothing records that they happened for a peer that starts observing afterward. If a value needs to be correct for a late joiner, it belongs in a replicated member instead, which shows a new observer the value as of the last write rather than replaying past sends. See [State, a Message, or a Call?](./state-message-or-call.md) and [How replicated state works](../state/state-replication-model.md).
