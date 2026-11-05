---
title: "Code Generation in Unity"
---

> **Driving the core API directly?** See [Wiring the Source Generator into a .NET Project](../../core-api/wire/source-generator-setup.md).

## Keep the four DLLs in Assets/Nucleus

`Assets/Nucleus` needs these four files side by side:

- `Nucleus.dll`, the engine
- `CodeBoost.dll`, which the engine depends on
- `SynapseSocket.dll`, the transport
- `Nucleus.CodeAnalysis.SourceGenerators.dll`, the source generator

Unity runs the generator only while its `.meta` file carries the `RoslynAnalyzer` label:

```yaml
labels:
- RoslynAnalyzer
```

When you update the generator, replace the DLL and leave its `.meta` alone. Replacing the `.meta` too, or deleting and re-adding the DLL, drops the label, and Unity silently compiles without the generator.

## Reference Nucleus from your component's assembly

The generator skips any assembly that does not reference `Nucleus.dll`.

- **Scripts with no asmdef** compile into `Assembly-CSharp`, which picks up the reference automatically.
- **Scripts under your own `.asmdef`** need `Nucleus.Integrations.Unity` (or another assembly that references `Nucleus.dll`) in that asmdef's `references` array.

## Write C# 9 in Unity scripts

Unity compiles with `LangVersion` 9, so your components and anything else Unity compiles are limited to C# 9: namespaces need braces (no `namespace Foo;`), and there are no collection expressions (`[1, 2, 3]`).

## If a component replicates nothing, check the generator

If the generator did not run over your assembly, a `partial` `NetworkComponent` still compiles but is never registered and never replicates. There is no error or warning. Check that the generator's `.meta` still carries `RoslynAnalyzer`, and that the component's assembly references `Nucleus.dll`.

Generator errors appear in the Unity console with the same ids the .NET build uses. See [Generator Errors and Warnings](./generator-diagnostics.md).
