---
title: "What a member can hold, and how to keep one off the wire"
---

## What `T0` can be

A `NetworkMember<T0>` field must satisfy one of three shapes:

- A value type.
- `string`.
- A class implementing `IPoolResettable`, used together with automatic pooling.

A class-typed member must be assigned before its first full serialization. An unset member holds `null`, and the generated writers cannot encode that.

```csharp
private readonly NetworkMember<float> _health = new();
private readonly NetworkMember<MyPoolableClass> _payload = new(isAutomaticPoolingEnabled: true);
```

## Automatic pooling

`NetworkMember<T0>` keeps a small ring of past values so it can expose `PreviousValue` alongside the live `Value`. When a class-typed, `IPoolResettable` value is dropped from the ring, `isAutomaticPoolingEnabled: true` (a constructor argument on `NetworkMember<T0>`) routes it back to its pool through `NetworkTypePoolReturner<T0>`, whose `Return` method invokes a pool-return delegate registered for that closed `T0`. This closes the loop with the generated deserializers, which rent incoming instances from `ResettableObjectPool<T0>` rather than allocating them.

`NetworkTypePoolReturner<T0>.IsRegistered` reports whether a returner exists for the type. If automatic pooling is enabled but the type either does not implement `IPoolResettable` or has no returner registered, that is surfaced as an error once at spawn rather than on every drop.

Automatic pooling v1 targets flat value objects. A nested class-typed field inside a pooled `T0` can alias across instances, because the delta reader copies an unchanged field by reference rather than by value.

## Delta support is scoped, not gapped

The generated writers and readers have delta serializers for numerics, `Quaternion`, `List<T0>` and `Dictionary<T0,T1>`, `Nullable<T0>`, and generated composite types. Types outside that set are not silently mis-encoded: several delta paths (`Matrix4x4`, plain arrays, `NetworkSystemGroup`, `Channel`, `NetworkSystem`) throw `NotImplementedException` instead. That is a deliberate boundary on which types are considered hot enough to delta-encode, not an oversight to work around. Register a serializer for a type that has none rather than routing it through `NetworkMember<T0>` as-is — see the Serialization section.

## `[ReplicationIgnoreAttribute]`

`[ReplicationIgnore]` keeps a member off the wire while leaving how it is saved alone. It targets a `NetworkMemberBase` field or a whole `NetworkComponent`; on a field it excludes that member, on the component it excludes every member the component declares.

```csharp
[ReplicationIgnore]
private readonly NetworkMember<List<ItemStack>> _containerContents = new();

[ReplicationIgnore]
private readonly NetworkMember<bool> _isModerationFlagged = new();
```

It is an attribute rather than a constructor argument because the exclusion is decided while the source generator emits code: a marked member's serialize and deserialize lines are never generated at all, so there is no per-peer branch testing a runtime flag. This is why a container's contents or a moderation flag can survive a restart without being handed to every observer: persistence and replication are separate decisions, and this attribute only touches the second one.

### The three consequences

- **The member never enters the per-tick change examination.** It pays for no delta projection, no tolerance comparison, no send interval, and no transmission mode. A tick on which only ignored members changed produces no packet. `NetworkComponent.OnMembersChanged` still fires under `MemberChangeDirection.Write` on the peer that made the change, so server code reacts to it normally.
- **The value is the constructed default on every peer but the server.** Nothing ever arrives on the wire to populate it, so reading it on a client returns the type's default, not what the server holds.
- **A peer promoted to server by adoption holds those defaults too**, because it never received the real values. Saving from a newly adopted server writes those defaults over whatever the store already held.

## See also

- Serialization — registering a delta or full serializer for a type that has none.
- Persistence — `[WorldStateIgnore]`, the inverse: keeps a member out of a saved world while leaving replication alone.
