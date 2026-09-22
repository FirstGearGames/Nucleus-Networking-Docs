---
title: "Wiring the Source Generator into a .NET Project"
---

> **Using Unity?** See [Code Generation in Unity](../../unity/wire/code-generation-in-unity).

## Reference the analyzer

Your project needs one analyzer reference: `Nucleus.CodeAnalysis.SourceGenerators.csproj`, added with `OutputItemType="Analyzer"` and `ReferenceOutputAssembly="false"`. This is the same reference `Nucleus.Game/Nucleus.Game.csproj` carries — copy it exactly:

```xml
<ItemGroup>
    <ProjectReference Include="..\Nucleus.CodeAnalysis.SourceGenerators\Nucleus.CodeAnalysis.SourceGenerators.csproj"
                      OutputItemType="Analyzer"
                      ReferenceOutputAssembly="false" />
</ItemGroup>
```

`Nucleus.csproj` itself carries two other analyzer references, `Nucleus.CodeAnalysis.SourceGenerators.Signatures` and `CodeBoost.CodeAnalysis.Analyzers`. Those build the engine's own source, not a consuming project's, and you don't add them here.

Without this reference the project still compiles, but nothing runs the generator over your types: no `Write`/`Read` methods, no module-initializer registration, and nothing replicates. There's no build error to point at it — the failure is silent.

## Keep generated output visible and current

Add these alongside the analyzer reference, copied from the same project:

```xml
<PropertyGroup>
    <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
</PropertyGroup>

<Target Name="CleanSourceGeneratedFiles" BeforeTargets="BeforeBuild" DependsOnTargets="$(BeforeBuildDependsOn)">
    <RemoveDir Directories="Generated" />
</Target>

<ItemGroup>
    <Compile Remove="Generated\**" />
    <Content Include="Generated\**" />
</ItemGroup>
```

`EmitCompilerGeneratedFiles` writes the generator's output to a `Generated/` folder on disk instead of keeping it purely in-memory, so you can inspect what it produced. The `CleanSourceGeneratedFiles` target deletes that folder before every build, so a stale file from a previous run can never masquerade as this build's output.

The `Compile Remove` / `Content Include` pair keeps `Generated/**` out of the compilation twice, deliberately: the generator already adds these files to the compilation itself, and MSBuild would otherwise also pick them up as ordinary `Compile` items from disk, compiling each one twice.

## Reference the engine

There's no NuGet package for Nucleus. Reference it one of two ways:

- A `ProjectReference` to `Nucleus/Nucleus.csproj`.
- The built DLL set: `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`, all from the same build. A Release build lands them at `.artifacts/Nucleus/bin/Release/netstandard2.1/` — `Nucleus/Directory.Build.props` redirects the project's `bin`/`obj` there instead of under `Nucleus/bin`.

Mixing DLLs from different builds isn't supported; take all three from one output.

## Target framework

`Nucleus.csproj` targets `netstandard2.1`. The generated registrar uses `[ModuleInitializer]`, which the C# compiler recognizes by full name from any assembly rather than requiring a specific target framework. When your compilation doesn't already have a usable `System.Runtime.CompilerServices.ModuleInitializerAttribute` — true on frameworks older than .NET 5 — the generator emits its own internal copy of that attribute into your assembly so the registrar compiles. This happens automatically per assembly; there's nothing in your project to reference for it.

## Give your assembly a bundle id

If your project isn't the main assembly, declare a bundle id so its types don't collide with the default:

```csharp
[assembly: NetworkBundle(1)]
```

See [Type Identity on the Wire: Bundles and the Registry](./type-identity-and-bundles) for how bundle and local ids combine into a type's wire identity, and which ids are already taken.

## The generator skips assemblies that don't reference Nucleus

The generator only runs over an assembly that references Nucleus. A project with the analyzer reference wired in but no reference to Nucleus itself is silently skipped — the same gate applies on the Unity side.
