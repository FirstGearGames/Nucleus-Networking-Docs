---
title: "Choosing what a save keeps"
---

## WorldStateIgnoreAttribute

`WorldStateIgnoreAttribute` (`Nucleus.Managers.Persistence`) keeps a member out of a saved world while leaving everything about how it replicates alone. Applied to a `NetworkMemberBase` field on a `NetworkComponent`, it excludes that one member. Applied to the component class itself, it excludes every member the component declares.

```csharp
public partial class WorldStateIgnoreStateComponent : NetworkComponent
{
    public readonly NetworkMember<int> Persisted = new();

    [WorldStateIgnore]
    public readonly NetworkMember<int> Ignored = new();

    public readonly NetworkMember<int> AlsoPersisted = new();
}
```

```csharp
[WorldStateIgnore]
public partial class WorldStateIgnoreComponentStateComponent : NetworkComponent
{
    public readonly NetworkMember<int> Counter = new();
}
```

The exclusion is compile-time. The source generator does not emit the marked member's line into `WriteWorldState` or `ReadWorldState`, so there is no runtime check paying for it on every save. A save written by an earlier build that still contains the member is simply never asked for it. After a load, the member keeps the value its component was constructed with — not a stored value, not the value from before the save, the constructed default.

Nothing about the wire changes. The member keeps its member Id, its flag bit, and its place in the component's serialized body. Marking a member costs no bandwidth and does not renumber anything around it.

## WorldStateIgnore vs. ReplicationIgnore

`ReplicationIgnoreAttribute` (`Nucleus.Components`) is the inverse: it keeps a member off the wire while leaving how it is saved alone. Same two targets — a field for one member, the class for all of them.

That pairing is the whole of what separates the two decisions:

| Attribute | Opts out of | Member still replicates? | Member still saved? |
|---|---|---|---|
| `WorldStateIgnoreAttribute` | the save | yes | no |
| `ReplicationIgnoreAttribute` | the wire | no | yes, from whichever peer wrote it |

### The adoption trap

A peer promoted to server by adoption never received `ReplicationIgnore`-marked values — nothing was ever sent to it for them. It holds the constructed defaults, not whatever the previous server had. Saving a world from that peer writes those defaults over whatever the store already held for those members. This is specific to `ReplicationIgnoreAttribute`; a `WorldStateIgnore` member behaves the same on every peer regardless of role, because no peer ever saves it.

## Choosing between them

- **A session counter or tick stamp** — worth replicating so observers see it live, not worth restoring after a load: `WorldStateIgnore`.
- **A visual highlight or other purely presentational flag** — often neither needs saving nor needs to leave the peer that set it, so either attribute can apply depending on whether other peers need to see it.
- **A cached local reference** (an object handle, a lookup result recomputed on start) — not meaningful to another peer and not meaningful after a load: mark it `ReplicationIgnore` if it must never leave the peer that holds it, or `WorldStateIgnore` if it should still replicate live but not survive a save.

## Free vs. Pro

`WorldStateIgnoreAttribute` and its generator support are not Pro-gated. They compile and work in a Free build. The attribute simply has no observable effect until Pro's world persistence is actually saving and loading worlds — there is nothing to exclude a member from until then.

## Not the same as NetworkIgnoreAttribute

`Nucleus.Serializers.NetworkIgnoreAttribute` is unrelated to both of the above. It excludes a field from a serialized type — the shape the serializer generates for a struct or class passed over the wire — not a `NetworkComponent` member's participation in replication or saving.
