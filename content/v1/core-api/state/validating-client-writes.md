---
title: "Judging and arbitrating client writes"
---

## Declining a value

A client is allowed to write a `NetworkMember<T0>` at all — that question is settled by `StateWriteAccess` before the payload is even read. What the value should be is a separate question, and it can only be asked once the value is decoded. To answer it, implement `IStateWriteValidator<T0>` on the `NetworkComponent` that owns the member and return a `StateWriteAction` from `ValidateStateWrite`:

```csharp
public partial class ContestedSwitchComponent : NetworkComponent, IStateWriteValidator<uint>
{
    public readonly NetworkMember<uint> ActiveSwitchIndex = new();

    public StateWriteAction ValidateStateWrite(NetworkMember<uint> networkMember, uint proposedValue, Connection writingClientConnection) =>
        proposedValue < SwitchCount ? StateWriteAction.Accept : StateWriteAction.Decline;
}
```

`StateWriteAction.Accept` lands the value exactly as it would with no validator present. `StateWriteAction.Decline` leaves the member on the value it already holds. `Accept` is the zero value, so a validator that falls through without expressing an opinion never accidentally declines a write.

The member's current value is still readable through `networkMember.Value` inside the call — the proposed value hasn't replaced it yet, which is what makes comparing the two possible here and nowhere else.

## Why it's generic, and implemented once per type

`IStateWriteValidator<T0>` is generic over the member's value type, and a component implements it once for each type it wants judged. A component holding a `NetworkMember<uint>` and a `NetworkMember<bool>` implements the interface twice if it wants to judge both.

That's what keeps the value typed and off the heap. `NetworkComponent` itself is not generic, so a single non-generic hook would have to hand every value over as `object` and box each one on the inbound apply path. Splitting the hook per type avoids that entirely.

## Telling two members of the same type apart

A component can hold more than one `NetworkMember<uint>`, and both route through the same `ValidateStateWrite(NetworkMember<uint>, uint, Connection)` implementation. The member is passed as a parameter for exactly this reason — the type alone doesn't identify which one is being written. Compare the passed member against your own fields instead of keying on anything the framework supplies:

```csharp
if (ReferenceEquals(networkMember, ActiveSwitchIndex))
{
    // ...
}
```

## Authority-side only

`ValidateStateWrite` is never consulted on a client, and never for the authority's own writes. A client running it would be vetoing the value it's being told to hold; a server judging its own write would be asking permission from the code that just made the decision.

A component that doesn't implement `IStateWriteValidator<T0>` for a given type isn't consulted at all — it pays a single type test on the apply path, nothing more.

## What Decline does on the wire

Declining doesn't unwind anything. The bits for the value were already consumed off the stream before the validator ran, so the stream stays aligned regardless of the outcome. Nothing about a declined value is relayed onward — the other observers are never told about a value the authority didn't take.

On the client whose write was declined, the member keeps showing that client's own value for the duration of the convergence window, then reverts to the authority's value once the window closes. That reversion costs no traffic: the authority's value never moved, so there's nothing new to send. It's picked up from the read baseline the decode already advanced.

## A declined write is not a violation

Declining a value never raises anything and never counts against the client. The client proposed something the game didn't want, which is an ordinary outcome — not evidence of misbehavior. Reach for the violation pipeline only when a client sent something it should never have been able to send at all, not for a value that was merely rejected.

## Contention: first write wins

When two clients write the same member on the same tick, arbitration is the default behavior and it applies whether or not a validator is present: the first write applied wins. Because the inbound walk visits connections in ascending `Connection.Id` order, "first write applied wins" and "lowest permitted connection Id wins" are the same statement. No preference is expressed beyond that ordering.

`Connection.Id` is arbitrary but stable for the life of a connection — it isn't chosen for fairness, and it isn't a security boundary. A client that disconnects and reconnects gets a fresh `Id`, so arbitration on `Id` can be farmed by reconnecting into a more favorable position. Anything that genuinely needs to matter — a claim that should survive a reconnect, or resist being gamed by one — has to be arbitrated on `Connection.Identity`, the value that names a client across reconnects, instead of on `Connection.Id`.

## Attributing a landed write

To find out which client's write actually landed on a member this tick, call `TryGetWritingClient(out Connection connection)` on the `NetworkMember<T0>`. It's meant to be called from inside `NetworkComponent.OnMembersChanged` while under a read raise (`MemberChangeDirection.Read`), which runs while the tick that applied the write is still current — asking on a later tick reports `false`.

A server write, and a local write on either peer, never stamp a writing client, so asking about your own write honestly reports nothing. Only a value that genuinely arrived from a client over the wire is attributed, and a writer that has since disconnected also reports `false` rather than handing back a stale `Connection`.
