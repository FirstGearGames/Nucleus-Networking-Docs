---
title: "Choosing what a save keeps"
---

## Keep a member out of saves with WorldStateIgnore

`WorldStateIgnoreAttribute` (`Nucleus.Managers.Persistence`) leaves a member out of a saved world without changing how it replicates. Put it on a `NetworkMemberBase` field to exclude that member, or on a `NetworkComponent` class to exclude every member it declares.

```csharp
public partial class ScoreComponent : NetworkComponent
{
    public readonly NetworkMember<int> Persisted = new();

    [WorldStateIgnore]
    public readonly NetworkMember<int> Ignored = new();

    public readonly NetworkMember<int> AlsoPersisted = new();
}
```

```csharp
[WorldStateIgnore]
public partial class SessionStatsComponent : NetworkComponent
{
    public readonly NetworkMember<int> Counter = new();
}
```

After a load, an excluded member holds the value its component was constructed with, not a saved value and not its value before the save. If a save from an earlier build still contains the member, that value is ignored.

The member replicates exactly as before, at no extra bandwidth.

The attribute compiles in Free but has no effect there, because saving worlds is Pro.

## ReplicationIgnore is the opposite

`ReplicationIgnoreAttribute` (`Nucleus.Components`) keeps a member off the wire but still saves it. It takes the same two targets: a field for one member, the class for all of them.

| Attribute | Opts out of | Member still replicates? | Member still saved? |
|---|---|---|---|
| `WorldStateIgnoreAttribute` | the save | yes | no |
| `ReplicationIgnoreAttribute` | the wire | no | yes, from whichever peer wrote it |

### A server promoted by adoption saves defaults

A peer promoted to server by adoption never received `ReplicationIgnore` values, so it holds the constructed defaults. Saving from it writes those defaults over what the store held. `WorldStateIgnore` members have no such problem, because no peer ever saves them.

## Choose between them

- **A session counter or tick stamp**: observers should see it live, but it should not come back after a load. Use `WorldStateIgnore`.
- **A visual highlight or other presentation flag**: usually needs neither saving nor sending. Use either, depending on whether other peers need to see it.
- **A cached local reference** (an object handle, a lookup recomputed on start): use `ReplicationIgnore` if it must never leave the peer that holds it, or `WorldStateIgnore` if it should replicate live but not survive a save.

## NetworkIgnore is unrelated

`Nucleus.Serializers.NetworkIgnoreAttribute` leaves a field out when a struct or class of yours is sent. It has nothing to do with `NetworkComponent` members, replication or saving.
