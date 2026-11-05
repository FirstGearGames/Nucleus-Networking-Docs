---
title: "Reacting to changes: OnMembersChanged"
---

> **Using Unity?** See [Reacting to a replicated change in Unity](../../unity/state/reacting-to-changes-in-unity.md).

`NetworkComponent` has one callback for every member change, rather than an event per member. Override it to react without polling:

```csharp
public virtual void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection) { }
```

## Test which members changed

`memberFlags` has one bit per member, in member-Id order. Cast it to the component's generated flags enum to test a member:

```csharp
public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    TransformComponentFlags flags = (TransformComponentFlags)memberFlags;
}
```

## Check the direction

`memberChangeDirection` says where the change came from:

- `MemberChangeDirection.Write`: this peer changed the members. It runs before anything is sent this tick, and means the change was committed to this tick's send, not that anything left the process. It still runs when the only observer is culled by interest, or is withheld because the change came from that observer.
- `MemberChangeDirection.Read`: the members came from another peer. It runs once per tick, after everything received this tick has been applied and before the Reconcile step.

A host raises both in the same frame, `Write` first, without waiting for its own packet to come back. Code that should run only for a remote change must check for `Read`. `NetworkMemberBase.TryGetWritingClient` can only find a writer under `Read`.

## Three flag cases catch people

- **Full apply**: a spawn, resync, reconcile or whole-component recovery reports `ulong.MaxValue`. Treat every member as changed.
- **Partial recovery**: a recovery can report only the members it repaired, not the full mask.
- **A set bit does not mean the value differs**: a member's bit can be set while its value matches what it held before. A predicted member whose prediction was confirmed still sets its bit.

## Inherited members share bit positions

If a component's inheritance chain declares members on more than one layer, each layer's flags start at bit 0, so bits from different layers overlap in `memberFlags`. A single-layer component, the usual case, maps exactly onto its generated flags enum.
