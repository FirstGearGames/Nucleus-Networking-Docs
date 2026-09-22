---
title: "API type reference"
---

## Where to start

Every session hangs off one object: `CoreManager`. Construct one and it builds the whole manager graph for you; everything else in the engine is reached from a manager on that graph, not constructed on its own.

```csharp
public readonly NetworkLoopManager NetworkLoopManager;
public readonly TransportManager TransportManager;
public readonly ServerManager ServerManager;
public readonly ClientManager ClientManager;
public readonly SystemManager SystemManager;
public readonly InterestManager InterestManager;
public readonly Scenes.SceneManager SceneManager;
public readonly PacketManager PacketManager;
public readonly MessageManager MessageManager;
public readonly RpcManager RpcManager;
public readonly ViolationManager ViolationManager;
```

These eleven fields are `readonly` and set once, in the constructor, in this order. A Pro build adds two more, assigned through partial constructor hooks rather than the constructor body itself:

```csharp
public BundleManager BundleManager;
public WorldPersistenceManager WorldPersistenceManager;
```

`BundleManager` and `WorldPersistenceManager` are not `readonly` because the language does not allow a partial hook to assign a readonly field outside the declaring partial's own constructor body. In a Free build the hooks that would construct them compile away to nothing, and the fields themselves do not exist on the type at all — code referencing them fails to compile against a Free build rather than failing at runtime.

`CoreManager.Instance` is a static convenience slot naming the oldest live `CoreManager` in the process, for the common case of a process running exactly one. It is not meant for a process running several managers at once (a host pair, a two-peer test) — pass the manager explicitly there instead. `CoreManager.EnsureSetInstance(CoreManager)` moves the slot to a manager of your choosing; it fails and logs if the manager passed is null or already deinitialized.

## Namespace map

| Namespace | What lives there |
|---|---|
| `Nucleus.Managers.Core` | `CoreManager` itself |
| `Nucleus.Managers.NetworkLoop` | The tick driver and its step providers |
| `Nucleus.Managers.Transports` | `TransportManager`, the active `Transport` |
| `Nucleus.Managers.Server` | `ServerManager` |
| `Nucleus.Managers.Client` | `ClientManager` |
| `Nucleus.Managers.Systems` | `SystemManager` and system lifecycle |
| `Nucleus.Managers.Interest` | `InterestManager` |
| `Nucleus.Managers.Scenes` | `SceneManager` |
| `Nucleus.Managers.Messages` | `MessageManager` |
| `Nucleus.Managers.Rpc` | `RpcManager` |
| `Nucleus.Managers.Violations` | `ViolationManager` and the shipped violation types |
| `Nucleus.Managers.Bundles` | `BundleManager` (Pro) |
| `Nucleus.Managers.Persistence` | `WorldPersistenceManager` (Pro) |
| `Nucleus.Systems` | `NetworkSystem` and the members you declare on one |
| `Nucleus.Components` | Engine-neutral replicated components, such as `TransformComponent` |
| `Nucleus.Connections` | `Connection` and peer-side state |
| `Nucleus.Serializers` | Reader/writer contracts and generated serializer plumbing |
| `Nucleus.Packets` | Wire packet types |
| `Nucleus.Physics` | Physics-adjacent components and adapters |
| `Nucleus.Transports` | Transport base types, plus the `Synapse`, `Yak`, and `Sockets` sub-namespaces for the shipped transport implementations |
| `Nucleus.Inputs` | Input components |

Everything reachable from a `CoreManager` field lives under `Nucleus.Managers.*`; the types those managers hand you (systems, components, connections, packets, serializers) live in the flatter namespaces above.

## Reading the markers

Three attributes tell you how a member is meant to be used before you call it:

- `[ServerOnly]` — only meaningful, or only safe to call, from server-side code.
- `[ClientOnly]` — only meaningful, or only safe to call, from client-side code.
- `[InternalApi]` — exposed for convenience but primarily for internal use; it can change or move without warning, and takes an optional `Details` string explaining why.

None of these are compiler-enforced access restrictions — they are promises about intended use, not guardrails that stop a misuse from compiling.

A type or member declared in a `*.Pro.cs` file is a build-time absence, not a runtime failure: `CoreManager.BundleManager` and `CoreManager.WorldPersistenceManager` simply do not exist on the compiled type in a Free build. Code that references them against a Free build fails to compile, it does not throw at runtime.

## What is not extensible from outside the assembly

A `Transport` is built on `CommonSocket`, whose connect, send, and receive members are `internal`. `InternalsVisibleTo` is granted to exactly one assembly, `Nucleus.Integrations.BlitzRelay`, and to nothing else. Writing a custom transport from outside the engine assembly is not currently possible — today that's an in-tree exercise, done as a fork or a PR against `Nucleus.Transports`, not as an external package.

## Full type listing

This page and the rest of the hand-written reference never try to enumerate every type. They cover the surface you're expected to reach for directly. A generated, exhaustive API reference is planned but not yet published.

## Working in Unity

If you're building against the Unity integration rather than plain C#, see the [manager components reference](../unity/core/unity-manager-components) for the `UnityManager`-derived components that front each core manager on the manager GameObject.
