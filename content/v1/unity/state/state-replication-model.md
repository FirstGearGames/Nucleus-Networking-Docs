---
title: "How replicated state works"
---

See [Start Here / How replication works](../../start-here/how-replication-works.md) for the pipeline overview. This page covers only the member-and-component contract every other page in this section assumes.

## Containment

A `NetworkSystem` holds `NetworkComponent`s, up to 64 per system. A `NetworkComponent` holds `NetworkMember`s, at most 64, one for each bit of the `ulong` `memberFlags` that `OnMembersChanged` reports. The generator does not check that limit on a component, so one that declares more still builds but does not replicate correctly. `Constants.MaximumNetworkMemberCount` (63) is a separate limit, on the structs and classes a member's value is made of: the generator reports `SERIALIZERS000` once such a type has 63 serialized fields and properties, so 62 is the most one can hold.

Data lives in components, not in the `NetworkSystem` subclass itself. `NetworkSystem` tracks identity, lifecycle, and observers; the values that actually replicate are declared on the `NetworkComponent`s attached to it. A component exposes its own `Write`, `WriteDelta`, `Read`, and `ReadDelta`, and it is these that generated code fills in per member.

## Full versus delta

A member simply carries the value as of the last write. There is no separate late-joiner payload to author.

When a new observer starts watching a system, that system serves a full snapshot of every component to that observer; every serialization after that is a delta of what changed. This applies uniformly: a full, a recovery serve, and an interest serve all ride the same absolute encoding, while an ordinary tick's serialize rides a delta. A member's author never writes two versions of anything - the full path and the delta path both read the same current value, just at different granularity.

## One write pass, one read pass, per tick

Each tick raises `NetworkComponent.OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)` up to twice per component: once for what this peer is sending, once for what it received.

- `MemberChangeDirection.Write` fires before any of the tick's writing runs, on the peer that made the change. It reports that the members were committed to the outbound pass, not that bytes left the process - a system with no observers, or one withheld from an observer, still raises this.
- `MemberChangeDirection.Read` fires after every packet of the inbound pass has landed, before reconciliation. A full apply (spawn, resync, reconcile, whole-component recovery) reports every member changed; a member-granular recovery reports only the members it repaired.

A host raises both directions in the same frame, write first, without waiting for its own packet to come back. Code that only cares about a remote change - anything calling `NetworkMemberBase.TryGetWritingClient` - must check for `MemberChangeDirection.Read`; that claim only resolves under a read.

## Who may write

By default, `StateWriteAccess.Controller` (the enum's `0` value): the server, or the single controlling client, may write a system's state. Letting other observers write as well (`StateWriteAccess.AnyClient`) is a Pro opt-in, covered on its own page. A free build has no `StateWriteAccess` type, so there only the controller writes.

## What a change costs

Four independent axes decide the price of a member changing, each covered on its own page:

- **Accuracy** - how finely a value's change is compared and encoded.
- **Compression level** - how tightly the wire encoding packs the value.
- **Transmission mode** - how the value's changes travel across ticks (e.g. absolute versus projected).
- **Send interval** - how often a changed member is actually allowed to send.

## Vocabulary

Nucleus has its own terms; do not substitute names from another engine's netcode.

- **System**, not object: `NetworkSystem` is the networked entity.
- **Component**, not behaviour: `NetworkComponent` is a container of members within a system.
- **Member**, not variable: `NetworkMemberBase` is the individual replicated value.
- **Controller**, not owner: the client permitted to write a system's state by default.
