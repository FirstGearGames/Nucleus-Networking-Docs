---
title: "Generator Errors and Warnings"
---

The source generator reports in the Unity console alongside ordinary compile errors, or in a plain .NET project's build output. Each diagnostic has an id of the form `FAMILY###` and a message. The id tells you which stage raised it; the message tells you what to fix, so search for the message text you see.

## Each id family is one stage

| Id | Severity | Stage |
|---|---|---|
| `NETWORKTYPEFINDER00` | Warning | Type discovery |
| `NETWORKTYPEFINDER01` | Error | Type discovery |
| `GENERATION000` | Error | Generation: invalid type |
| `GENERATION001` | Error | Generation: invalid Roslyn type |
| `GENERATION002` | Error | Generation: comparer or operation stage |
| `GENERATION003` | Warning | Generation: comparer or operation stage (declared, not currently raised) |
| `GENERATION004` | Warning | Generation: two networked messages or calls hash to the same wire id |
| `SERIALIZERS000` | Error | Serializer generation |
| `SERIALIZERS001` | Warning | Serializer generation |

`NETWORKTYPEFINDER*` fires first, while the generator decides which types and members are networked. `GENERATION*` and `SERIALIZERS*` fire afterward, while it generates code for them.

`GENERATION004` does not stop the rest of the assembly from generating. While two types collide, the engine sends neither, registers neither and hands neither to a handler. Rename one of them.

## The commonest cause is a member with no serializer

`SERIALIZERS001` is by far the most common, with a message like:

> `[Type.Member] Type [SomeType] for [Write/Read] SerializeMethod could not be found; this value will not be networked.`

The generator found no serializer for that member's type. Fix it one of two ways:

- **Marker struct.** If the type lives in an assembly you do not control (a `System.Numerics` type, a third-party math type), add it as a field on a marker struct carrying `[NetworkType]`. See [Reaching Types You Cannot Annotate](../../core-api/wire/external-network-types.md).
- **Hand-written serializer.** If the type needs custom read and write logic. See [Writing a Custom Serializer](../../core-api/wire/custom-serializers.md).

A `UnityEngine` type such as `Vector3` or `Quaternion` does not raise this warning, because it builds as a plain struct. Declare the `System.Numerics` equivalent anyway; see [Unity Types and System.Numerics](./unity-and-system-numerics-types.md).

`SERIALIZERS000` is the error-level version: a required serializer is missing or malformed so badly the generator cannot continue, for example `A [Write/Read] serializer could not be found for [Type].` or a type over the maximum networked member count. Fix it the same way.

## The next most common is a badly declared type

`NETWORKTYPEFINDER01` covers structural problems in how a networked type is declared, such as unsupported type arguments or a member type discovery does not recognize.

A networked component or system that is not `partial`, or is nested in a way the generator cannot reach, fails with an ordinary C# compiler error about a generated file instead of a Nucleus id. Check that the type and every type containing it is `partial`, and check its nesting.

## Read the top diagnostic, not the longest list

An early error stops later stages for that type, so one `NETWORKTYPEFINDER01` error often brings a long tail of `SERIALIZERS001` warnings. Fix the first diagnostic for a type and rebuild before working through the rest.

## A generator diagnostic is a compile-time problem, never a runtime one

If the build is clean but replicated values are wrong, systems never converge, or packets look malformed at runtime, the problem is not in the generator. See [Diagnosing desync](../diagnostics/diagnosing-desync.md).
