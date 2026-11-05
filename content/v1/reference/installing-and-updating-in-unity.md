---
title: "Installing and updating Nucleus in Unity"
---

> **Driving the core API directly?** See [Adding Nucleus to a .NET project](../start-here/adding-nucleus-to-a-dotnet-project.md).

## Install the package

Import the release's `.unitypackage` (**Assets > Import Package > Custom Package**), or copy its whole `Assets/Nucleus` folder into your project. These are the only supported methods: there is no UPM package, Asset Store listing or git-URL install.

The folder holds:

- `Nucleus.dll`, `CodeBoost.dll` and `SynapseSocket.dll`, each with a `.pdb` for debuggable stack traces.
- `Nucleus.CodeAnalysis.SourceGenerators.dll`, the source generator that makes networked types compile. It has no `.pdb`.
- `Nucleus.xml` and `SynapseSocket.xml`, which give your IDE hover docs for the public API.
- `LICENSE.txt`, and `VERSION.txt`, which names the release.
- An `Integrations` folder with four source trees, each its own assembly definition: `Unity`, `Blitz Relay`, `Newfarm Client` and `Newfarm Migration`.

The integration needs **Unity 6.5 (6000.5) or newer** and does not compile on older editors. An update never lowers that requirement.

## Update without touching the .meta files

1. Leave Play mode. Replacing files during play reloads scripts and resets play mode.
2. Replace all four DLLs together with their `.pdb` and `.xml` files, plus `LICENSE.txt`, `VERSION.txt` and the `Integrations` source trees.
3. Keep every existing `.meta` file in the project.

**Never replace the `.meta` files.** `Nucleus.CodeAnalysis.SourceGenerators.dll.meta` carries the label that makes Unity run the generator:

```yaml
labels:
- RoslynAnalyzer
```

If that `.meta` is overwritten or regenerated without the label, the project still compiles with no error, but nothing replicates. If replication silently stops after an update, open that `.meta` and confirm `RoslynAnalyzer` is listed under `labels`. The other `.meta` files keep asset GUIDs stable.

**Take all four DLLs from one build.** A mismatched set, such as a new `Nucleus.dll` beside an old `CodeBoost.dll`, still compiles but throws `MissingMethodException` when the mismatched call runs.

## Optional pieces switch on with scripting defines

- `NUCLEUS_ADDRESSABLES` is set automatically when `com.unity.addressables` 1.19 or newer is installed.
- `NUCLEUS_NAVMESH` is set automatically while Unity's AI module, `com.unity.modules.ai`, is enabled, as it is in a new project. Without it, `NetworkNavMeshAgent` is left out and the rest still compiles.
- `BLITZ_RELAY` must be set in your project to compile the Blitz Relay transport.

The main integration assembly is `Nucleus.Integrations.Unity.asmdef`, with its editor code in `Nucleus.Integrations.Unity.Editor.asmdef`. Every integration file is wrapped in:

```csharp
#if UNITY_EDITOR || UNITY_6000_5_OR_NEWER
#define UNITY_ENGINE
#endif
```

so the same sources can sit in a non-Unity project without pulling in `UnityEngine`.

## Identifying what you're running

`Assets/Nucleus/VERSION.txt` names the installed release. To check a built player, see [Versioning, upgrading and release notes](./versioning-and-upgrading.md).
