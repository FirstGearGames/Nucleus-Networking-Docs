---
title: "References between systems"
---

Interest means a peer can lose sight of a system and regain it later, on ticks it does not control. A plain identifier survives that — the number does not change — but a plain object reference does not: the instance a peer resolved last tick may not exist on this peer at all next tick, and the one it resolves to next week is not guaranteed to be the same managed object. `NetworkSystemMember` and `NetworkConnectionMember` exist to hold a reference that keeps working across that gap: replicated as an identifier, resolved to a local instance whenever this peer can currently see the target, and re-resolved on its own whenever interest changes.

## NetworkSystemMember

`NetworkSystemMember` points at another `NetworkSystem`.

```csharp
public NetworkSystem Value { get; set; }
public uint TargetId { get; }

public void Initialize(NetworkComponent networkComponent, byte id);
```

`Value` is the local instance the reference currently resolves to, or `null` when it references nothing or references something this peer cannot currently see. `TargetId` is the raw identifier and is readable either way — it holds the target's Id whether or not `Value` has resolved it, because the Id is the only thing that can resolve the reference later.

Declare one as a field on a `NetworkComponent`, the same way a `NetworkMember<T0>` is declared:

```csharp
public readonly NetworkSystemMember Target = new();
```

`Initialize` wires the member to its owning component and gives it its member Id within that component; the generator calls it, the same as it does for every other member family.

## NetworkConnectionMember

`NetworkConnectionMember` is the same shape, pointed at a peer instead of a system:

```csharp
public Connection Value { get; set; }
public uint TargetId { get; }

public void Initialize(NetworkComponent networkComponent, byte id);
```

`Value` and `TargetId` mean the same thing here as they do on `NetworkSystemMember`. The one place they diverge is what happens when the referenced peer leaves. Connection identifiers are recycled — the next peer to connect can be handed the same Id a departed peer used — so a reference cannot simply keep resolving to whatever now holds that Id. When the peer a `NetworkConnectionMember` names departs, `Value` returns to `null` rather than silently aliasing whoever arrives next. The Id itself is left alone, so the reference resolves again if that same peer genuinely reconnects with the same identifier.

## Resolution is a subscription, not a one-time lookup

Assigning `Value` does not do a one-shot lookup that is later forgotten. Both member types subscribe their target Id to a registry for as long as the reference exists, and that subscription is what makes the member keep working as interest changes: when the target leaves this peer's routing table, the member drops back to `Value == null`; when the target (or, for a connection, that same Id) enters the routing table again, the member resolves it again automatically, with no code re-checking or re-fetching anything.

This is why a reference is written and read even while `Value` is `null` — `TargetId` is what rides the wire, and it is what lets the member pick the resolution back up later without anyone re-sending the assignment.

## Cost

An unset reference costs one bit on the wire. A set reference costs that bit plus the Id, and an Id in the low range costs about a byte. A game that holds no references between systems pays essentially nothing for the feature existing.

## Why not a value member

`NetworkSystemMember` and `NetworkConnectionMember` do not derive from the same base a scalar member does, and they don't behave like one. An identity is exact or it's wrong — there's nothing to interpolate between two identities, no snap threshold for a value that either matches or doesn't, no accuracy tolerance to compare against, and no delta projection to run on something with no continuous path. All of that machinery exists for values that move smoothly through a numeric space; a reference just names a thing, so none of it applies.

## Reacting to resolution

A reference resolving or losing its target does not fire an event of its own — it's reported the same way any other member change is, through the component's `OnMembersChanged` callback. See [Reacting to changes: OnMembersChanged](../state/change-callbacks) for how to read that callback and tell a reference's resolution apart from a regular value write.
