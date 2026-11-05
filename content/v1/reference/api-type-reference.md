---
title: "API type reference"
---

This page covers the types you are expected to use directly. A generated reference listing every type is planned but not yet published. Using Unity? See the [manager components reference](../unity/core/unity-manager-components.md) for the components that front each core manager.

## Everything is reached from CoreManager

Construct one `CoreManager` and it builds every manager. Everything else in the engine is reached from one of these fields, which are `readonly` and set in the constructor:

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

A Pro build adds two fields that are not `readonly`:

```csharp
public BundleManager BundleManager;
public WorldPersistenceManager WorldPersistenceManager;
```

In a Free build these two fields do not exist, so code that uses them fails to compile rather than failing at runtime. The same holds for every Pro-only type and member.

`CoreManager.Instance` names the oldest live `CoreManager` in the process, for a process running exactly one. With several managers in one process, such as a host pair or a two-peer test, pass the manager explicitly instead. `CoreManager.EnsureSetInstance(CoreManager)` points the slot at a manager you choose; it fails and logs if that manager is null or already deinitialized.

## Find types by namespace

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

Managers live under `Nucleus.Managers.*`; the types they hand you live in the flatter namespaces.

## Read the usage markers

These attributes, from the `CodeBoost.Types` namespace (see [CodeBoost reference](./codeboost-reference.md)), say how a member is meant to be used. The compiler does not enforce them.

- `[ServerOnly]`: only meaningful, or only safe to call, from server-side code.
- `[ClientOnly]`: only meaningful, or only safe to call, from client-side code.
- `[InternalApi]`: mainly for internal use, and can change or move without warning. Its optional `Details` string says why.

## Custom transports can live in your own assembly

The transport base types are public, and every member a transport implements is public or protected, so you can write a transport in your own game or package. [The Transport contract](../core-api/transports/transport-contract.md) lists what to implement.
