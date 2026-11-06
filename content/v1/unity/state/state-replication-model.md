---
title: "How replicated state works"
---

> **Driving the core API directly?** See [How replicated state works](../../core-api/state/state-replication-model.md).

## Systems hold components, and components hold members

- A `NetworkSystem` is the networked entity. It holds up to 31 `NetworkComponent`s (`NetworkSystem.MaximumComponentCount`).
- A `NetworkComponent` holds the values that replicate, as `NetworkMember`s: at most 64, one for each bit of the `memberFlags` that `OnMembersChanged` reports. The generator does not check this limit, so a component that declares more still builds but does not replicate correctly.
- A struct or class used as a member's value can hold at most 62 serialized fields and properties. At 63 (`Constants.MaximumNetworkMemberCount`) the generator reports `SERIALIZERS000`.

## Late joiners need nothing extra

A member holds the value as of the last write. When a new observer starts watching a system, it receives every member's current value, so you never write a separate late-joiner payload.

## OnMembersChanged reports writes and reads

Each tick, `NetworkComponent.OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)` is raised up to twice per component: `Write` for what this peer changed, `Read` for what it received. A host raises both for its own change, so code that only cares about a remote change, including anything calling `NetworkMemberBase.TryGetWritingClient`, must check for `Read`. See [Reacting to a replicated change in Unity](./reacting-to-changes-in-unity.md).

## Only the controller writes by default

`MemberWriteAccess.Controller`, the default, lets the server or the single controlling client set a system's members. Letting other observers write too (`MemberWriteAccess.AnyClient`) is a Pro option; see [Letting clients set members](../../core-api/state/state-write-access.md). A Free build has no `MemberWriteAccess` type, and only the controller writes.

## Four settings decide what a change costs

- **Accuracy**: how precisely a change is compared and sent.
- **Compression level**: how tightly the value is compressed.
- **Transmission mode**: how changes are sent across ticks, such as `Interval` or `Divine`.
- **Send interval**: how often a changed member may send. See [How often a member is sent](../../core-api/state/send-pacing.md).

## Use Nucleus terms

- **System**, not object: `NetworkSystem`.
- **Component**, not behaviour: `NetworkComponent`.
- **Member**, not variable: `NetworkMemberBase`.
- **Controller**, not owner: the client permitted to set a system's members by default.
