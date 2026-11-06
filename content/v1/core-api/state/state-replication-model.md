---
title: "How replicated state works"
---

## Members live in components, components live in systems

- A `NetworkSystem` holds up to 31 `NetworkComponent`s. It tracks identity, lifecycle and observers.
- A `NetworkComponent` holds up to 64 members, one for each bit of the `ulong memberFlags` that `OnMembersChanged` reports. Nothing checks this limit: a component with more still builds but does not replicate correctly.

Put replicated values on components, not on your `NetworkSystem` subclass.

A separate limit applies to the structs and classes a member's value is made of: at 63 serialized fields and properties (`Constants.MaximumNetworkMemberCount`) the build reports `SERIALIZERS000`, so 62 is the most one can hold.

## Late joiners need no extra code

A new observer receives every member's current value, then only changes. There is no separate late-joiner payload to write.

## OnMembersChanged reports each tick's changes

`NetworkComponent.OnMembersChanged` runs up to twice per component per tick: once for what this peer changed (`MemberChangeDirection.Write`) and once for what it received (`MemberChangeDirection.Read`). See [Reacting to changes: OnMembersChanged](./change-callbacks.md).

## Only the controller writes by default

Under `MemberWriteAccess.Controller` (the default, value `0`), the server or the single controlling client sets a system's members. `MemberWriteAccess.AnyClient` lets other observers write too; it is Pro, and a Free build has no `MemberWriteAccess` type. See [Letting clients set members](./state-write-access.md).

## Four settings decide what a change costs

- **Accuracy**: how finely a value's change is compared and sent.
- **Compression level**: how much the value is compressed before it is sent.
- **Transmission mode**: whether changes are interval-paced or projected.
- **Send interval**: how often a changed member may send.

See [NetworkMember](./network-member.md) and [How often a member is sent](./send-pacing.md).

## Use Nucleus terms

Do not substitute names from another engine's netcode:

- **System**, not object: `NetworkSystem` is the networked entity.
- **Component**, not behaviour: `NetworkComponent` holds members within a system.
- **Member**, not variable: `NetworkMemberBase` is one replicated value.
- **Controller**, not owner: the client allowed to set a system's members by default.
