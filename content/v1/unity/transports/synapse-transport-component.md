---
title: "Synapse Transport component"
---

> **Driving the core API directly?** See [The Synapse transport](../../core-api/transports/synapse-transport.md).

`SynapseTransport` is the Inspector-configurable `NetworkTransport` for the built-in UDP transport, Synapse. Place it on the `UnityCoreManager`'s GameObject and edit its fields there; `UnityTransportManager` reads every `NetworkTransport` component on that GameObject and its children and adds each to the `CoreManager`. When it finds none, it adds a `SynapseTransport` itself, so a project with no transport component configured still gets Synapse with its defaults.

A custom editor (`SynapseTransportEditor`) groups the fields into three labeled sections in the Inspector: Connection, Timeouts, and Hosting.

## Inspector fields

### Connection

**Port** (`ushort`, default `7777`): the port the server listens on and the client connects to.

**Remote Host** (`string`, default `"127.0.0.1"`): the address a client connects to. The server ignores it: a host's server half never reads `RemoteHost`, since a server just listens on `Port` rather than dialing anywhere.

**Maximum Transmission Unit** (`ushort`, default `1200`): the largest packet built before it is split into multiple packets.

### Timeouts

**Idle Timeout Seconds** (`ushort`, default `15`): how long a connected peer waits without hearing from the other side before it drops the link. One second is the least value applied.

**Connecting Timeout Seconds** (`ushort`, default `10`): how long a client waits for its connection to be accepted. Synapse does not apply this yet; the field and its tooltip say so directly. A connect that goes unanswered times out after **Idle Timeout Seconds** instead, the same window Synapse uses for a connected link.

### Hosting

**Host Pairing** (`HostPairing`, default `HostPairing.Local` on this component): how this transport reaches its own client half when the peer running it is also the host.

- `HostPairing.Local`: the server and client halves are paired in process and never exchange a datagram. The link is named the instant it's made, and a host's own traffic never crosses the socket to be discarded on arrival. The cost is that a host no longer proves anything about the transport through its own half — a genuinely remote client of the same host is unaffected and still goes over the real socket.
- `HostPairing.Endpoint`: the two halves talk over the socket like any other pair, and the host recognizes its own client the same way it recognizes any client. This is what the underlying `Synapse` transport defaults to in the engine.

The component ships the opposite default from the engine (`Local` here, `Endpoint` in `Synapse` itself) because a game hosting a session wants its own half answered at once, without a frame of its own traffic risking discard on the wire. Point `Remote Host` at another machine and this setting changes nothing — the pairing only engages for a loopback address.

## Reading and writing values from a script

`SynapseTransport` exposes `Port`, `RemoteHost`, and `HostPairing` as properties over its serialized fields:

```csharp
public ushort Port { get => _port; set => _port = value; }
public string RemoteHost { get => _remoteHost; set => _remoteHost = value; }
public HostPairing HostPairing { get => _hostPairing; set => _hostPairing = value; }
```

`Port` here is a `ushort`, matching the engine's `Configuration.Port`. `RemoteHost` is a `string` on this component — it gets parsed into an `IPAddress` only when the transport is added to the `CoreManager`, unlike the underlying `Synapse.RemoteHost` property in the engine, which is already an `IPAddress`. An invalid string will fail to parse at that point, so keep it a valid address literal.
