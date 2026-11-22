---
title: "Synapse Transport component"
---

> **Driving the core API directly?** See [The Synapse transport](../../core-api/transports/synapse-transport.md).

`SynapseTransport` configures Synapse, the built-in UDP transport, from the inspector. Add it to the `UnityCoreManager`'s GameObject. If no transport component is present, `UnityTransportManager` adds one with default settings.

## Set where clients connect

Under **Connection**:

- **Port** (`ushort`, default `7777`): the port the server listens on and the client connects to.
- **Remote Host** (`string`, default `"127.0.0.1"`): the host name or IP address a client connects to. The server ignores it.
- **Bind Address** (`string`, default empty): the local address the server and client bind to, an IP address or `localhost`. Empty binds every interface.
- **Maximum Transmission Unit** (`ushort`, default `1200`): the largest packet built before it is split.

## Set the timeouts

Under **Timeouts**:

- **Idle Timeout Seconds** (`ushort`, default `15`): how long a connected peer waits without hearing from the other side before it drops the link. The least applied is one second.
- **Connecting Timeout Seconds** (`ushort`, default `10`): how long a client waits for the server to answer its connect before giving up and returning to `Disconnected`. Zero uses **Idle Timeout Seconds**.
- **Host Resolve Timeout Seconds** (`ushort`, default `5`): how long a client waits for a host name in **Remote Host** to resolve before it stops connecting. Unused for an IP address.
- **Resolved Address Cache Seconds** (`ushort`, default `60`): how long a resolved host name is reused before it is looked up again. Zero looks it up on every connect.

## Set the hosting options

Under **Hosting**, **Maximum Connections** (`uint`, default `0`) is the most clients the server accepts at once. Zero accepts any number.

**Host Pairing** (default `HostPairing.Local`) sets how the host's server reaches its own client half:

- `HostPairing.Local`: the two halves are paired in process and never exchange a datagram, so the host's own client is connected at once. The host's own half then tests nothing about the socket; a remote client of the same host still uses it.
- `HostPairing.Endpoint`: the two halves talk over the socket like any other client. This is the default of the core `Synapse` transport.

Pairing only engages for a loopback address. With **Remote Host** pointing at another machine, it changes nothing.

## Stop forged data packets with the data session token

Under **Security**, **Data Session Token Enabled** (`bool`, default off) protects every data packet against forgery. With it on at both the server and the client, someone who is not on the network path between them cannot send data as a player, or end a player's link with a forged packet. A link uses it only when both ends have it on, so turn it on in the server's build and in the client's build.

Turning it on costs bandwidth and CPU for every client:

- Every packet grows slightly in each direction, so a game that sends more packets pays more bandwidth.
- The server and each client do a little extra work on every packet they send and receive.

It does not hide traffic from someone who can see it on the way, such as another device on the same network.
## Limit what each client may send

Under **Client Limits**, the server holds each client's datagrams to limits that are on by default. See [Securing a server in Unity](../diagnostics/securing-a-server-in-unity.md#limit-how-much-each-client-can-send) for every field and its default.

## Set values from a script

`Port` (`ushort`), `RemoteHost` (`string`), `HostPairing` and `DataSessionTokenEnabled` (`bool`) are properties over the inspector fields.
