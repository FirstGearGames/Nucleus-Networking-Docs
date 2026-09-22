---
title: "Installing the Unity integration"
---

> **Driving the core API directly?** See [Adding Nucleus to a .NET project](./adding-nucleus-to-a-dotnet-project).

## What you get

Nucleus for Unity ships as prebuilt DLLs, not source, for the engine itself. Copy the whole `Assets/Nucleus` folder into your project. It contains:

- `Nucleus.dll`, `CodeBoost.dll`, `SynapseSocket.dll` — the engine and its dependencies.
- `Nucleus.CodeAnalysis.SourceGenerators.dll` — the Roslyn source generator that makes networked types compile.
- A `.pdb` next to `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`, for debuggable stack traces. The source generator DLL doesn't ship one.
- `LICENSE.txt`.
- An `Integrations` folder.

`Integrations` holds four sub-folders — `Unity`, `Blitz Relay`, `Newfarm Client`, `Newfarm Migration` — each its own assembly definition. Mostly this is C# source and `.asmdef` files, not DLLs. Blitz Relay is the exception: alongside its own source and `.asmdef`, it also ships one precompiled dependency, `BlitzRelay.Protocol.dll`.

## The one rule that matters: copy files, not `.meta`s

Copy the DLLs and their `LICENSE.txt`/`.pdb` files. Do **not** copy the `.meta` files that ship alongside them into a project that already has its own Unity-generated `.meta`s for those paths, and never hand-edit or drop the `.meta` for `Nucleus.CodeAnalysis.SourceGenerators.dll`.

That file's `.meta` carries:

```yaml
labels:
- RoslynAnalyzer
```

That label is what tells Unity to run the DLL as a Roslyn source generator instead of just referencing it as a normal plugin. Without it, the generator never runs: your project compiles — components, fields, everything looks fine — but nothing actually replicates, because the generated networking code was never produced. This fails silently, with no compile error, so it's worth checking directly: open `Nucleus.CodeAnalysis.SourceGenerators.dll.meta` in your project and confirm `RoslynAnalyzer` is present under `labels`.

## Keep the three engine DLLs matched

`Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll` must all come from the same build. If you update one without the other two — for example, dropping in a fresh `Nucleus.dll` next to an old `CodeBoost.dll` — you won't get a compile error. You'll get a runtime failure, since the DLLs assume they're talking to matching versions of each other. When updating, replace all three together.

## Unity version floor

Every file in the Unity integration opens with the same conditional compilation gate, for example `Managers/Core/UnityCoreManager.cs`:

```csharp
#if UNITY_EDITOR || UNITY_2021_3_OR_NEWER
#define UNITY_ENGINE
#endif
```

The integration only compiles under the editor or Unity 2021.3 and newer. That makes 2021.3 the effective minimum supported version for a build target; anything older won't define `UNITY_ENGINE` and the integration code won't compile in.

## What's in Integrations, and what's gated

The `Unity` folder is the integration itself — managers, components, everything that talks to `UnityEngine`. It has no `defineConstraints`, so it compiles as soon as it's in your project.

`Blitz Relay`, `Newfarm Client`, and `Newfarm Migration` are separate assemblies alongside it. The Blitz Relay assembly is special: its `.asmdef` declares `"defineConstraints": ["BLITZ_RELAY"]`, so that assembly only compiles when the `BLITZ_RELAY` scripting define is set in your project. The Unity integration assembly itself carries no such constraint — it references Blitz Relay unconditionally, but the relay code only builds in when you opt in with that define.
