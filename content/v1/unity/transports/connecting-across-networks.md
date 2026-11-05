---
title: "Connecting across networks"
---

## Get a session working one step at a time

Each step changes one thing, so when one fails you know which layer to blame.

1. **One process on loopback.** Both peers run in the same process on `127.0.0.1`, the default **Remote Host** on the `SynapseTransport` component and the default `RemoteHost` in C#. Nothing about ports or addresses can be wrong here, so a failure is in your game logic, not the network.
2. **Two machines on a LAN.** Point the client's **Remote Host** at the server machine's LAN IP, such as `192.168.x.x`. The server's settings do not change. This tests that the port is open on the server machine and that no firewall between the two drops the traffic.
3. **A peer on the open internet.** The client needs the server's public IP or DNS name. This adds a router to the path, and with it port forwarding.

## Point the client at the server

The client needs the server's reachable address and the port it listens on, and the server needs that port open.

- Unity: set **Remote Host** on the `SynapseTransport` component to the server's address, and **Port** to the same value on both sides.
- C#: set `Synapse.RemoteHost` before connecting the client, and `Configuration.Port` to the same value on both peers.

The server never reads `RemoteHost`; it reads only `Configuration.Port`. By default it listens on every address the machine has, so a server on port 7777 answers on its loopback, LAN and public addresses at once. What has to be right is the address the client dials, and whether traffic to that address and port reaches the machine.

## Check these causes in order

Each one only matters once the ones above it are ruled out.

1. **Wrong port.** The client's port does not match the server's `Configuration.Port`. It is the cheapest check, so do it first.
2. **Firewall.** The firewall on the server machine or its network drops inbound packets to that port before the socket sees them.
3. **No port forward.** A router does not pass an inbound packet from the internet to a LAN machine unless a port forward or UPnP sends it there. This only shows up on the third step.
4. **Carrier-grade NAT.** Some ISPs, and most mobile carriers, put the machine behind NAT you cannot forward through. If forwarding is set up correctly and it still fails, this is usually why, and nothing on your end fixes it.

## Tell which layer failed

`LocalConnectionState` alone cannot tell you. A `SynapseTransport` client reports `Connected` as soon as it has sent its handshake, before the server answers, and a link that fails for any reason ends at `Disconnected`; the shipped transports never set `Error` or `TimedOut`. The sign that the server answered and accepted the client is `LocalClientAuthenticated` on `UnityClientManager.NucleusClientManager`, so read the two together:

- **Drops to `Disconnected` without `LocalClientAuthenticated` ever firing:** the client's packets never reach the server. The client waits out **Idle Timeout Seconds** on `SynapseTransport` (15 by default) and drops. Check the address, port, firewall and port forward. A server that refuses the client drops it at once instead, and `ClientManager.LastAuthenticationDenialReason` holds the reason it gave.
- **`LocalClientAuthenticated` fired, then the link dropped to `Disconnected`:** the path worked at least once, so look for something intermittent, such as an expired NAT mapping, a firewall rule that blocks some packet patterns, or a real network interruption. Do not go back to checking the port or the forward.

## Switch to a relay when NAT blocks you

If the port is right, the firewall is open and the router has a working forward, and it still will not connect over the internet, one side is probably behind carrier-grade NAT or a similar network you cannot change. Use `RelayTransport` instead: one peer hosts a room and gets back a `RoomCode`, and every other peer joins with that code. No address, port or forwarding is needed on either side. See [Hosting and joining a relay session](./relay-sessions.md).

## Supply the address yourself

Nucleus does not scan the LAN for servers or attempt NAT punchthrough. The address always comes from you: typed in, read from a config file, fetched from your own matchmaking service, or, for a relay, a room code shared out of band.
