---
title: "State, a Message, or a Call?"
---

## The three shapes

A **replicated member** carries a current value. The server writes it, the wire keeps every observer's copy converging on it, and a late observer is brought up to date the moment it starts observing.

A **message** is addressed to a peer and forgotten. It has no address beyond the connection it travels to, no acknowledgment, and no record that it happened once the handler returns.

A **call** is addressed to a `NetworkSystem`. The receiver resolves that system before any handler runs, so a call for a system the receiver does not have is stepped over rather than delivered to the wrong place.

## What each costs to send

A message's envelope carries a hash of the message type (`ushort`), so the receiver knows which handler decodes the body. There is no address and no framing beyond that.

A call's envelope (`RpcPacket`) carries the addressed system's id (`SystemId`), a route (`RpcRoute`, telling the server whether it is a fan-out to observers or bound for one target), and the call's own type hash. The body itself is length-framed (`PackedBytes`) so an unresolvable call can be skipped without decoding it, and the packet after it still reads correctly.

A replicated member sends a delta against a baseline rather than a fresh value every time, so its ongoing cost is the size of what changed, not the size of the whole value.

## The late-joiner rule

A replicated member shows a new observer the value as of the last write. That is what "current value" means: the member's job is to be caught up to, not to be replayed.

A message or a call that fired before a peer started observing is gone. Nothing records it for a peer that arrives later, and neither `RpcManager` nor `MessageManager` keeps a backlog to replay. If a peer needs to know something happened before it joined, that fact has to live in a replicated member, not in the message or call that first announced it.

This is usually what decides between the three: does a newly-arrived peer need to know this, or only peers who were already there to see it happen?

## Wire-type hashes are per mechanism

Messages and calls each keep their own registry of type hashes, resolved once per type and cached. Two message types (or two call types) landing on the same hash are caught the first time the second one is used, whether to send it or to register a handler for it, and an error names both types. From then on both types are refused, rather than silently letting one type's body be decoded as the other's. A collision between a message type and a call type cannot happen this way, because the two registries are separate; it can only happen within one mechanism.

The same protection holds on receive: a message or call whose hash two types collide on is skipped rather than guessed at. A hash with no handler registered is not an error: a message is skipped because nothing is there to decode it, and a call is not decoded, though the server still relays it.

## Picking one

- **A score.** Every peer, including one that joins mid-match, needs to see the current value. Replicated member.
- **A door's open state.** Same reasoning: a peer that walks up to a door five minutes after it opened needs to see it open, not miss the event that opened it. Replicated member.
- **A chat line.** Nobody who wasn't there needs to receive it later, and it isn't addressed to an object in the world, just to peers. Message.
- **A hit effect.** It plays once, on the object it happened to, and a peer who joins after the hit doesn't need to see it play. That address to a specific `NetworkSystem` is what makes it a call rather than a message.
- **A server answer to one player's request.** Addressed to that one player's system, resolved once, done. Call, sent with a routed `RpcRoute` rather than fanned out to every observer.
