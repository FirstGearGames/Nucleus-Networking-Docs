---
title: "Wiring the Source Generator into a .NET Project"
---

> **Using Unity?** See [Code Generation in Unity](../../unity/wire/code-generation-in-unity.md).

## Reference the analyzer

Your project needs one analyzer reference: `Nucleus.CodeAnalysis.SourceGenerators.dll`, added as an `Analyzer` item rather than a `Reference`. Take it from the same release as the engine DLLs; the path is wherever you copied that set:

```xml
<ItemGroup>
    <Analyzer Include="..\lib\Nucleus\Nucleus.CodeAnalysis.SourceGenerators.dll" />
</ItemGroup>
```

Without this reference the project still compiles, but nothing runs the generator over your types, and nothing replicates. There's no build error to point at it — the failure is silent.

## Keep generated output visible and current

Add this alongside the analyzer reference:

```xml
<PropertyGroup>
    <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
</PropertyGroup>
```

`EmitCompilerGeneratedFiles` also writes the generator's output to disk instead of keeping it purely in memory, so you can inspect what it produced. With nothing else set, it lands under `obj/<Configuration>/<TargetFramework>/generated/Nucleus.CodeAnalysis.SourceGenerators/`. The generator already adds this code to the compilation itself, and the `obj` folder is outside your project's own `Compile` items, so nothing gets compiled twice and there is nothing to exclude.

The compiler never deletes old files from that folder, and `dotnet clean` doesn't either, so a file from a previous build can masquerade as this build's output. To see what the current build really produced, delete the `generated` folder and rebuild with `dotnet build --no-incremental`; a plain incremental build that finds nothing changed skips the compiler and leaves the folder empty.

## Reference the engine

There's no NuGet package for Nucleus. Reference the built DLL set, `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`, as ordinary `Reference` items; [Adding Nucleus to a .NET project](../../start-here/adding-nucleus-to-a-dotnet-project.md) shows the project file.

Mixing DLLs from different builds isn't supported; take all four, the generator included, from one release.

## Target framework

`Nucleus.dll` targets `netstandard2.1`, and the generated code works on frameworks older than .NET 5 with nothing extra to reference. It does need C# 9, though, so a project whose default language version is older (`netstandard2.1` and .NET Core 3.x projects default to C# 8) needs `<LangVersion>9.0</LangVersion>` or newer.

## Give your assembly a bundle id

If your project isn't the main assembly, declare a bundle id so its types don't collide with the default:

```csharp
[assembly: NetworkBundle(1)]
```

See [Type Identity on the Wire: Bundles and the Registry](./type-identity-and-bundles.md) for how bundle and local ids combine into a type's identity, and which ids are already taken.

## The generator skips assemblies that don't reference Nucleus

The generator only runs over an assembly that references Nucleus. A project with the analyzer reference wired in but no reference to Nucleus itself is silently skipped — the same gate applies on the Unity side.
