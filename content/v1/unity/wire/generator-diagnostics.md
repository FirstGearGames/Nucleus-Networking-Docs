---
title: "Generator Errors and Warnings"
---

## Where they show up

The source generator runs as part of the normal C# compile. In a plain .NET project it reports through the ordinary build output or your IDE's error list, same as any other compiler diagnostic. In Unity, the generator DLL is imported with the `RoslynAnalyzer` label so Unity runs it as part of scripting compilation; its diagnostics land in the Unity console alongside regular compile errors.

Every diagnostic carries an id in the form `FAMILY###`, a severity (error or warning), and a message built from a plain format string rather than a fixed sentence per id. Reading the id tells you which stage raised it; reading the message tells you what to fix. Look up the page by the message text you actually see, not by the id alone.

## The id families

| Id | Severity | Stage |
|---|---|---|
| `NETWORKTYPEFINDER00` | Warning | Type discovery (`NetworkTypeFinder` walking your networked types and members) |
| `NETWORKTYPEFINDER01` | Error | Type discovery |
| `GENERATION000` | Error | Generation - invalid type |
| `GENERATION001` | Error | Generation - invalid Roslyn type |
| `GENERATION002` | Error | Generation - comparer/operation stage |
| `GENERATION003` | Warning | Generation - comparer/operation stage (declared, not currently raised) |
| `GENERATION004` | Warning | Generation - wire hash collision between two networked messages or calls |
| `SERIALIZERS000` | Error | Serializer generation |
| `SERIALIZERS001` | Warning | Serializer generation |

`NETWORKTYPEFINDER*` fires first, while the generator is still deciding which types and members are networked at all. `GENERATION*` and `SERIALIZERS*` fire afterward, while it builds comparers, readers, and writers for what discovery found. `GENERATION004` is the exception: it is a late, non-fatal check that two networked messages (or two networked calls) hashed to the same wire id. It only reports; it never stops the rest of the assembly from generating, because renaming one of the colliding types is a fix to make, not a reason to withhold everything else the build would otherwise emit. While two types collide, the engine sends neither, registers neither, and hands neither to a handler.

## The commonest cause: a member with no serializer

By far the most common diagnostic is `SERIALIZERS001`, with a message shaped like:

> `[Type.Member] Type [SomeType] for [Write/Read] SerializeMethod could not be found; this value will not be networked.`

This means the generator could not find a serializer for that member's type. It has two fixes:

- **Marker struct** - if the type lives in an assembly you don't control (a `System.Numerics` type, a third-party math type), add it as a field on a marker struct carrying `[NetworkType]` so the generator can reach it. See [Reaching Types You Cannot Annotate](../../core-api/wire/external-network-types.md).
- **Hand-written serializer** - if the type's shape genuinely needs custom read/write logic rather than just visibility. See [Writing a Custom Serializer](../../core-api/wire/custom-serializers.md).

A `UnityEngine` type (`Vector3`, `Quaternion`, and so on) does not raise this warning: the generator reaches the type's public fields and writes a plain serializer for it. Declare the `System.Numerics` equivalent anyway. See [Unity Types and System.Numerics](../state/unity-types-and-system-numerics.md).

`SERIALIZERS000` is the error-level sibling of the same stage: a required serializer is missing or malformed in a way the generator cannot route around at all, for example `A [Write/Read] serializer could not be found for [Type].` or a type exceeding the maximum networked member count. Treat it the same way as `SERIALIZERS001`, just with a build-breaking severity.

## The second commonest: a type the generator can't fill in

`NETWORKTYPEFINDER01` covers a family of structural problems in how a networked type is declared, including type arguments that aren't currently supported and a member type discovery doesn't recognize. The one worth calling out specifically: a networked component or system that is not declared `partial`, or that is nested inside another type in a way the generator cannot reach, fails as an ordinary Roslyn compile error (for example a missing-partial-modifier error) rather than a Nucleus-specific diagnostic, because the generator is trying to emit a partial declaration into a type it does not control. If your networked type is producing raw C# compiler errors about a generated file rather than a `NETWORKTYPEFINDER`/`GENERATION`/`SERIALIZERS` id, check that the type and every type containing it is `partial` and check its nesting.

## Read the top diagnostic, not the longest list

The generator's stages run in order, and an early error aborts the run for that type before later stages get a chance to run. A discovery-stage error on `NETWORKTYPEFINDER01` commonly produces a long tail of `SERIALIZERS001` warnings underneath it, because every member the generator never got to walk correctly also has no serializer. Fixing the first error in the list is usually enough to make the rest disappear on the next build. Scroll to the top of the diagnostics for a type, fix that one, and rebuild before working through the rest.

## What this is not

A generator diagnostic is a compile-time problem: the generator could not produce correct code for your types. It has nothing to do with runtime behavior. If your build is clean but replicated values are wrong, systems never converge, or packets look malformed at runtime, that is a wire or convergence problem, not a generator diagnostic, and belongs on a different page.
