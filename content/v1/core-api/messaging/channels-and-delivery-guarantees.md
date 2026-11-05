---
title: "Channels and What Is Guaranteed"
---

## Choose a channel on every send

`Channel` has two values: `Reliable` (ordered and reliable) and `Unreliable`. Every message and call names one at the send:

```csharp
connection.SendMessage(Channel.Reliable, myMessage);
mySystem.TrySendRpc(RpcTarget.Observers, Channel.Unreliable, myRpc);
```

The transport provides the guarantee. Nucleus adds no retries of its own, and messages and calls are never resent, so each one arrives once or not at all. If it must arrive, send it on `Channel.Reliable`.

## A large unreliable send stays unreliable

A message or call larger than the transport's maximum transmission unit keeps its channel:

- A reliable one is split by the transport, which delivers every piece.
- An unreliable one is split into datagram-sized pieces and rebuilt on the receiver once every piece arrives. Losing any piece loses the whole payload, so the more pieces it needs, the more often it is lost. The receiver drops it after waiting five seconds for a missing piece.
- An unreliable payload needing more than 255 pieces (close to 300 KB at the default transmission unit) is dropped with an error. Send data that large reliably.

## Late joiners never see past sends

A message or call that fired before a peer started observing is gone. If a late joiner needs the value, put it in a replicated member instead. See [State, a Message, or a Call?](./state-message-or-call.md).
