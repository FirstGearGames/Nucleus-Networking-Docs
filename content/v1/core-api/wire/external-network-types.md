---
title: "Reaching Types You Cannot Annotate"
---

## The problem

The generator only emits a serializer for a type when it can find `[NetworkType]` on that type, or reach the type through a member it is already generating a serializer for. A type declared in an assembly you do not control, such as `System.Numerics.Vector2` or a type from a third-party math library, can never carry that attribute. Without another way in, it has no serializer.

## The marker struct

The way in is a struct in your own assembly, carrying `[NetworkType]`, whose fields are the external types you need. Nothing about the struct's fields matters except their types:

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

Every field is a marker, not a value. Nothing reads this struct at runtime and no instance of it is ever made. The generator walks the fields of a type carrying `[NetworkType]` and emits a serializer for each field's type, which is the only way to reach a type declared in an assembly nobody here can annotate.

## The shipped marker

Nucleus ships one of these as `ExternalNetworkTypes` in `Nucleus.Serializers`. It covers `Vector4`, `Vector3`, and `Vector2` from `System.Numerics`, plus CodeBoost's `Vector4Int`, `Vector3Int32`, `Vector2Int`, and `UnifiedColor`. If your project only needs these seven types, you don't need a marker of your own.

## Writing your own

For third-party types outside that list, declare your own marker struct in your own assembly and add one field per type you need a serializer for. The `[NetworkType]` attribute is not optional decoration: it is the only thing the generator reads to find the struct at all.

This was a real, recorded bug. `ExternalNetworkTypes` once carried a separate container attribute the generator never read, so every marker field in it was inert: the file read as the supported way to reach these types and did nothing at all. A type that also happened to be reached through a real networked member got its serializer anyway and hid the fault. That's what happened to `Vector3`: it got a working serializer only because `TransformComponent` already networks a `NetworkMember<Vector3>` for position and scale. `Vector2`, declared one line below `Vector3` in the same struct, had no other path in and silently had no serializer at all.

The lesson carries over directly: a marker struct that isn't actually carrying `[NetworkType]` fails silently, not loudly, unless one of its fields happens to be reachable some other way.

## Finding out a type has no serializer

When a member's type has no serializer, the generator reports a `SERIALIZERS001` warning naming the member, once, instead of silently dropping it. See [Generator Errors and Warnings](./generator-diagnostics.md) for how to read generator diagnostics.

Seeing that warning for a type from an assembly you don't control is almost always a sign you need a marker struct, not a hand-written serializer: the type is a plain data type and the generator can serialize it field-by-field once it can see it. Reach for a hand-written serializer instead only when the type's shape genuinely needs custom read/write logic, not just visibility. See [Writing a Custom Serializer](./custom-serializers.md) for that case.
