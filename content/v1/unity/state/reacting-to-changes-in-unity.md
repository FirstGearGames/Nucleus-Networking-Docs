---
title: "Reacting to a replicated change in Unity"
---

> **Driving the core API directly?** See [Reacting to changes: OnMembersChanged](../../core-api/state/change-callbacks).

## Override OnMembersChanged, forward it to your MonoBehaviour

`NetworkComponent` declares a virtual for this:

```csharp
public virtual void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection) { }
```

It's called once per tick per direction when any of the component's members changed, so a Unity script never has to poll a value to find out it moved.

A `NetworkComponent` is a pooled engine object, not a scene object, so a MonoBehaviour that wants to react cannot inherit from it. Override `OnMembersChanged` on your component partial and raise an event instead, and have the MonoBehaviour that owns the visuals subscribe:

```csharp
public partial class CoinComponent : NetworkComponent
{
    public event MembersChangedHandler MembersChanged;
    public delegate void MembersChangedHandler(ulong memberFlags, MemberChangeDirection memberChangeDirection);

    public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
        => MembersChanged?.Invoke(memberFlags, memberChangeDirection);
}
```

The MonoBehaviour subscribes when it rents the system and unsubscribes when it's destroyed:

```csharp
_coinComponent.MembersChanged += OnCoinMembersChanged;
// ...
_coinComponent.MembersChanged -= OnCoinMembersChanged;
```

An event rather than a direct override on the MonoBehaviour, because the component can be rented and returned independently of the scene object watching it.

## Find which member moved

The source generator emits a `[Flags] enum <ComponentName>Flags : ulong` for every `NetworkComponent`, one bit per member in declaration order. `CoinComponent` declares `Collector` then `PickupSequence`, so its generated enum carries `CoinComponentFlags.Collector` and `CoinComponentFlags.PickupSequence`. Cast the raw `memberFlags` to it and test the bits you care about:

```csharp
private void OnCoinMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    CoinComponentFlags changed = (CoinComponentFlags)memberFlags;

    if ((changed & CoinComponentFlags.Collector) != 0)
    {
        // React to the collector reference changing.
    }
}
```

Delta flags name the members the wire carried, not a guarantee the value differs — a predicted member's confirmed outcome still sets its bit.

## Almost always test for MemberChangeDirection.Read

`MemberChangeDirection` has two values:

- `Write` — this peer changed the members itself; the raise arrives before the tick's serialization runs.
- `Read` — the members were applied from the wire; the raise arrives after every packet of the inbound pass has landed, before the Reconcile step.

A visuals script almost always wants `Read` only, because it's reacting to something that arrived, not something it just wrote. Anything that calls `NetworkMemberBase.TryGetWritingClient` needs `Read` specifically — that claim only resolves under a read.

This matters most on a host. A host raises both directions in the same frame for its own change, write first, without waiting for its own packet to come back — so a handler that doesn't branch on direction reacts twice to the same pickup on a host and once everywhere else. Guard every reaction with the direction check:

```csharp
if (memberChangeDirection is not MemberChangeDirection.Read)
    return;
```

A value that's a plain function of the replicated state — recomputed the same way on every peer regardless of who wrote it — doesn't need the branch. Only genuinely one-sided reactions (a cooldown, a "you scored" label) do.

## Full applies report every member

A spawn, a resync, a reconcile, or a whole-component recovery hands you `memberFlags` as `ulong.MaxValue` under `MemberChangeDirection.Read`: treat every member as changed. This is what a late-joining client's first raise looks like — it never saw a delta, so the full apply is the only place it learns the component's starting values. Don't assume a specific bit is set before checking `memberFlags == ulong.MaxValue` for this case; a member-granular recovery instead reports only the members it actually repaired.

## Do the work on the right loop step

`OnMembersChanged` already fires event-driven at the right time, so nothing here should live in `Update`. If a script derived from `NucleusBehaviourBase` needs to do more than react to the event — read state the apply just landed, or run something every tick tied to that same point in the frame — override the per-step virtual instead of polling in `Update`:

```csharp
protected override void OnLateStateUpdate(StepDelta stepDelta)
{
    // Runs once replicated state has been applied for this tick.
}
```

`OnEarlyStateUpdate` runs just before replicated state is applied, `OnLateStateUpdate` once it has been, and `OnReconcile` after state has been set back for a reconcile. `Update` runs on Unity's own loop with no defined relationship to any of those points in a given frame; the per-step virtuals do.
