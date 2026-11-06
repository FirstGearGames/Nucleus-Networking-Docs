---
title: "Unity Types and System.Numerics"
---

## Declare members in System.Numerics, not UnityEngine

Declare a networked member as `NetworkMember<System.Numerics.Vector3>`, never `NetworkMember<UnityEngine.Vector3>`. Nucleus applies its vector and rotation handling, such as interpolation and Divine projection, only to the `System.Numerics` types. A UnityEngine member still builds and replicates without any diagnostic, but as a plain struct with none of that handling, and a `UnityEngine.Quaternion` member sends more than it needs to.

Alias the `System.Numerics` type at the top of the file to avoid clashing with `UnityEngine.Vector3`, as the shipped `UnityNavMeshAgentComponent` does:

```csharp
using NumericsVector3 = System.Numerics.Vector3;

public partial class UnityNavMeshAgentComponent : NetworkComponent
{
    public readonly NetworkMember<NumericsVector3> NextPoint = new(CompressionLevel.Aggressive);
    public readonly NetworkMember<NumericsVector3> PreviousPoint = new(CompressionLevel.Aggressive);
}
```

## Convert at the Unity boundary

`UnityConversionExtensions` converts with `ToUnity()` (native to Unity) and `ToNative()` (Unity to native), for `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Plane` and `Matrix4x4`. Convert only where you read a member into a `Transform` or other Unity API, or write one back:

```csharp
public Vector3 ReplicatedNextPoint
{
    get => NextPoint.Value.ToUnity();
    set => NextPoint.Value = value.ToNative();
}
```

Keep the `NetworkComponent` and its `NetworkMember<T0>` fields native, and the `MonoBehaviour`, `Transform` and other Unity APIs in Unity types.

## These types need no attribute

These already have serializers and work in a `NetworkMember<T>` with no attribute of your own:

- The `System.Numerics` vectors `Vector2`, `Vector3` and `Vector4`
- The CodeBoost types `Vector2Int`, `Vector3Int32`, `Vector4Int` and `UnifiedColor`
- Any struct you declare made entirely of serializable fields, as long as a `NetworkMember<T>` reaches it

A member type with no serializer is reported at build time as `SERIALIZERS000` or `SERIALIZERS001` (see [Generator Errors and Warnings](./generator-diagnostics.md)). For a third-party type you cannot put `[NetworkType]` on, see [Reaching Types You Cannot Annotate](../../core-api/wire/external-network-types.md).
