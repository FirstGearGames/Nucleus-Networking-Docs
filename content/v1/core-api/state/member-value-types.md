---
title: "What a member can hold, and how to keep one off the wire"
---

## What `T0` can be

A `NetworkMember<T0>` field must satisfy one of three shapes:

- A value type.
- `string`.
- A class implementing `IPoolResettable`, used together with automatic pooling.

A class-typed member must be assigned before it is first sent. An unset member holds `null`, which cannot be sent.

```csharp
private readonly NetworkMember<float> _health = new();
private readonly NetworkMember<MyPoolableClass> _payload = new(isAutomaticPoolingEnabled: true);
```

## Automatic pooling

`NetworkMember<T0>` keeps a few past values so it can expose `PreviousValue` alongside the live `Value`. When a class-typed, `IPoolResettable` value is dropped from that history, `isAutomaticPoolingEnabled: true` (a constructor argument on `NetworkMember<T0>`) routes it back to its pool through `NetworkTypePoolReturner<T0>`, whose `Return` method invokes a pool-return delegate registered for that closed `T0`. Incoming instances are rented from `ResettableObjectPool<T0>` rather than allocated, so pooling covers both ends.

`NetworkTypePoolReturner<T0>.IsRegistered` reports whether a returner exists for the type. If automatic pooling is enabled but the type either does not implement `IPoolResettable` or has no returner registered, that is surfaced as an error once at spawn rather than on every drop.

Automatic pooling v1 targets flat value objects. A nested class-typed field inside a pooled `T0` can alias across instances.

## Member type support is scoped, not gapped

Not every type works as a member value, and the ones that do not are never replicated silently wrong: several types (`Matrix4x4`, plain arrays, `NetworkSystemGroup`, `Channel`, `NetworkSystem`) throw `NotImplementedException` when a member holding one sends a change. That is a deliberate boundary, not an oversight to work around. Register a serializer for a type that has none rather than routing it through `NetworkMember<T0>` as-is; see the Serialization section.

## `[ReplicationIgnoreAttribute]`

`[ReplicationIgnore]` keeps a member off the wire while leaving how it is saved alone. It targets a `NetworkMemberBase` field or a whole `NetworkComponent`; on a field it excludes that member, on the component it excludes every member the component declares.

```csharp
[ReplicationIgnore]
private readonly NetworkListMember<ItemStack> _containerContents = new();

[ReplicationIgnore]
private readonly NetworkMember<bool> _isModerationFlagged = new();
```

It is an attribute rather than a constructor argument because the exclusion is decided at compile time, with no runtime cost. Persistence and replication are separate decisions, and this attribute only touches the second one, so a container's contents or a moderation flag can survive a restart without being handed to every observer.

### The three consequences

- **The member is never sent.** No send interval or transmission mode applies to it, and a tick on which only ignored members changed sends nothing. `NetworkComponent.OnMembersChanged` still fires under `MemberChangeDirection.Write` on the peer that made the change, so server code reacts to it normally.
- **The value is the constructed default on every peer but the server.** Nothing is ever received to populate it, so reading it on a client returns the type's default, not what the server holds.
- **A peer promoted to server by adoption holds those defaults too**, because it never received the real values. Saving from a newly adopted server writes those defaults over whatever the store already held.

## See also

- Serialization — registering a delta or full serializer for a type that has none.
- Persistence — `[WorldStateIgnore]`, the inverse: keeps a member out of a saved world while leaving replication alone.
