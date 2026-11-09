---
title: "Connecting across networks"
---

## Get each hop working in order

Each hop changes one thing, so when it breaks you know which layer to check.

1. **Loopback, one process.** Both peers run on `127.0.0.1`, the default **Remote Host** on the Unity `SynapseTransport` component and the default `RemoteHost` in C#. If this fails, the bug is in your game logic, not the network.
2. **LAN, two machines.** Point the client's Remote Host at the server machine's LAN IP, such as `192.168.x.x`. The server does not change. This tests that the port is open on the server and no firewall drops the traffic.
3. **Open internet.** The client needs the server's public IP or DNS name. This adds the router, and port forwarding, as a failure point.

## Set the address on the client and the port on both

- Unity: set **Remote Host** on the `SynapseTransport` component to the server's address, and **Port** to the same value on both sides.
- C#: set `Synapse.RemoteHost` (a host name or IP address) before connecting the client, and `Configuration.Port` to the same value on both peers.

The server never reads Remote Host. By default it listens on every address the machine has (loopback, LAN and public) on its port. What matters is which address the client dials and whether traffic to it reaches the machine.

## Check the failures in this order

1. **Wrong port.** The client's port does not match the server's. It is the cheapest check, so do it first.
2. **Firewall.** The server machine's firewall drops inbound packets to that port.
3. **No port forward.** On a home or office network, the router does not pass inbound internet traffic to the server's LAN address without a port forward or UPnP. This only affects the third hop.
4. **Carrier-grade NAT.** Some ISPs, and most mobile carriers, put the server behind a NAT you cannot forward through. If forwarding is set up correctly and still fails, this is usually why.

## Tell which layer failed

`LocalConnectionState` cannot tell you: a Synapse client reports `Connected` once it sends its handshake, and every failure ends at `Disconnected`. Watch `ClientManager.LocalClientAuthenticated` (in Unity, on `UnityClientManager.NucleusClientManager`), which fires when the server accepts the client:

- **`Disconnected` without `LocalClientAuthenticated`**: the client's packets never reached the server, and it dropped after the idle timeout (`Configuration.ConnectedTimeoutSeconds`, or **Idle Timeout Seconds** on `SynapseTransport`, 15 by default). Check the address, port, firewall and forward. A server that refuses the client drops it at once instead, and `ClientManager.LastAuthenticationDenialReason` holds the reason.
- **`LocalClientAuthenticated`, then `Disconnected`**: the path worked at least once, then traffic stopped. Look for something intermittent, such as an expired NAT mapping, a selective firewall rule or a real network interruption, not the port or forward.

## When NAT cannot be beaten

If the port, firewall and forward are all right and it still fails over the internet, the server is likely behind carrier-grade NAT, which no forward gets through. Host on a machine with a public address, such as a dedicated server, or in Unity use the Steam transport add-on, `SteamTransport`, which reaches players by Steam ID through Valve's relay network with no port to forward.

Nucleus does not discover servers on the LAN or attempt NAT punchthrough. The address always comes from you: typed in, read from a config file or fetched from your own service.
