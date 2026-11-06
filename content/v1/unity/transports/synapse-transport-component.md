---
title: "Synapse Transport component"
---

> **Driving the core API directly?** See [The Synapse transport](../../core-api/transports/synapse-transport.md).

`SynapseTransport` configures Synapse, the built-in UDP transport, from the inspector. Add it to the `UnityCoreManager`'s GameObject. If no transport component is present, `UnityTransportManager` adds one with default settings.

## Set where clients connect

Under **Connection**:

- **Port** (`ushort`, default `7777`): the port the server listens on and the client connects to.
- **Remote Host** (`string`, default `"127.0.0.1"`): the host name or IP address a client connects to. The server ignores it.
- **Maximum Transmission Unit** (`ushort`, default `1200`): the largest packet built before it is split.

## Set the timeouts

Under **Timeouts**:

- **Idle Timeout Seconds** (`ushort`, default `15`): how long a connected peer waits without hearing from the other side before it drops the link. The least applied is one second.
- **Connecting Timeout Seconds** (`ushort`, default `10`): how long a client waits for the server to answer its connect before giving up and returning to `Disconnected`. Zero uses **Idle Timeout Seconds**.

## Choose how a host reaches its own client

Under **Hosting**, **Host Pairing** (default `HostPairing.Local`) sets how the host's server reaches its own client half:

- `HostPairing.Local`: the two halves are paired in process and never exchange a datagram, so the host's own client is connected at once. The host's own half then tests nothing about the socket; a remote client of the same host still uses it.
- `HostPairing.Endpoint`: the two halves talk over the socket like any other client. This is the default of the core `Synapse` transport.

Pairing only engages for a loopback address. With **Remote Host** pointing at another machine, it changes nothing.

## Set values from a script

`Port` (`ushort`), `RemoteHost` (`string`) and `HostPairing` are properties over the inspector fields.
