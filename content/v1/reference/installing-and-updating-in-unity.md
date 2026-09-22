---
title: "Installing and updating Nucleus in Unity"
---

> **Driving the core API directly?** See [Adding Nucleus to a .NET project](../start-here/adding-nucleus-to-a-dotnet-project).

## What's in the package

Nucleus for Unity ships as prebuilt DLLs plus source for its integration layer. The distributed build unpacks into an `Assets/Nucleus` folder:

- `Nucleus.dll`, `CodeBoost.dll`, `SynapseSocket.dll` — each with a `.pdb` alongside it for debuggable stack traces.
- `Nucleus.CodeAnalysis.SourceGenerators.dll` — the Roslyn source generator that makes networked types compile. No `.pdb` ships for it.
- `LICENSE.txt`.
- An `Integrations` folder holding four source trees, each its own assembly definition: `Unity`, `Blitz Relay`, `Newfarm Client`, `Newfarm Migration`.

Copy the whole `Assets/Nucleus` folder into your project. That's the only supported install method — there is no `.unitypackage`, no UPM package, no Asset Store listing, and no git-URL install.

## The one rule that decides whether it works

Replace the files. Never replace the `.meta` files.

A project that already has this folder has its own Unity-generated `.meta` for every path in it, and those `.meta`s carry state Unity needs: asset GUIDs, and — for the source generator — the label that makes it run at all. `Nucleus.CodeAnalysis.SourceGenerators.dll.meta` carries:

```yaml
labels:
- RoslynAnalyzer
```

That label is what tells Unity to run the DLL as a Roslyn source generator instead of referencing it as a normal plugin. Overwrite that `.meta` with the one from the new build — or delete it and let Unity regenerate a plain one — and the generator stops running. Nothing shows an error for this. The project compiles, the components look fine, and nothing replicates, because the generated networking code was never produced. If replication silently stops after an update, check this first: open `Nucleus.CodeAnalysis.SourceGenerators.dll.meta` and confirm `RoslynAnalyzer` is still listed under `labels`.

## All four DLLs come from one build

`Nucleus.dll`, `CodeBoost.dll`, `SynapseSocket.dll`, and `Nucleus.CodeAnalysis.SourceGenerators.dll` must all be from the same build output. Mixing them — a fresh `Nucleus.dll` next to a stale `CodeBoost.dll`, for example — does not fail to compile. The two DLLs disagree about what's inside each other at runtime, and that surfaces as a `MissingMethodException` when the mismatched call actually runs, not as a build error. When updating, replace all four together.

## Unity floor and assembly layout

The integration is gated behind:

```csharp
#if UNITY_EDITOR || UNITY_2021_3_OR_NEWER
#define UNITY_ENGINE
#endif
```

Unity 2021.3 is the effective minimum for a build target — older versions never define `UNITY_ENGINE`, so the integration code doesn't compile in.

`Nucleus.Integrations.Unity.asmdef` is the main integration assembly. It sits beside two sibling assemblies for the same code: `Nucleus.Integrations.Unity.Editor.asmdef` under `Editor/`, and `Nucleus.Integrations.Unity.Tests.asmdef` under `Tests/`.

Two scripting defines control optional pieces:

- `NUCLEUS_ADDRESSABLES` — a `versionDefines` entry keyed to `com.unity.addressables` version `1.19` and up. Set automatically once that package is present at a matching version; nothing to do by hand.
- `BLITZ_RELAY` — a `defineConstraints` gate on the Blitz Relay assembly itself. The relay transport only compiles when this define is set in your project; the main Unity integration assembly references it unconditionally but the relay code stays out until you opt in.

## Updating

Replace the four DLLs and their `.pdb`s, `LICENSE.txt`, and the `Integrations` source trees with the new build's copies. Leave every `.meta` file in the project untouched — they're already there from your first install, and they're what keeps the source generator running and the asset GUIDs stable.

If the editor is in Play mode when you replace the files, Unity reimports and triggers a domain reload mid-play. Expect play mode to reset; don't replace files while relying on play-mode state you haven't saved.

## Identifying what you're running

Nothing in the package is stamped with a version today — no version number in the DLLs, no marker file to check against. See [Versioning, upgrading and release notes](../reference/versioning-and-upgrading) for what's tracked there instead.

## Not using Unity?

For a dedicated server or any other non-Unity host, see [Adding Nucleus to a .NET project](../start-here/adding-nucleus-to-a-dotnet-project).
