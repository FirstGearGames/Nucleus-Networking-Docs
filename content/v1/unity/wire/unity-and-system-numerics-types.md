---
title: "Unity Types and System.Numerics"
---

## Declare members in Unity types

Declare a networked member with the Unity type you already use, such as `NetworkMember<Vector3>`. These Unity types compare, interpolate and project with Divine exactly as their `System.Numerics` and CodeBoost equivalents do, and a `Quaternion` is sent as compactly:

- `Vector2`, `Vector3`, `Vector4`, `Vector2Int`, `Vector3Int` and `Quaternion`
- The Unity.Mathematics types `float2`, `float3`, `float4`, `int2`, `int3`, `int4` and `quaternion`

```csharp
using Nucleus.Components;
using UnityEngine;

public partial class MoverComponent : NetworkComponent
{
    public readonly NetworkMember<Vector3> Position = new(role: PredictionRole.Validate, accuracy: 0.01f);
    public readonly NetworkMember<Quaternion> Rotation = new(role: PredictionRole.Validate);
}
```

## Convert where the engine uses System.Numerics

The shipped Unity components, such as `NetworkTransform` and the validated behaviours, declare their members in Unity types too. Some engine API, such as lag compensation and physics bodies, takes `System.Numerics` types. `UnityConversionExtensions` in `Nucleus.Integrations.Unity.Serializers` converts with `ToUnity()` and `ToNative()`, for `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Plane` and `Matrix4x4`:

```csharp
LagCompensatedShot shot = _coreManager.LagCompensationManager.CaptureShot(ray.origin.ToNative(), ray.direction.ToNative());
```

Alias the `System.Numerics` type at the top of the file when you need it beside the Unity one:

```csharp
using NumericsVector3 = System.Numerics.Vector3;
```

## These types need no attribute

These already have serializers and work in a `NetworkMember<T>` with no attribute of your own:

- The Unity and Unity.Mathematics types listed above
- The `System.Numerics` vectors `Vector2`, `Vector3` and `Vector4`
- The CodeBoost types `Vector2Int`, `Vector3Int32`, `Vector4Int` and `UnifiedColor`
- Any struct you declare made entirely of serializable fields, as long as a `NetworkMember<T>` reaches it

A member type with no serializer is reported at build time as `SERIALIZERS000` or `SERIALIZERS001` (see [Generator Errors and Warnings](./generator-diagnostics.md)). For a third-party type you cannot put `[NetworkType]` on, see [Reaching Types You Cannot Annotate](../../core-api/wire/external-network-types.md).
