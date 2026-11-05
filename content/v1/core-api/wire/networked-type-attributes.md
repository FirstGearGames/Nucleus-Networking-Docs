---
title: "Networked Type Attributes"
---

Most code needs none of these attributes. A type reached through a `NetworkMember<T0>` field is serialized automatically, and a member on a `NetworkComponent` is networked by default.

## [NetworkType] makes the generator serialize a type it cannot otherwise find

Applies to a class, struct or enum. Use it only for a type nothing reaches through a `NetworkMember<T0>` field, such as one that is only boxed or reflected into. It also marks the structs described in [Reaching Types You Cannot Annotate](./external-network-types.md).

## [NetworkIgnore] excludes a member from generation

Applies to a field or property. The generator skips the member entirely and produces no code for it.

## [NetworkBundle(ushort)] sets an assembly's bundle id

```csharp
[assembly: NetworkBundle(1)]
```

The main bundle defaults to `0` when the attribute is absent. Every other assembly with networked types declares its own unique id exactly once. See [Type Identity on the Wire: Bundles and the Registry](./type-identity-and-bundles.md).

## [ReplicationIgnore] keeps a value off the network

Applies to a `NetworkMemberBase` field, or to a whole `NetworkComponent` class to exclude every member it declares. Saving is unaffected; [`[WorldStateIgnore]`](../scenes/world-state-ignore.md) is the opposite, keeping a member out of a saved world while still replicating it.

- On every peer but the server, the value stays at its constructed default.
- A peer promoted to server by adoption never received these values. It holds the defaults, and saving from it writes those defaults over what the store held. Server-only values do not survive a handover.

## Serializer attributes mark hand-written serializers

`[DefaultWriter]`, `[DefaultReader]`, `[DefaultDeltaWriter]` and `[DefaultDeltaReader]` derive from `SerializerAttribute`. See [Writing a Custom Serializer](./custom-serializers.md).

## Some attributes do not exist

`[NetworkTypeContainer]`, `[NetworkAccuracy(float)]`, `[NetworkSerializeMode(CompressionLevel)]` and `[NetworkExcludeCount]` do not exist in Nucleus. Accuracy and compression level are `NetworkMember<T0>` constructor arguments, for example `new NetworkMember<float>(CompressionLevel.Aggressive, accuracy: 0.01f)`.
