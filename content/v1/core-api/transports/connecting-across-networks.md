---
title: "Connecting across networks"
---

## Get each hop working in order

Each hop changes one thing, so when it breaks you know which layer to check.

1. **Loopback, one process.** Both peers run on `127.0.0.1`, the default: `RemoteHost` starts at `IPAddress.Loopback` in C#, and the Unity `SynapseTransport` component's **Remote Host** defaults to `127.0.0.1`. If this fails, the bug is in your game logic, not the network.
2. **LAN, two machines.** Point the client's Remote Host at the server machine's LAN IP, such as `192.168.x.x`. The server does not change. This tests that the port is open on the server and no firewall drops the traffic.
3. **Open internet.** The client needs the server's public IP or DNS name. This adds the router, and port forwarding, as a failure point.

## Set the address on the client and the port on both

- Unity: set **Remote Host** on the `SynapseTransport` component to the server's address, and **Port** to the same value on both sides.
- C#: set `Synapse.RemoteHost` (an `IPAddress`) before connecting the client, and `Configuration.Port` the same on both peers.

The server has no address to set. It listens on every local address (loopback, LAN and public) on its `Configuration.Port`. What matters is which address the client dials and whether traffic to it reaches the machine.

## Check the failures in this order

1. **Wrong port.** The client's port does not match the server's `Configuration.Port`.
2. **Firewall.** The server machine's firewall drops inbound packets to that port.
3. **No port forward.** On a home or office network, the router does not pass inbound internet traffic to the server's LAN address without a port forward or UPnP. This only affects the third hop.
4. **Carrier-grade NAT.** Some ISPs, and most mobile carriers, put the server behind a NAT you cannot forward through. If forwarding is set up correctly and still fails, this is usually why.

## Tell which layer failed

`LocalConnectionState` cannot tell you: a `Synapse` client reports `Connected` once it sends its handshake, and every failure ends at `Disconnected`. Watch `ClientManager.LocalClientAuthenticated`, which fires when the server accepts the client:

- **`Disconnected` without `LocalClientAuthenticated`**: the client's packets never reached the server, and it dropped after `Configuration.ConnectedTimeoutSeconds` (15 by default). Check the address, port, firewall and forward. A server that refuses the client drops it at once instead, and `ClientManager.LastAuthenticationDenialReason` holds the reason.
- **`LocalClientAuthenticated`, then `Disconnected`**: the path worked at least once, then traffic stopped. Look for something intermittent, such as an expired NAT mapping, a selective firewall rule or a real network interruption, not the port or forward.

## Use the relay when NAT cannot be beaten

If the port, firewall and forward are all right and it still fails over the internet, a peer is likely behind carrier-grade NAT. Use [`RelayTransport`](./relay-transport.md): one peer hosts a room and gets a `RoomCode`, and the others join with that code. No address, port or forwarding is needed.

Nucleus does not discover servers on the LAN or attempt NAT punchthrough. The address or room code always comes from you: typed in, read from a config file or fetched from your own service.
