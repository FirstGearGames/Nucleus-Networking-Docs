---
title: "Transport Manager component"
---

> **Driving the core API directly?** See [TransportManager](../../core-api/transports/transport-manager.md).

`UnityTransportManager` is the Inspector-side driver for the core transport manager. On `ManagersInstantiated` it grabs the core `TransportManager` off the `CoreManager` and applies its `Default Channel` field to it. If you have not added a `UnityTransportManager` yourself, `UnityCoreManager` adds one for you.

## Inspector fields

| Field | Type | Default | Description |
|---|---|---|---|
| Default Channel | `Channel` | `Channel.Unreliable` | The channel a send takes when it names none. |
| Automatic Start Mode | `NetworkStartMode` | `None` | What to start as when play begins: `None`, `Server`, `Client`, or `Host`. There is no core-manager equivalent of this field; it exists only on the Unity component. |

## Transport discovery

`UnityTransportManager` does not configure transports itself. It looks for `NetworkTransport` components on its own GameObject and its children, in the order Unity finds them, and adds each one to the core manager. If it finds none, it adds a `SynapseTransport` component so the object always has a usable transport.

Each `NetworkTransport` is an Inspector-configurable wrapper around a pure-code `Transport`; it is responsible for adding and configuring that underlying transport when asked.

## Driving it from a script

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

`EnsureAddedAsync` only adds transports once; later calls return immediately if the core manager already has transports. `ShutdownAll` also runs automatically from `OnDestroy`, unless the core manager has already torn itself down.

## The core manager

`UnityTransportManager.NucleusTransportManager` is the underlying `Nucleus.Managers.Transports.TransportManager`. Anything this component does not expose — settings and behavior beyond the default channel and the transport list — is on that core manager instead.
