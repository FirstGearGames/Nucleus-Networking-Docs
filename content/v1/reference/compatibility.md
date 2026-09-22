---
title: "Compatibility"
---

## Runtime

Nucleus's core targets `netstandard2.1`, with nullable reference types enabled and unsafe blocks allowed. Anything that implements netstandard2.1 runs it: .NET Core 3.0 and later, .NET 5 through 9, Mono, and Unity. The core has no engine dependency, so this is one axis independent of the Unity integration below.

## Unity integration

The Unity integration compiles under `UNITY_EDITOR || UNITY_2021_3_OR_NEWER`. Older Unity versions, outside the editor, don't compile it.

Integration and demo source is pinned to `LangVersion 9`, matching what Unity's compiler accepts. This constrains the source shipped in the package, not the compiled DLLs it references — the core engine DLL is built separately and isn't subject to this pin.

## Optional dependencies

A few integration paths are gated behind package presence, and only compile in when the define is set:

| Dependency | Define | Gates |
|---|---|---|
| `com.unity.addressables` 1.19+ | `NUCLEUS_ADDRESSABLES` | Addressables-based asset loading |
| `Unity.ResourceManager` | — | Referenced alongside Addressables |
| Relay transport | `BLITZ_RELAY` | The Blitz Relay transport |

Without these packages installed, the corresponding code simply isn't compiled in — no stub, no runtime check.

## Toolchain for building from source

The source generators (`Nucleus.CodeAnalysis.SourceGenerators`) target `netstandard2.0` and are consumed as Roslyn analyzers, not as a runtime dependency. Any toolchain building Nucleus from source needs an SDK that can host netstandard2.0 analyzers alongside the netstandard2.1 core.

## Not supported

These are closed, not pending:

- No WebSocket or WebGL transport, and so no browser target.
- No Steam, EOS, or console transport ships.

A "does platform X work" question is almost always a transport question, not a Nucleus core question — the core is platform-agnostic; what reaches a given platform is whichever transport you plug in.
