---
title: "What a member can hold, and how to keep one off the wire"
---

## Use a value type, a string or a pooled class

A `NetworkMember<T0>` value must be one of:

- a value type;
- `string`;
- a class implementing `IPoolResettable`, with automatic pooling.

A class-typed member must be assigned before it is first sent, because `null` cannot be sent.

```csharp
private readonly NetworkMember<float> _health = new();
private readonly NetworkMember<MyPoolableClass> _payload = new(isAutomaticPoolingEnabled: true);
```

Some types throw `NotImplementedException` when a member holding one sends a change, rather than replicating wrong: `Matrix4x4`, plain arrays, `NetworkSystemGroup`, `Channel` and `NetworkSystem`. For a type with no serializer, register one; see [Writing a Custom Serializer](../wire/custom-serializers.md).

## Turn on automatic pooling for class values

With `isAutomaticPoolingEnabled: true`, a class-typed `IPoolResettable` value is returned to its pool when the member drops it from its history, and incoming instances are rented from `ResettableObjectPool<T0>` instead of allocated. Rent the instances you assign from `ResettableObjectPool<T0>`, and never keep or change one after assigning it.

If the type does not implement `IPoolResettable`, or has no pool returner registered (check `NetworkTypePoolReturner<T0>.IsRegistered`), an error is logged once at spawn.

Pool only flat objects. A nested class-typed field inside a pooled `T0` can end up shared between instances.

## Keep a member off the wire with ReplicationIgnore

`[ReplicationIgnore]` keeps a member off the wire but still saves it. Put it on a `NetworkMemberBase` field to exclude that member, or on a `NetworkComponent` to exclude every member it declares.

```csharp
[ReplicationIgnore]
private readonly NetworkListMember<ItemStack> _containerContents = new();

[ReplicationIgnore]
private readonly NetworkMember<bool> _isModerationFlagged = new();
```

Use it for data that must survive a restart without going to every observer, such as a container's contents or a moderation flag. What happens:

- **The member is never sent.** No send interval or transmission mode applies, and a tick where only ignored members changed sends nothing. `NetworkComponent.OnMembersChanged` still fires under `MemberChangeDirection.Write` on the peer that changed it, so server code can react normally.
- **Every peer but the server holds the constructed default.** Reading it on a client returns the type's default, not the server's value.
- **A peer promoted to server by adoption holds those defaults too.** Saving from it writes the defaults over what the store held.

For the opposite, keeping a member out of saves but still replicating it, see [Choosing what a save keeps](../scenes/world-state-ignore.md).
