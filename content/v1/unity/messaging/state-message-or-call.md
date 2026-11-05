---
title: "State, a Message, or a Call?"
---

## Each one carries something different

- A **replicated member** carries a current value. The server writes it, every observer's copy converges on it, and a late observer is brought up to date as soon as it starts observing.
- A **message** is sent to a peer's connection and forgotten. There is no acknowledgment and no record of it once the handler returns.
- A **call** is addressed to a `NetworkSystem`. The receiver resolves that system before any handler runs, and steps over a call for a system it does not have.

## A late joiner sees state, never past messages or calls

A replicated member shows a new observer the value as of the last write. A message or call sent before a peer started observing is gone: neither `RpcManager` nor `MessageManager` keeps a backlog. If a peer needs to know something happened before it joined, keep that fact in a replicated member.

This usually decides it: does a peer that arrives later need to know this, or only the peers that saw it happen?

## Choose by example

- **A score.** Every peer, including one that joins mid-match, needs the current value. Replicated member.
- **A door's open state.** A peer that walks up five minutes after the door opened needs to see it open. Replicated member.
- **A chat line.** Nobody who missed it needs it later, and it is not addressed to an object. Message.
- **A hit effect.** It plays once on the object it happened to, and a late joiner does not need it. Being addressed to a `NetworkSystem` makes it a call rather than a message.
- **A server answer to one player's request.** Addressed to that player's system, resolved once. A call sent with a routed `RpcRoute` rather than to every observer.
