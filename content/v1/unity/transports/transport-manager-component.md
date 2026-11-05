---
title: "Transport Manager component"
components: "UnityTransportManager"
---

> **Driving the core API directly?** See [TransportManager](../../core-api/transports/transport-manager.md).

`UnityTransportManager` adds your transport components to the core `TransportManager` and starts them. `UnityCoreManager` adds one if you have not.

## Set the fields

| Field | Default | Description |
|---|---|---|
| Default Channel | `Channel.Unreliable` | The channel a send takes when it names none. |
| Automatic Start Mode | `None` | What to start as when play begins: `None`, `Server`, `Client`, `Host` or `Auto`. `Auto` starts as a client in a ParrelSync clone or when another process already holds the server port, and as a host otherwise. The core manager has no equivalent. |
| Simulated Network Conditions | off | Latency, jitter and loss to simulate on every transport. See [Simulating a bad connection in the editor](./simulating-bad-connections-unity.md). |

## Transport components are found for you

`UnityTransportManager` adds every `NetworkTransport` component on its GameObject and its children to the core manager, in the order Unity finds them. If there are none, it adds a `SynapseTransport`. Each `NetworkTransport` is an inspector wrapper that adds and configures one core `Transport`.

## Start and stop from a script

```csharp
UnityTransportManager transportManager = GetComponent<UnityTransportManager>();

await transportManager.StartServerAsync();
await transportManager.StartClientAsync();
await transportManager.StartHostAsync();

// Adds every discovered transport to the core manager without connecting.
// StartServerAsync/StartClientAsync/StartHostAsync call this for you.
await transportManager.EnsureAddedAsync();

// Removes and shuts down every transport this component added.
transportManager.ShutdownAll();

IReadOnlyList<Transport> transports = transportManager.Transports;
```

`EnsureAddedAsync` adds transports only once; later calls return at once. `ShutdownAll` also runs when the component is destroyed.

For anything else, use the core manager through `NucleusTransportManager`.
