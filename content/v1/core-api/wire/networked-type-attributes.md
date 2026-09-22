---
title: "Networked Type Attributes"
---

## The attributes

The generator reads a small set of attributes to decide what to serialize and what to leave alone. Most code needs none of them — a type reached through a `NetworkMember<T0>` field is walked automatically, and a member on a `NetworkComponent` is networked by default.

### `[NetworkType]`

Applies to a class, struct, or enum. Forces the generator to create serializers for that type even though nothing in the assembly reaches it through a `NetworkMember<T0>` field.

You will almost never need this. It exists for a type the generator has no other way to discover — one that is only ever boxed, reflected into, or otherwise referenced outside the normal member graph. Anything a `NetworkMember<T0>` already walks to gets its serializers generated automatically and does not need the attribute.

### `[NetworkIgnore]`

Applies to a field or property. Excludes that member from generation entirely — the generator does not walk it, does not include it in serialization, and produces no code for it.

### `[NetworkBundle(ushort)]`

Assembly-level. Names the bundle identifier half of every type identity the assembly declares:

```csharp
[assembly: NetworkBundle(1)]
```

A type's wire identity is the tuple of its bundle id and a per-assembly local id, so bundle ids only need to be unique across the assemblies present in a build. The always-present main bundle defaults to `0` when the attribute is absent; every other bundle should declare its own unique id exactly once. See the type identity page for how the local id side of that tuple is assigned.

### `[ReplicationIgnore]`

Applies to a `NetworkMemberBase` field, or to a whole `NetworkComponent` class (in which case it excludes every member the component declares). Keeps the value off the wire entirely while leaving how it is saved alone — the inverse of `[WorldStateIgnore]`.

It is an attribute rather than a constructor argument, and the reason is performance. A constructor argument is a runtime value, so honoring one would mean the generator still emitting every member's serialize and deserialize lines, each testing a flag at runtime on every peer, for the life of the build. An attribute is answered while code is being generated, so the member's serialize lines are never emitted at all — there is no branch to predict and no instruction to retire, because there is no code. A tick on which only marked members changed produces no packet.

Two consequences follow from that:

- **The value is the constructed default on every peer but the authority.** Nothing ever arrives to populate it, so reading one on a client returns the type's default rather than what the server holds.
- **A peer promoted to authority by adoption never received these values.** It holds the defaults rather than what the previous authority had, and saving from it writes those defaults over whatever the store already held. Server-only state does not survive a handover.

### Custom serializer attributes

`[DefaultWriter]`, `[DefaultReader]`, `[DefaultDeltaWriter]`, and `[DefaultDeltaReader]` mark a method as the default (delta) writer or reader for a type, and all four derive from the abstract `SerializerAttribute` base. These are for hand-written serialization, covered on the custom serializer page.

### Attributes that do not exist

`[NetworkTypeContainer]`, `[NetworkAccuracy(float)]`, `[NetworkSerializeMode(CompressionLevel)]`, and `[NetworkExcludeCount]` have no declaration anywhere in this tree. Accuracy and compression level are not attributes — they are constructor arguments on `NetworkMember<T0>` itself, for example `new NetworkMember<float>(CompressionLevel.Aggressive, accuracy: 0.01f)`.

### Persistence

`[WorldStateIgnore]` is the persistence-side inverse of `[ReplicationIgnore]` — it keeps a member out of a saved world while leaving replication alone. It's covered in the persistence section.
