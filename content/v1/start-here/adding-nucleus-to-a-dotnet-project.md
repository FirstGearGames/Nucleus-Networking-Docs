---
title: "Adding Nucleus to a .NET project"
---

> **Using Unity?** See [Installing the Unity integration](./installing-the-unity-integration.md).

## Reference Nucleus

There is no NuGet package for Nucleus (no `PackageId`, no nuspec), so `dotnet add package` is not the route. Nucleus ships as prebuilt DLLs: `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`, plus the source generator `Nucleus.CodeAnalysis.SourceGenerators.dll` (the Unity integration's `Assets/Nucleus` folder holds the same set). Copy all four, from one release, into your solution, for example a `lib/Nucleus` folder, and reference the three runtime DLLs from your `.csproj`:

```xml
<ItemGroup>
    <Reference Include="Nucleus"><HintPath>..\lib\Nucleus\Nucleus.dll</HintPath></Reference>
    <Reference Include="CodeBoost"><HintPath>..\lib\Nucleus\CodeBoost.dll</HintPath></Reference>
    <Reference Include="SynapseSocket"><HintPath>..\lib\Nucleus\SynapseSocket.dll</HintPath></Reference>
</ItemGroup>
```

Nucleus targets `netstandard2.1`, so a .NET 5 or later host (or Mono) can reference it as is. A .NET Core 3.x host can too, with two additions: a `PackageReference` to `System.Runtime.CompilerServices.Unsafe` version 5.0.0, which `CodeBoost.dll` depends on at a newer version than .NET Core 3.x ships, and `<LangVersion>9.0</LangVersion>`, because the generated code uses module initializers, a C# 9 feature, and .NET Core 3.x projects default to C# 8.

## Reference the source generator

This step is not optional, and skipping it fails silently: the project still compiles, but nothing replicates.

Nucleus generates its `Write`/`Read` serializer methods and module-initializer registration at compile time. For the generator to run over *your* project's types, your `.csproj` needs its own `Analyzer` item for `Nucleus.CodeAnalysis.SourceGenerators.dll`:

```xml
<ItemGroup>
    <Analyzer Include="..\lib\Nucleus\Nucleus.CodeAnalysis.SourceGenerators.dll" />
</ItemGroup>
```

An `Analyzer` item runs the DLL as a Roslyn source generator over your project instead of linking it as a reference. Without it, a `NetworkComponent` partial in your project gets no generated `Write`/`Read` and no module-initializer registration: the type just never serializes. Add it to every project that declares networked types.

## Check the generated output

Add `EmitCompilerGeneratedFiles` so a copy of the generator's output lands on disk where you can inspect it:

```xml
<PropertyGroup>
    <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
</PropertyGroup>
```

With nothing else set, the files land under `obj/<Configuration>/<TargetFramework>/generated/Nucleus.CodeAnalysis.SourceGenerators/`, one `.g.cs` file per networked type with the type's name in the file name. The generator already adds this code to the compilation itself, and the `obj` folder is outside your project's own `Compile` items, so there is nothing to exclude.

The compiler only adds and overwrites files there. It never deletes old ones, and `dotnet clean` leaves them too, so a file for a type you've since renamed or removed stays behind and can make a broken setup look fine. To check that the generator really runs, delete the `generated` folder and rebuild with `dotnet build --no-incremental`; a plain incremental build that finds nothing changed skips the compiler and leaves the folder empty. No file for your type after that means the generator didn't run over it.

## Give your assembly a bundle id

The generator numbers each assembly's `NetworkSystem` and `NetworkComponent` types with local identifiers, paired with a bundle identifier so a type's wire identity is the tuple of the two. The main bundle defaults to `0` when `NetworkBundleAttribute` is absent. If your project is a second, separately compiled assembly, it needs its own unique id or it collides with the main bundle:

```csharp
[assembly: NetworkBundle(1)]
```

Declare this once per assembly, in any file.

## `[NetworkType]` and `ExternalNetworkTypes`

The generator reaches any type held in a `NetworkMember<T0>` field automatically — it does not need `[NetworkTypeAttribute]`. That attribute is only for forcing serializer generation on a type the generator otherwise can't reach on its own.

For a type declared in an assembly you can't annotate (you can't add `[NetworkType]` to someone else's struct), add a marker field for it to `Nucleus.Serializers.ExternalNetworkTypes`, the struct Nucleus itself uses for types like `System.Numerics.Vector3` and `Vector2`. Every field on that struct is a marker only — nothing reads it at runtime, and no instance is ever constructed. The generator walks its fields and emits a serializer for each field's type.
