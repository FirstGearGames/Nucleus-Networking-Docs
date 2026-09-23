---
title: "What the Generator Emits"
---

## The per-component partial

A `NetworkComponent` you declare is a partial class. At build time, `NetworkComponentBuilder` fills in the other half: a full `Write`/`Read` pair, a delta `WriteDelta`/`ReadDelta` pair, and a `[Flags] ulong` enum recording which fields a delta touched. `Write` and `Read` walk every replicated `NetworkMember` field in declaration order; `WriteDelta` and `ReadDelta` do the same, reserving one bit per member up front and only touching a member whose bit is set. The change-flags enum is named `{YourTypeName}Flags`, with one member per declared field starting at `None = 0`.

A component with no replicated members emits neither pair at all, inheriting the empty base implementation. Both peers compile the same decision, so the wire format agrees without either side needing to check at runtime.

## Reachability

The generator finds types by walking fields, not by scanning for an attribute. Any type reached through a `NetworkMember<T0>` field - including a plain struct you define yourself - gets a full serializer with no marker required. `[NetworkType]` exists for the opposite case: a type nothing reaches this way, which needs the attribute to force a serializer into existence.

An inherited field is written and read too, ahead of the declaring type's own fields, so subclassing a plain base class with public fields still nets every value on the wire.

## Full and delta halves are generated together

A type's full serializer and its delta serializer are produced by the same pass, from the same member list. If a member's type has no full writer, the generator reports it in a warning naming the member and drops it from both halves; it never emits one half without the other. A member the generator genuinely cannot serialize is therefore a build-time diagnostic, not something discovered later on the wire.

## Registration

Each assembly gets one generated `NetworkTypeRegistry` class carrying a `[ModuleInitializer]`-attributed method. It registers every discovered `NetworkSystem` subclass and every constructible `NetworkComponent` type into `Nucleus.Serializers.NetworkTypeRegistry` as the assembly loads, calling `RegisterSystem<T>(bundleId, localId)` and `RegisterComponent<T>(bundleId, localId)` for each. Nothing needs to call this and there is no reflection walk at runtime to build it: the module initializer runs once, at load, before any of the assembly's own code.

Registration order is deterministic: systems and components are each sorted with `OrderBy(..., StringComparer.Ordinal)` on their full type name before numbering, so a rebuild from the same source always assigns the same local ids.

## Numbering

Local ids are numbered per assembly (per bundle), and the two counters start differently:

- **Systems** start at `1`. Local id `0` is reserved for the base `NetworkSystem`.
- **Components** start at `0`.

Every bundle numbers its own systems from one and its own components from zero; the numbering resets per assembly and is paired with that assembly's bundle id to form a type's wire identity.

## Equality comparers

`ComparerBuilder` generates a static equality-comparer method for every discovered networked type, invoked through `NetworkTypeEqualityComparer<T0>.Compare`. Delta serializers use these to decide whether a member changed. A container type compares member by member, recursing into the comparer generated for each member's type; a primitive array is compared by content via `SequenceEqual` rather than by reference, so an in-place edit is detected as a change.

## Enum packing

An enum member is packed to the minimum bit width that round-trips every value the enum can hold, when its underlying type is unsigned and none of its declared values are negative - the same rule applies whether or not the enum is `[Flags]`. The delta writer for a bit-packable enum writes only when the value changed; where the width can't be determined this way, the enum falls back to serializing through its underlying type's own serializer.

## SharedSignatures and CodeBoost's `[CreateSignature]`

Generated code and hand-written engine code both need to compile against the same shapes - a generated `Write` override has to see the exact same `NetworkMember<T0>.Write` signature the hand-written base class declares. CodeBoost's `[CreateSignature]` attribute marks the members whose signature must mirror into `Nucleus.CodeAnalysis.SourceGenerators/SharedSignatures`, a tree of `.g.cs` files under that path (92 of them, as of this writing) that the generator project reads without depending on the whole engine assembly.

These `.g.cs` files are tracked source, not build output. They're regenerated deliberately when a signature changes, then committed and edited like any other file the generator depends on - never gitignored, never deleted on the assumption that a build will replace them.

## The ceiling

`Serializers.Constants.MaximumNetworkMemberCount` is `63`, and the usable count is one less: the generator reports `SERIALIZERS000` for a type that declares 63 or more network members, so a single type can declare at most 62. The ceiling exists because the delta flags backing each type's change set is a `ulong` and the shift that sets a member's bit is computed as a 64-bit operation to avoid aliasing member 32 onto member 0. The check covers the structs and classes the generator writes serializers for; it is not applied to a `NetworkComponent`, whose own limit is described in [How replicated state works](../state/state-replication-model.md).
