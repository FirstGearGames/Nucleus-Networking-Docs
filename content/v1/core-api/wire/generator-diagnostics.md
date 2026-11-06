---
title: "Generator Errors and Warnings"
---

## Find diagnostics in your build output or the Unity console

The source generator runs during the normal C# compile. In a .NET project its diagnostics appear in the build output and your IDE's error list. In Unity, the generator DLL carries the `RoslynAnalyzer` label so Unity runs it, and its diagnostics appear in the Console with other compile errors.

Each diagnostic has an id, a severity and a message. The id tells you the stage; the message tells you what to fix.

| Id | Severity | Stage |
|---|---|---|
| `NETWORKTYPEFINDER00` | Warning | Type discovery (walking your networked types and members) |
| `NETWORKTYPEFINDER01` | Error | Type discovery |
| `GENERATION000` | Error | Generation, invalid type |
| `GENERATION001` | Error | Generation, invalid Roslyn type |
| `GENERATION002` | Error | Generation, comparer or operation stage |
| `GENERATION003` | Warning | Generation, comparer or operation stage (declared, not currently raised) |
| `GENERATION004` | Warning | Two networked messages or two networked calls have the same hash |
| `SERIALIZERS000` | Error | Serializer generation |
| `SERIALIZERS001` | Warning | Serializer generation |

`GENERATION004` does not stop the rest of the build. While the two types collide, the engine refuses to send, register or deliver either one. Rename one of them; see [Messages and Calls That Do Not Arrive](../messaging/messaging-troubleshooting.md).

## Fix the first diagnostic first

An early error stops later stages for that type, so one `NETWORKTYPEFINDER01` error often brings a long list of `SERIALIZERS001` warnings with it. Fix the top diagnostic for a type and rebuild before working through the rest.

## SERIALIZERS001: a member has no serializer

This is the most common diagnostic. Its message looks like:

> `[Type.Member] Type [SomeType] for [Write/Read] SerializeMethod could not be found; this value will not be networked.`

Fix it one of two ways:

- If the type is in an assembly you do not control, add it to a marker struct. See [Reaching Types You Cannot Annotate](./external-network-types.md).
- If the type needs custom read and write logic, write a serializer. See [Writing a Custom Serializer](./custom-serializers.md).

`UnityEngine` types such as `Vector3` and `Quaternion` do not raise this warning, but declare the `System.Numerics` equivalent anyway. See [Unity Types and System.Numerics](../../unity/wire/unity-and-system-numerics-types.md).

`SERIALIZERS000` is the error form: a required serializer is missing or malformed, for example `A [Write/Read] serializer could not be found for [Type].`, or a type exceeds the maximum networked member count. Fix it the same way.

## NETWORKTYPEFINDER01: the type is declared in a way the generator cannot use

This covers unsupported type arguments and member types discovery does not recognize.

If instead you see ordinary C# compiler errors about a generated file, such as a missing `partial` modifier, check that your networked component or system, and every type that contains it, is declared `partial`, and check how it is nested.

## Runtime problems are not generator problems

A generator diagnostic only means the generator could not produce code for your types. If the build is clean but replicated values are wrong at runtime, the cause is not the generator.
