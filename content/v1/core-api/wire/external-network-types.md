---
title: "Reaching Types You Cannot Annotate"
---

## Use a marker struct for types in other assemblies

The generator only serializes a type that carries `[NetworkType]` or that it reaches through a member it already serializes. A type from an assembly you do not control, such as `System.Numerics.Vector2` or a third-party math type, cannot carry the attribute.

Declare a struct in your own assembly, mark it `[NetworkType]`, and give it one field per external type you need. Only the field types matter; the struct is never used at runtime.

```csharp
[NetworkType]
public struct ExternalNetworkTypes
{
    public Vector4 Vector4;
    public Vector3 Vector3;
    public Vector2 Vector2;

    public Vector4Int Vector4Int;
    public Vector3Int32 Vector3Int32;
    public Vector2Int Vector2Int;

    public UnifiedColor UnifiedColor;
}
```

Without `[NetworkType]` the struct is ignored with no error. A field whose type is reachable some other way still gets a serializer, which can hide the mistake.

## Nucleus already covers seven types

Nucleus ships the struct above as `ExternalNetworkTypes` in `Nucleus.Serializers`. It covers `Vector4`, `Vector3` and `Vector2` from `System.Numerics`, plus CodeBoost's `Vector4Int`, `Vector3Int32`, `Vector2Int` and `UnifiedColor`. You need your own marker only for other types.

## SERIALIZERS001 usually means a missing marker

When a member's type has no serializer, the generator reports `SERIALIZERS001` naming the member; see [Generator Errors and Warnings](./generator-diagnostics.md). For a plain data type from an assembly you do not control, add it to a marker struct. Write a [custom serializer](./custom-serializers.md) only when the type needs custom read and write logic.
