---
title: "Adding Nucleus to a .NET project"
---

> **Using Unity?** See [Installing the Unity integration](./installing-the-unity-integration.md).

## Reference Nucleus

There is no NuGet package for Nucleus — no `PackageId`, no nuspec — so `dotnet add package` is not the route. Consume it one of two ways:

- **Project reference.** Add a `ProjectReference` to `Nucleus/Nucleus.csproj` from your own `.csproj`. This is the simplest path inside the Nucleus repo or a checkout beside it.
- **Built DLLs.** Build Nucleus and reference the output set directly: `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`. A Release build lands them at:

```
.artifacts/Nucleus/bin/Release/netstandard2.1/
```

That path comes from `Nucleus/Directory.Build.props`, which redirects the project's `bin`/`obj` into a shared `.artifacts` directory at the repo root rather than under `Nucleus/bin`.

Nucleus targets `netstandard2.1`, so any .NET Core 3.0+, .NET 5–9, or Mono host can reference it.

## Reference the source generator

This step is not optional, and skipping it fails silently: the project still compiles, but nothing replicates.

Nucleus generates its `Write`/`Read` serializer methods and module-initializer registration at compile time. For the generator to run over *your* project's types, your `.csproj` needs its own analyzer reference to `Nucleus.CodeAnalysis.SourceGenerators.csproj`, with `OutputItemType="Analyzer"` and `ReferenceOutputAssembly="false"` — the same pattern `Nucleus.Game/Nucleus.Game.csproj` uses:

```xml
<ItemGroup>
    <ProjectReference Include="..\Nucleus.CodeAnalysis.SourceGenerators\Nucleus.CodeAnalysis.SourceGenerators.csproj"
                      OutputItemType="Analyzer"
                      ReferenceOutputAssembly="false" />
</ItemGroup>
```

`OutputItemType="Analyzer"` runs the project as a Roslyn analyzer/generator instead of linking its assembly. `ReferenceOutputAssembly="false"` keeps its own output out of your build. Without both, a `NetworkComponent` partial in your project gets no generated `Write`/`Read` and no module-initializer registration — the type just never serializes.

## Keep generated output visible, not stale

Add `EmitCompilerGeneratedFiles` so the generator's output lands on disk where you can inspect it, and clean that folder before every build so a stale `Generated/` directory never hides a generator failure behind old files. Copy this pattern from `Nucleus.Game.csproj`:

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

If a build stops producing new files under `Generated/`, this is what tells you: the folder gets wiped every build, so an empty or unchanged `Generated/` after a rebuild means the generator didn't run.

## Give your assembly a bundle id

The generator numbers each assembly's `NetworkSystem` and `NetworkComponent` types with local identifiers, paired with a bundle identifier so a type's wire identity is the tuple of the two. The main bundle defaults to `0` when `NetworkBundleAttribute` is absent. If your project is a second, separately compiled assembly, it needs its own unique id or it collides with the main bundle:

```csharp
[assembly: NetworkBundle(1)]
```

Declare this once per assembly, in any file.

## `[NetworkType]` and `ExternalNetworkTypes`

The generator reaches any type held in a `NetworkMember<T0>` field automatically — it does not need `[NetworkTypeAttribute]`. That attribute is only for forcing serializer generation on a type the generator otherwise can't reach on its own.

For a type declared in an assembly you can't annotate (you can't add `[NetworkType]` to someone else's struct), add a marker field for it to `Nucleus.Serializers.ExternalNetworkTypes`, the struct Nucleus itself uses for types like `System.Numerics.Vector3` and `Vector2`. Every field on that struct is a marker only — nothing reads it at runtime, and no instance is ever constructed. The generator walks its fields and emits a serializer for each field's type.
