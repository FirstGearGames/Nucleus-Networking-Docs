---
title: "Reacting to changes: OnMembersChanged"
---

> **Using Unity?** See [Reacting to a replicated change in Unity](../../unity/state/reacting-to-changes-in-unity.md).

`NetworkComponent` exposes one callback for every member change, rather than a separate event per member:

```csharp
public virtual void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection) { }
```

Override it to react to state without polling.

## The two arguments

`memberFlags` is one bit per member, in member-Id order. Cast it to the component's generated flags enum to test individual members:

```csharp
public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    TransformComponentFlags flags = (TransformComponentFlags)memberFlags;
}
```

`memberChangeDirection` is a `MemberChangeDirection`, and names which side of the wire the raise is reporting:

- `Write` - this peer changed the members itself; the callback fires before the tick's writing runs.
- `Read` - the members were applied from the wire; the callback fires after every packet of the inbound pass has landed.

A host raises both directions in the same frame, write first, without waiting for its own packet to come back.

## Write: before serialization, not after transmission

`Write` reports that the members were committed to this tick's outbound pass, not that bytes left the process. A system whose only observer is culled by interest, or withheld because the change came from that observer, still raises `Write`. Do not use it to infer that anything was actually sent.

## Read: after the inbound pass, before Reconcile

`Read` fires once per tick, after every packet of the inbound pass has landed and before the Reconcile step. It is the only direction under which `NetworkMemberBase.TryGetWritingClient` can resolve a writer - that claim is scoped to the tick an inbound apply landed in. A handler that assumes a raise means a remote change arrived must check for `Read`; code calling `TryGetWritingClient` only makes sense there.

## Reading the flags correctly

Three cases catch people:

- **Full apply.** A spawn, resync, reconcile, or whole-component recovery reports `ulong.MaxValue`. Treat every member as changed rather than trying to diff the flags.
- **Member-granular recovery.** A recovery serve reports only the members it actually repaired, not the full mask. Whether a component supports this is fixed per type (`IsMemberRecoverySupported`); a component that doesn't falls back to the full-apply case above.
- **Delta flags name what the wire carried, not what differs.** A member's bit being set means the wire carried that member on this pass, not that its value changed from before. A predicted member whose prediction was confirmed still sets its bit.

## Inheritance aliases member flags across layers

For a component whose inheritance chain declares members on more than one layer, each layer's flags word starts at bit zero, so the union `memberFlags` reports aliases bit positions across layers - bit 0 of one layer and bit 0 of another land on the same bit. Single-layer components, the norm, map exactly onto the generated flags enum. This is also why an inheriting component's `IsMemberRecoverySupported` is `false`: with aliased bits a recovery mask can't name a single member unambiguously, so it falls back to whole-component recovery.

## Why one callback, not a per-member event

A per-member `Changed` event was a declined design. One component-wide callback raises once per component per direction instead of once per changed member, and needs no per-member subscription bookkeeping - nothing to wire up or tear down as members are added. The cost is that a handler interested in one member checks its bit in `memberFlags` rather than subscribing directly to it.
