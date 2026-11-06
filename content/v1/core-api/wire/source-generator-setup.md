---
title: "Wiring the Source Generator into a .NET Project"
---

> **Using Unity?** See [Code Generation in Unity](../../unity/wire/code-generation-in-unity.md).

## Set up the project

1. Reference the engine DLLs `Nucleus.dll`, `CodeBoost.dll` and `SynapseSocket.dll` as ordinary `Reference` items. There is no NuGet package; [Adding Nucleus to a .NET project](../../start-here/adding-nucleus-to-a-dotnet-project.md) shows the project file.
2. Add the generator as an `Analyzer` item, not a `Reference`:

   ```xml
   <ItemGroup>
       <Analyzer Include="..\lib\Nucleus\Nucleus.CodeAnalysis.SourceGenerators.dll" />
   </ItemGroup>
   ```

3. If the project's default C# version is older than 9, set `<LangVersion>9.0</LangVersion>` or newer. `Nucleus.dll` targets `netstandard2.1`, and `netstandard2.1` and .NET Core 3.x projects default to C# 8. Nothing else is needed on frameworks older than .NET 5.
4. If this project is not the main assembly, give it a bundle id: `[assembly: NetworkBundle(1)]`. See [Type Identity on the Wire: Bundles and the Registry](./type-identity-and-bundles.md).

Take all four DLLs, the generator included, from one release. Mixing builds is not supported.

Without the analyzer reference, or without a reference to Nucleus itself, the project still compiles but the generator does not run and nothing replicates. There is no error.

## See what the generator produced

```xml
<PropertyGroup>
    <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
</PropertyGroup>
```

This also writes the generated code to `obj/<Configuration>/<TargetFramework>/generated/Nucleus.CodeAnalysis.SourceGenerators/`. Nothing is compiled twice, so there is nothing to exclude.

Neither the compiler nor `dotnet clean` deletes old files from that folder. To see only the current build's output, delete the `generated` folder and run `dotnet build --no-incremental`; an incremental build that finds nothing changed leaves the folder empty.
