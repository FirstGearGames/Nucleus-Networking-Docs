---
title: "Channels and What Is Guaranteed"
---

## Pick a channel for every send

Every message and call is sent on `Channel.Reliable` (ordered and reliable) or `Channel.Unreliable`, chosen at the send:

```csharp
connection.SendMessage(Channel.Reliable, myMessage);
mySystem.TrySendRpc(RpcTarget.Observers, Channel.Unreliable, myRpc);
```

The transport alone provides reliability. `Reliable` guarantees order and delivery; `Unreliable` guarantees neither.

## Calls and messages are not state

A call or a message arrives once or not at all. Nothing resends it, so the channel is your only reliability choice: if it must arrive, send it on `Channel.Reliable`. Sending on `Channel.Unreliable` means losing it now and then is fine.

One bad payload does not affect the others.

## A large unreliable send stays unreliable

A message or call larger than the transport's maximum transmission unit keeps the channel you chose. A reliable one is always delivered in full.

A large unreliable payload arrives whole or not at all, and the larger it is, the more often it is lost. Send large data on `Channel.Reliable`.

## Use a replicated member for anything a late joiner needs

Nothing records a message or call for a peer that starts observing afterward. If a value must be correct for a late joiner, put it in a replicated member. See [State, a Message, or a Call?](./state-message-or-call.md) and [How replicated state works](../state/state-replication-model.md).
