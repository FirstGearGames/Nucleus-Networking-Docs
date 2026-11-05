---
title: "References between systems"
---

A peer can lose sight of a system through interest and regain it later, so a plain object reference to another system goes stale. `NetworkSystemMember` and `NetworkConnectionMember` hold a reference that keeps working: they replicate an identifier and resolve it to a local instance whenever this peer can see the target.

## Point at another system with NetworkSystemMember

Declare it as a field on a `NetworkComponent`, like a `NetworkMember<T0>`:

```csharp
public readonly NetworkSystemMember Target = new();
```

```csharp
public NetworkSystem Value { get; set; }
public uint TargetId { get; }

public void Initialize(NetworkComponent networkComponent, byte id);
```

- `Value` is the local instance, or `null` when the reference is empty or the target is not visible on this peer.
- `TargetId` is the target's Id, readable whether or not `Value` is resolved.
- `Initialize` is called for you, as for every other member.

## Point at a peer with NetworkConnectionMember

`NetworkConnectionMember` has the same members, with `Value` typed as `Connection`:

```csharp
public Connection Value { get; set; }
public uint TargetId { get; }

public void Initialize(NetworkComponent networkComponent, byte id);
```

Connection Ids are reused, so when the referenced peer leaves, `Value` returns to `null` rather than pointing at whoever gets that Id next. `TargetId` is kept, so the reference resolves again if the same peer reconnects with the same identifier.

## References re-resolve on their own

Both members keep following their `TargetId` for as long as they exist. When the target leaves this peer's view, `Value` becomes `null`; when it returns, `Value` resolves again with no code on your part.

They are not value members: they have no interpolation, snap threshold or accuracy tolerance.

## React when a reference resolves

A reference resolving or losing its target raises no event of its own. It is reported through the component's `OnMembersChanged` callback; see [Reacting to changes: OnMembersChanged](../state/change-callbacks.md) for how to tell it apart from a value write.
