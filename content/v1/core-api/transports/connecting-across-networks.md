---
title: "Connecting across networks"
---

## The three hops

Get a session working in this order. Each hop changes exactly one thing, so when it breaks you know which layer to blame.

1. **Loopback, one process.** Both peers run in the same process on `127.0.0.1`. This is the default: `RemoteHost` starts at `IPAddress.Loopback` in C#, and the Unity `SynapseTransport` component defaults its Remote Host field to `127.0.0.1`. Nothing about ports or addresses can be wrong here, so if this fails the bug is in your game logic, not the network.
2. **LAN, two machines.** Point the client's Remote Host at the server machine's LAN IP (e.g. `192.168.x.x`) instead of loopback. The server's own configuration does not change. This hop tests that the port is actually open on the server machine and that nothing between the two machines (a firewall) is dropping the traffic.
3. **Open internet, peer outside your network.** The client needs the server's public IP or DNS name. This hop adds a router in the path, which introduces port forwarding as a new failure point on top of the previous two.

## What each side needs

The client needs the server's reachable address and the port it is listening on. The server needs that port open to it.

- Unity: set **Remote Host** on the `SynapseTransport` component to the server's address, and **Port** to match on both sides.
- C#: set `Synapse.RemoteHost` (an `IPAddress`) before connecting the client, and `Configuration.Port` the same on both peers.

See the Unity and C# transport pages for the full field lists.

## Why the server ignores the address

`Synapse`'s server side always binds every local address on the machine; it never looks at `RemoteHost`, and it reads only `Configuration.Port`. That is why the server-side address field doesn't exist at all — there's nothing to set. A server listening on port 7777 answers on its loopback address, its LAN address, and its public address simultaneously, all on that same port. What has to be right is which of those addresses the client is told to dial, and whether traffic to that address and port actually reaches the machine.

## The failure ladder

Work through these in order; each one only matters once the ones above it are ruled out.

1. **Wrong port.** The client's port doesn't match the server's `Configuration.Port`. Cheapest thing to check, check it first.
2. **Firewall.** The OS or network firewall on the server machine is dropping inbound packets to that port before the socket ever sees them.
3. **Router with no forward.** On a home/office network, the router won't route an inbound packet from the internet to the server machine's LAN address unless a port forward (or UPnP) sends it there. LAN-to-LAN traffic never hits this; it only shows up on the third hop.
4. **Carrier-grade NAT.** Some ISPs (and most mobile carriers) put the server behind a NAT you don't control and can't forward through, no matter how correctly the router is configured. If forwarding is set up correctly and still doesn't work, this is usually why — and no amount of retrying fixes it from your end.

## Reading which layer failed

`LocalConnectionState` alone can't tell you where it stopped. A `Synapse` client reports `Connected` as soon as it has sent its handshake, before the server has answered, and a link that fails for any reason ends at `Disconnected`; the shipped transports never set `Error` or `TimedOut`. The sign that the server actually answered and accepted the client is `ClientManager.LocalClientAuthenticated`, so read the two together:

- **Drops to `Disconnected` without `LocalClientAuthenticated` ever firing.** The client's packets aren't reaching the server at all. The client waits out `Configuration.ConnectedTimeoutSeconds` (15 seconds by default) and then drops. This is a routing/reachability problem: wrong address, wrong port, firewall, or missing port forward. A server that refuses the client drops it straight away instead, and `ClientManager.LastAuthenticationDenialReason` holds the reason it gave.
- **`LocalClientAuthenticated` fired, then the link dropped to `Disconnected`.** The initial handshake worked, so the path was open at least once, but traffic stopped flowing after that. This points at something intermittent: a NAT mapping that expired, a firewall rule that only blocks certain packet patterns, or a real network interruption. It's a different problem than never connecting at all, so don't go back to checking the port or the forward.

## When to stop fighting NAT

If you've confirmed the port is right, the firewall is open, and the router has a working forward, and it still won't connect over the open internet, you're likely behind (or connecting to a peer behind) carrier-grade NAT or a similarly locked-down network you have no access to. At that point, stop trying to forward a port that can't be forwarded and use `RelayTransport` instead: one peer hosts a room and gets back a `RoomCode`, and every other peer joins with just that code — no address, no port, no forwarding required on either side.

## No discovery, no punchthrough

Nucleus does not scan the LAN for servers and does not attempt NAT punchthrough on its own. An address always has to come from somewhere you provide — typed in, read from a config file, fetched from your own matchmaking service, or (for the relay path) a room code exchanged out of band.
