---
title: "Compatibility"
---

## Nucleus runs anywhere netstandard2.1 runs

Nucleus's core targets `netstandard2.1`, with nullable reference types enabled and unsafe blocks allowed. Anything that implements netstandard2.1 runs it: .NET 5 and later, Mono, and Unity, plus .NET Core 3.x with two additions to the consuming project, a `PackageReference` to `System.Runtime.CompilerServices.Unsafe` 5.0.0 (which `CodeBoost.dll` depends on) and `<LangVersion>9.0</LangVersion>` (the generated code uses module initializers). The core has no engine dependency, so this is one axis independent of the Unity integration below.

## Unity integration

The Unity integration supports **Unity 6.5 (6000.5) and newer**. It uses Unity APIs that older editors lack, so it does not compile on them. Its files are also wrapped in `#if UNITY_EDITOR || UNITY_2021_3_OR_NEWER`, but that gate only tells a Unity build apart from a plain .NET one; it is not the version floor.

Integration and demo source is pinned to `LangVersion 9`, matching what Unity's compiler accepts. This constrains the source shipped in the package, not the compiled DLLs it references — the core engine DLL is built separately and isn't subject to this pin.

## Optional dependencies

A few integration paths are gated behind package presence, and only compile in when the define is set:

| Dependency | Define | Gates |
|---|---|---|
| `com.unity.addressables` 1.19+ | `NUCLEUS_ADDRESSABLES` | Addressables-based asset loading |
| `com.unity.modules.ai`, the AI module, enabled in a new project | `NUCLEUS_NAVMESH` | `NetworkNavMeshAgent` and its inspector |
| `Unity.ResourceManager` | — | Referenced alongside Addressables |
| Relay transport | `BLITZ_RELAY` | The Blitz Relay transport (Pro only) |

Without these packages installed, the corresponding code simply isn't compiled in — no stub, no runtime check.

The demos have requirements of their own: the Input System, uGUI 2.0 or newer (for TextMeshPro), AI Navigation and Multiplayer Play Mode packages, and the Vehicles and Terrain modules. Every demo assembly is gated on them, so a project without one of them still compiles. The demos are skipped, and the editor warns once per session naming the packages to install.

## Toolchain for building from source

The source generators (`Nucleus.CodeAnalysis.SourceGenerators`) target `netstandard2.0` and are consumed as Roslyn analyzers, not as a runtime dependency. Any toolchain building Nucleus from source needs an SDK that can host netstandard2.0 analyzers alongside the netstandard2.1 core.

## These targets are closed, not pending

These are closed, not pending:

- No WebSocket or WebGL transport, and so no browser target.
- No Steam, EOS, or console transport ships.

A "does platform X work" question is almost always a transport question, not a Nucleus core question — the core is platform-agnostic; what reaches a given platform is whichever transport you plug in.
