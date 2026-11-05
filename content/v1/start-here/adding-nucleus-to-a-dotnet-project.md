---
title: "Add Nucleus to a .NET project"
---

> **Using Unity?** See [Install Nucleus in Unity](./installing-the-unity-integration.md).

Nucleus ships as DLLs rather than a NuGet package. It targets `netstandard2.1`, so any .NET 5 or later project can use it.

## Reference the DLLs

1. Copy these four DLLs from one release into a folder in your solution, such as `lib/Nucleus`: `Nucleus.dll`, `CodeBoost.dll`, `SynapseSocket.dll` and `Nucleus.CodeAnalysis.SourceGenerators.dll`.
2. Add this to your `.csproj`:

```xml
<ItemGroup>
    <Reference Include="Nucleus"><HintPath>..\lib\Nucleus\Nucleus.dll</HintPath></Reference>
    <Reference Include="CodeBoost"><HintPath>..\lib\Nucleus\CodeBoost.dll</HintPath></Reference>
    <Reference Include="SynapseSocket"><HintPath>..\lib\Nucleus\SynapseSocket.dll</HintPath></Reference>
    <Analyzer Include="..\lib\Nucleus\Nucleus.CodeAnalysis.SourceGenerators.dll" />
</ItemGroup>
```

The `Analyzer` line runs the Nucleus code generator over your project. Without it your project still compiles, but nothing replicates and no error appears. Add it to every project that declares networked types.

When you update, replace all four DLLs together. DLLs from different releases fail at runtime.

## Give a second assembly its own bundle id

If networked types live in more than one of your assemblies, give each extra assembly its own id, in any one file:

```csharp
[assembly: NetworkBundle(1)]
```

Your main assembly needs nothing, because it uses id 0.
