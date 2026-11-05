---
title: "State, a Message, or a Call?"
---

## Pick by what a late joiner needs

- A **replicated member** holds a current value. The server writes it, and a peer that starts observing later sees the value as of the last write.
- A **message** goes to one peer and is forgotten.
- A **call** is addressed to a `NetworkSystem`. The receiver finds that system before any handler runs, and skips a call for a system it does not hold.

Nothing keeps a backlog of messages or calls. One that fired before a peer started observing is gone for that peer. So ask: does a peer that arrives later need to know this? If yes, it belongs in a replicated member. See [How replicated state works](../state/state-replication-model.md).

## Match common cases to a mechanism

- **A score.** Every peer, including one that joins mid-match, needs the current value. Replicated member.
- **A door's open state.** A peer that walks up five minutes after the door opened must see it open. Replicated member.
- **A chat line.** Nobody who arrives later needs it, and it is not about an object in the world. Message.
- **A hit effect.** It plays once on the object it happened to, and a later joiner does not need to see it. Call.
- **A server answer to one player's request.** Call, sent with `RpcTarget.To` rather than to every observer.
