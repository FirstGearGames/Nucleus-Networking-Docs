---
title: "Unity Types and System.Numerics"
---

## Declare members in System.Numerics, not UnityEngine

The engine core replicates `System.Numerics` types. A networked member is declared as `NetworkMember<System.Numerics.Vector3>`, never `NetworkMember<UnityEngine.Vector3>`. Nucleus registers its vector and rotation handling, such as interpolation and Divine projection, for the `System.Numerics` types only. A member declared with a UnityEngine type still builds, but the generator treats the type like any struct of your own: it writes a plain serializer from the type's public fields and settable properties, and none of that handling applies. For `UnityEngine.Quaternion` that plain serializer also picks up the settable `eulerAngles` property, so every value carries the rotation twice.

The shipped `UnityNavMeshAgentComponent` follows this exactly:

```csharp
using NumericsVector3 = System.Numerics.Vector3;

public partial class UnityNavMeshAgentComponent : NetworkComponent
{
    public readonly NetworkMember<NumericsVector3> NextPoint = new(CompressionLevel.Aggressive);
    public readonly NetworkMember<NumericsVector3> PreviousPoint = new(CompressionLevel.Aggressive);
}
```

The `NumericsVector3` alias is just a using directive disambiguating from `UnityEngine.Vector3` in the same file. It's the pattern to copy: alias `System.Numerics` types at the top of a Unity-facing script rather than writing the fully qualified name at every member declaration.

## Convert at the Unity boundary

`UnityConversionExtensions` converts between the native type a member stores and the Unity type a `Transform` (or other Unity API) expects: `ToUnity()` for native to Unity, `ToNative()` for Unity to native. It covers every type both libraries define: `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Plane`, and `Matrix4x4`.

Call them at the moment you read a member into a `Transform` or write a `Transform` into a member, not before. `UnityNavMeshAgentComponent` does exactly this in its Unity-facing properties:

```csharp
public Vector3 ReplicatedNextPoint
{
    get => NextPoint.Value.ToUnity();
    set => NextPoint.Value = value.ToNative();
}
```

Everything above that boundary — the `NetworkComponent`, its `NetworkMember<T0>` fields — stays native. Everything below it — the `MonoBehaviour`, the `Transform`, `NavMeshAgent` — stays Unity. Nothing in between sees both.

## Types with generated serializers already available

Besides the `System.Numerics` vectors (`Vector2`, `Vector3`, `Vector4`), these CodeBoost types already have generated serializers and can be used in a `NetworkMember<T>` from Unity code without any attribute of your own: `Vector2Int`, `Vector3Int32`, `Vector4Int`, and `UnifiedColor`.

All seven are reached through `ExternalNetworkTypes`, a marker struct in `Nucleus.Serializers` carrying `[NetworkType]` on behalf of types declared in assemblies nobody here can annotate. Nothing reads or constructs the struct at runtime; the generator only walks its field types to know which external types need serializers.

## Your own structs need no attribute

A struct you declare yourself, made entirely of natively-serializable fields, needs no `[NetworkType]` attribute at all as long as a `NetworkMember<T>` somewhere reaches it. The generator discovers it through that member, the same way it discovers any other networked type.

## The error you get instead of a crash

An unserializable member type is caught at build time, not at runtime. The generator reports a `SERIALIZERS`-series diagnostic (`SERIALIZERS000` as an error, `SERIALIZERS001` as a warning) naming the member. A member declared as `NetworkMember<UnityEngine.Vector3>` is not caught this way: the generator can read the type's public fields, so it builds without a diagnostic and replicates through the plain serializer described above.

## Adding a type you can't annotate

For a third-party type you don't own and can't put `[NetworkType]` on, see the `ExternalNetworkTypes` reference for how to add a marker for it.
