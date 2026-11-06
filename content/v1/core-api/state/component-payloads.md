---
title: "Sending your own data beside the members"
---

Override `WritePayload` and `ReadPayload` on a `NetworkComponent` to send data that is not a member value whenever a peer is told about the component as a whole.

For example, a cast bar's spell is a value, so it is a member. How far into the cast the caster is changes every tick, so as a member it would be paid for on every tick of every cast. A peer only needs it once, when it first learns about the object:

```csharp
public partial class CastComponent : NetworkComponent
{
    public readonly NetworkMember<ushort> SpellIndex = new();

    private uint _castStartTick;
    private uint _elapsedCastTicks;

    protected override void WritePayload(Writer writer, PayloadReason reason, Invoker author, ulong serializedMemberFlags)
    {
        // This serialization never carried the spell, so there is no cast here to describe.
        if ((serializedMemberFlags & (ulong)CastComponentFlags.SpellIndex) == 0)
            return;

        writer.WriteUInt32(CoreManager.NetworkLoopManager.Tick - _castStartTick);
    }

    protected override void ReadPayload(Reader reader, PayloadReason reason, Invoker author, ulong serializedMemberFlags)
    {
        if ((serializedMemberFlags & (ulong)CastComponentFlags.SpellIndex) == 0)
            return;

        // SpellIndex.Value already holds what this serialization carried, so the bar can be built from both.
        _elapsedCastTicks = reader.ReadUInt32();
    }
}
```

A client that spawns halfway through a cast now gets the spell from the member and the progress from the payload. So does a client that lost the tick the cast started on, because the repair for that tick carries the payload too.

## When the payload runs

Only on these, never on an ordinary update:

- the spawn that builds the object on a peer;
- a resync, and an interest serve when an object comes back into view;
- a reconcile to a controlling client;
- a client's own write of a whole object upstream;
- the recovery that repairs a tick a peer lost.

A member that changes every tick costs no payload however long it changes. A component that overrides neither method costs nothing.

## Members are applied first

By the time `ReadPayload` runs, every member of the component has been applied, so you can read them while parsing the payload. The example reads `SpellIndex.Value` this way.

## Use the arguments to decide what to write

- `serializedMemberFlags`: which members this serialization carried, one bit per member Id, matching the generated `<Component>Flags` enum. It is `NetworkComponent.EverySerializedMember` when the whole component is carried (a spawn, resync, interest serve or reconcile). A recovery carries only the members the lost tick carried, so a payload about one member should test that member's bit and return when it is clear.
- `author`: an `Invoker` saying which side wrote the body: this peer when writing, the sender when reading. Each reason means the same thing whichever side wrote it.
- `reason`: why the whole component is being sent, one of three `PayloadReason` values:

| Reason | When |
|---|---|
| `Serve` | The receiver builds the object, or rebuilds it from nothing it can trust. From the authority: a spawn, a resync or an interest serve. From a client: a predicted spawn. |
| `Reconcile` | The authority is correcting the client that controls the object. |
| `Recovery` | The authority is repairing a tick a peer lost. The only reason whose member flags can be narrower than the whole component. |

A controlled object reconciles to its controller constantly, so a payload written on `Reconcile` is paid for on every tick of prediction, while one written on `Serve` is paid for once. Return early for reasons you have nothing to say for.

## Read back every bit you write

Write four bytes and read two, and everything after the payload reads wrong. That shows up as wrong values or a whole tick discarded, often far from the component that caused it.

Both ends receive the same flags and reason. Decide what to write and what to read from those and from the member values only, never from local state the other end cannot see, such as a field only the server sets or something read from your own scene.

A read can happen on a body the engine then throws away, so applying a payload must be harmless.

## When a payload throws

An exception in either method is caught and logged, and the whole body is dropped rather than sent half written.

- **Writing**: the body is not sent. Those peers are served again later, so a payload that keeps throwing keeps its object from ever reaching them.
- **Reading**: handled like a body that could not be read. A later repair replaces it, and a predicted spawn whose payload throws is refused.

## Prefer a member when the data is a value

A payload has no change detection. It runs only alongside sends your members already cause, so a component whose members never change never writes one.

If the data is a value, a member is usually cheaper than it looks. A cast's start tick as a member changes once per cast, costs nothing in between, and every peer can subtract it from the current tick. Use a payload for something you compute rather than store, a variable-length list, or a snapshot of where an object stands right now.

## A spawn payload is different

A [spawn payload](../systems/spawning-systems.md) is declared per object rather than per component, sent only with the spawn and never with a repair, and read after the member values. Use it for what is true about an object when it spawns, and the component payload for state a component carries alongside its members.
