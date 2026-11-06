---
title: "Reacting to a replicated change in Unity"
---

> **Driving the core API directly?** See [Reacting to changes: OnMembersChanged](../../core-api/state/change-callbacks.md).

`NetworkComponent.OnMembersChanged` is called once per tick per direction when any of the component's members changed, so a script never has to poll a value.

```csharp
public virtual void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection) { }
```

## Forward OnMembersChanged to your MonoBehaviour

A MonoBehaviour cannot inherit from a `NetworkComponent`, and the component can be rented and returned independently of the scene object watching it. So override `OnMembersChanged` on the component and raise an event:

```csharp
public partial class CoinComponent : NetworkComponent
{
    public event MembersChangedHandler MembersChanged;
    public delegate void MembersChangedHandler(ulong memberFlags, MemberChangeDirection memberChangeDirection);

    public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
        => MembersChanged?.Invoke(memberFlags, memberChangeDirection);
}
```

Subscribe from the MonoBehaviour when it rents the system, and unsubscribe when it is destroyed:

```csharp
_coinComponent.MembersChanged += OnCoinMembersChanged;
// ...
_coinComponent.MembersChanged -= OnCoinMembersChanged;
```

## Find which member changed

Every `NetworkComponent` gets a generated `[Flags] enum <ComponentName>Flags : ulong`, one value per member in declaration order. Cast `memberFlags` to it and test the bits you need:

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

A set flag means the member was applied, not that its value differs: a predicted member's confirmed outcome still sets its flag.

A spawn, a resync, a reconcile or a whole-component recovery reports `memberFlags` as `ulong.MaxValue` under `Read`: treat every member as changed. A late-joining client's first call looks like this. A member-granular recovery reports only the members it repaired.

## Usually react only to MemberChangeDirection.Read

- `Write`: this peer changed the members itself. It is raised before the tick is sent, even for a system with no observers.
- `Read`: the members were applied from received state. It is raised once everything received for the tick is applied, before the Reconcile step. `NetworkMemberBase.TryGetWritingClient` only resolves under `Read`.

A host raises both directions in the same frame for its own change, `Write` first. A handler that ignores the direction reacts twice on a host and once everywhere else, so guard one-sided reactions, such as a cooldown or a "you scored" label:

```csharp
if (memberChangeDirection is not MemberChangeDirection.Read)
    return;
```

A value recomputed the same way on every peer from the replicated state does not need the guard.

## Do per-tick work in a step virtual, not Update

To read state the apply just landed, or run something every tick at that point, override a step virtual on your `NucleusBehaviourBase` script instead of polling in `Update`, which has no fixed relationship to the network loop:

```csharp
protected override void OnLateStateUpdate(StepDelta stepDelta)
{
    // Runs once replicated state has been applied for this tick.
}
```

`OnEarlyStateUpdate` runs just before replicated state is applied, `OnLateStateUpdate` once it has been, and `OnReconcile` after state has been set back for a reconcile.
