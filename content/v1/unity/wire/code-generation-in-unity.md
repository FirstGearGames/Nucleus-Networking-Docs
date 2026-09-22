---
title: "Code Generation in Unity"
---

> **Driving the core API directly?** See [Wiring the Source Generator into a .NET Project](../../core-api/wire/source-generator-setup).

## What has to be in Assets/Nucleus

Generation happens inside the Unity compiler, driven by a Roslyn source generator that ships as a DLL. For it to run, `Assets/Nucleus` needs four files side by side:

- `Nucleus.dll` - the engine
- `CodeBoost.dll` - pooling and collection support the engine depends on
- `SynapseSocket.dll` - the transport
- `Nucleus.CodeAnalysis.SourceGenerators.dll` - the generator itself

Unity only treats a DLL as a source generator when its `.meta` file carries the `RoslynAnalyzer` label:

```yaml
labels:
- RoslynAnalyzer
```

That label, and the asset GUID Unity uses to track the file, live in the `.meta`, not the DLL. When you update the generator, replace `Nucleus.CodeAnalysis.SourceGenerators.dll` and leave its `.meta` alone. Replacing the `.meta` too (or deleting and re-adding the DLL) drops the label, and Unity silently goes back to compiling without it - no error, just a generator that never runs.

## Which assembly your component needs to be in

The generator inspects each assembly Unity compiles and skips any assembly that doesn't reference `Nucleus.dll` - it has nothing to generate there. Whether that reference exists depends on where your `NetworkComponent` lives:

- **Scripts with no asmdef** compile into `Assembly-CSharp`, which references `Nucleus.dll` automatically. `Nucleus.Integrations.Unity.asmdef` is marked `autoReferenced: true`, so any assembly Unity auto-references picks it up without you adding anything.
- **Scripts under your own `.asmdef`** need an explicit reference to `Nucleus.Integrations.Unity` (or another assembly that itself references `Nucleus.dll`) added to that asmdef's `references` array.

`Nucleus.asmdef`, the core engine's own assembly definition, sets `noEngineReferences: true`: the engine assembly does not automatically reference `UnityEngine`/`UnityEditor`, keeping it free of a direct engine dependency. In the shipped Unity workflow the engine reaches your project as the precompiled `Nucleus.dll` in `Assets/Nucleus`, not as this asmdef's source.

## The C# 9 ceiling

Unity's generated project pins `LangVersion` to 9. Anything Unity compiles - your components, the integration source, generated partials - is limited to C# 9 syntax: namespaces need braces (no `namespace Foo;`), and there's no collection-expression syntax (`[1, 2, 3]`). This ceiling applies only to source Unity compiles. It doesn't touch the prebuilt DLLs in `Assets/Nucleus`, which are built against a newer language version outside Unity.

## Symptom: a component that compiles but replicates nothing

If the generator didn't run against your assembly, a `partial` `NetworkComponent` still compiles - the class is valid C#, it just has no generated half. Both the serializer (the Write/Read pair) and the `[ModuleInitializer]` registration that wires the type into the network system are missing. Nothing throws. The component sits in the scene, does nothing on the wire, and the only sign is silence: no errors, no replicated state, no console warning pointing at the cause.

Check first: is the DLL's `.meta` still carrying `RoslynAnalyzer`, and does the component's assembly reference `Nucleus.dll`?

## Where generator errors surface

Generator diagnostics appear in the Unity console, using the same diagnostic ids the .NET build reports for the same problems. See the diagnostics reference for what each id means.

## See also

For what the generator emits, and for wiring it into a plain .NET project outside Unity, see [Wiring the Source Generator into a .NET Project](../../core-api/wire/source-generator-setup).
