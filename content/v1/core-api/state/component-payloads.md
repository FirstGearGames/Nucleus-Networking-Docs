---
title: "Sending your own data beside the members"
---

Some things a component needs to tell a peer are not values a member can hold.

Take a cast bar. The spell being cast is a value, so it is a member. How far into the cast the caster already is, is not: it moves every tick, so holding it as a member would pay for it on every tick of every cast. What a peer actually needs is that number once, at the moment it is first told about the object at all.

A component writes that itself, by overriding a pair on `NetworkComponent`:

```csharp
public partial class CastComponent : NetworkComponent
{
    public readonly NetworkMember<ushort> SpellIndex = new();

    private uint _castStartTick;
    private uint _elapsedCastTicks;

    protected override void WriteFullPayload(Writer writer, FullPayloadReason fullPayloadReason, ulong serializedMemberFlags)
    {
        // This serialization never carried the spell, so there is no cast here to describe.
        if ((serializedMemberFlags & (ulong)CastComponentFlags.SpellIndex) == 0)
            return;

        writer.WriteUInt32(CoreManager.NetworkLoopManager.Tick - _castStartTick);
    }

    protected override void ReadFullPayload(Reader reader, FullPayloadReason fullPayloadReason, ulong serializedMemberFlags)
    {
        if ((serializedMemberFlags & (ulong)CastComponentFlags.SpellIndex) == 0)
            return;

        // SpellIndex.Value already holds what this serialization carried, so the bar can be built from both.
        _elapsedCastTicks = reader.ReadUInt32();
    }
}
```

A client that spawns halfway through a cast now has both halves: the spell from the member, and how far in it is from the payload. So does a client that lost the tick the cast started on, because the repair the engine serves for that tick carries the payload too.

## When the pair runs

It rides every serialization that carries whole values, and no ordinary delta:

- The spawn that builds the object on a peer.
- A resync, and an interest serve when an object comes back into view.
- A reconcile to a controlling client.
- A client's own write of a whole object upstream.
- The recovery serve that repairs a tick a peer lost.

An ordinary delta writes members and never the component, so a member that moves every tick costs no payload however long it moves for. A component that overrides neither method costs nothing at all, not one bit.

## It runs after the members, not before

This is the part to build on. What a payload says usually depends on what the members now hold, and a peer cannot know how to read one until it has read them. So the pair is a trailer: by the time `ReadFullPayload` runs, every member of that component has already landed and can be read straight off it. The example above relies on exactly that, reading `SpellIndex.Value` while it parses the elapsed time that belongs beside it.

## The two arguments

`serializedMemberFlags` says which members this serialization carried, one bit per member Id, matching the `<Component>Flags` enum the generator already writes for you.

It is `NetworkComponent.EverySerializedMember` whenever the whole component is being carried, which covers a spawn, a resync, an interest serve and a reconcile. It is narrower for a recovery serve, and that is the case the flags exist for. A recovery is not a re-send of everything: it repairs only the members the lost tick actually carried. A payload describing one particular member has no business riding a repair that member was not part of, so test its bit and return when it is clear.

`fullPayloadReason` says why the component is being serialized whole, and is one of four:

| Reason | When |
|---|---|
| `Serve` | The authority is handing a peer the whole component: a spawn, a resync, or an interest serve bringing it back into view. |
| `ClientWrite` | A client is writing the whole component upstream. A predicted spawn reports this too, because what both ends can agree on is that the sender was not the authority. |
| `Reconcile` | The authority is correcting the client that controls the object. |
| `Recovery` | The authority is repairing a tick a peer lost. This is the only reason whose member flags are narrower than the whole component. |

Nothing on the wire carries it. The writer knows what it is doing, and the reader derives the same answer from the subpacket kind the frame already named and from whether the Connection the body arrived on is the server's, so the two agree by construction and it costs no bits.

`Reconcile` is the one worth naming when deciding what to write: a controlled object reconciles to its controller constantly, so a payload written there is paid for on every tick of prediction, where the same payload on a `Serve` is paid for once. Return early for the reasons you have nothing to say for.

## The one rule

Nothing frames the payload, so **every bit written must be read back**. Write four bytes and read two, and everything behind the payload decodes against the wrong offset. That surfaces as values arriving wrong or a whole tick being discarded, usually somewhere far away from the component that caused it.

Both ends are handed the same flags and the same reason precisely so the decision to write and the decision to read are made from the same facts rather than each end guessing. Gate on those two arguments and on the member values. Never gate on local state the other end cannot see, such as a field only the server sets or something read off your own scene.

A read also happens on a body the engine is about to throw away, so applying a payload must be harmless rather than guarded against.

## Prefer a member where the data is a value

The pair has no change detection of its own and is not meant to. It rides the serves your members have already earned, so a component whose members never change is never served and never writes a payload.

Where the thing genuinely is a value, a member is still the better answer, and it is cheaper than it looks. A cast's *start tick* as a member changes once per cast and costs nothing on the ticks between, and every peer can subtract it from the current tick itself. Reach for a payload when the thing is not a value: a snapshot you compute rather than store, a variable-length list, or anything whose meaning is "here is where this object stands right now" rather than "here is what just changed".

## The other payload

A [spawn payload](../systems/spawning-systems.md) is the other half of this. That one is declared per object rather than per component, rides the spawn alone and never a repair, and is always read after the member states. Use it for what is true about an object at the moment it spawns. Use the pair here for what a component's own state needs to carry alongside it.
