---
title: "Compatibility"
---

## Nucleus runs anywhere netstandard2.1 runs

The core targets `netstandard2.1`, with nullable reference types enabled and unsafe blocks allowed, and has no engine dependency. It runs on .NET 5 and later, Mono and Unity. On .NET Core 3.x, add to the consuming project:

- a `PackageReference` to `System.Runtime.CompilerServices.Unsafe` 5.0.0, which `CodeBoost.dll` depends on;
- `<LangVersion>9.0</LangVersion>`, because the generated code needs C# 9.

## The Unity integration needs Unity 6.5 or newer

The Unity integration supports **Unity 6.5 (6000.5) and newer** and does not compile on older editors. Its files are wrapped in `#if UNITY_EDITOR || UNITY_6000_5_OR_NEWER`.

Integration and demo source is pinned to `LangVersion 9`, which Unity's compiler accepts. The prebuilt engine DLL is not subject to this.

## Optional packages switch on extra code

Each of these compiles in only when its define is set. Without the package, the code is left out entirely.

| Dependency | Define | Gates |
|---|---|---|
| `com.unity.addressables` 1.19+ | `NUCLEUS_ADDRESSABLES` | Addressables-based asset loading |
| `com.unity.modules.ai`, the AI module, enabled in a new project | `NUCLEUS_NAVMESH` | `NetworkNavMeshAgent` and its inspector |
| `Unity.ResourceManager` | None | Referenced alongside Addressables |
| Relay transport | `BLITZ_RELAY` | The Blitz Relay transport (Pro only) |

The demos need the Input System, uGUI 2.0 or newer (for TextMeshPro), AI Navigation, and the Vehicles and Terrain modules. Without them the demos are skipped, the project still compiles, and the editor warns once per session naming the packages to install. The demo materials use the Universal Render Pipeline (URP), so they draw pink on any other pipeline; the same warning says so.

## Some platforms are not supported

These are closed, not pending:

- No WebSocket or WebGL transport, and so no browser target.
- No Steam, EOS or console transport ships.

Whether a platform works depends on the transport, since the core is platform-agnostic.
