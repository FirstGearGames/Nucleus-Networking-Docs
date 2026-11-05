---
title: "The relay transport"
---

> **Using Unity?** See [Blitz Relay Transport component](../../unity/transports/blitz-relay-transport-component.md).

`RelayTransport` connects peers through a Blitz Relay server. Neither peer listens: both connect out to the relay, one opens and holds a room, and the rest join with the room's code. No peer needs an inbound port, a public IP or a NAT hole.

`RelayTransport` and `RelaySessionHost` live in the `Nucleus.Integrations.BlitzRelay` assembly. The relay server and the newfarm directory server are separate services that you run or choose.

## Configure it

| Member | Purpose |
|---|---|
| `RelayEndPoint` | The relay to use. Defaults to loopback on `DefaultRelayPort` (7770). |
| `ConnectionKey` | The relay operator's key the relay admits peers with, not a player's key. |
| `RoomCode` | Set it before connecting a client, to name the room to join. Read it after connecting a server, to get the room the relay assigned. |
| `HostedRoomCode` | The room this peer is hosting, or empty when its hosting side is not up. For a peer that only joined, `RoomCode` is the joined room and this is empty. |
| `MaximumClients` | How many clients a room this peer creates holds. Defaults to `DefaultMaximumClients` (16). Used only when `ServerConfiguration.MaximumConnections` is not set, because a room must be given a size when it is made. |
| `RelayHandshakeTimeoutMilliseconds` | How long to wait for the relay to answer a handshake. Defaults to 10000. |

`RelayTransport.DatagramOverheadBytes` includes the relay's own header, so a relayed session carries less per packet than a direct one.

## When the relay closes the room

If the relay closes the host's link, for example because the relay shut down or dropped the room, the host's server stops on the next poll and disconnects every client. The usual server-stopped and client-disconnected callbacks fire, so you need no extra handling. To keep playing, open a new room or let `NewfarmHostMigration` do it.

## Survive a lost host with NewfarmHostMigration

A room dies with the peer that made it, and its replacement gets a name nobody knew in advance. `NewfarmHostMigration` solves this with a newfarm directory: it registers the session, notices the host going, and either takes the session over or rejoins wherever the directory says it moved. This is the relay's own handover, not engine-level host migration.

```csharp
NewfarmHostMigration hostMigration = new(coreManager, sessionHost, directoryIpEndPoint);
```

Call it:

- `StartHostingAsync(uint timeoutMilliseconds = DefaultTimeoutMilliseconds)`: opens a session with the directory and hosts it on this peer.
- `JoinAsync(ulong sessionId, uint timeoutMilliseconds = DefaultTimeoutMilliseconds)`: finds a session by id and joins wherever it is. A join can end with this peer elected to host, which still reports success.
- `TrySurrenderHosting()`: hands the session to whoever the directory elects next; this peer stays as a client.
- `CloseSession()`: ends the session for everybody.
- `Poll()`: call once a frame or once a tick. It drives the directory link and the `ISessionHost`, and watches for the host going quiet.

Read:

- `State`: a `NewfarmMigrationState` describing what this peer is doing about the session.
- `SessionId`: the id the directory issued. The host gives it to clients so they can find their way back.

Handle:

- `Promoting`: raised on the peer chosen to take over, before it does. The session is not hosted again until the handler returns.
- `Promoted(string credential)`: this peer is now hosting, at the credential the service named.
- `Rejoined(string credential)`: a surviving peer has rejoined the session where it moved.
- `Abandoned(string reason)`: the session could not continue, because the directory refused it or no peer would host it.

### NewfarmHostMigration needs Pro

A client kept with `DisconnectResetMode.RetainReceivedWorld` retains the world it had when its link dropped, and the promoted server adopts that world through `ServerManager.TryAdoptRetainedWorld`, which only Pro has. So `Nucleus.Integrations.Newfarm`, and `Nucleus.Integrations.BlitzRelay`, which references it, do not compile against a free `Nucleus.dll`.

## Implement ISessionHost for another service

`NewfarmHostMigration` drives any session service through `ISessionHost`:

| Member | Role |
|---|---|
| `AdapterTag` | Names the service. It is filed with every credential this publishes, so a receiving peer knows whether it can use it. |
| `HostedCredential` | What another peer needs to reach the session this peer hosts, or empty when not hosting. |
| `IsHostingLinkUp` | Whether this peer's hosting side is up. |
| `IsJoinedLinkUp` | Whether this peer's link to the current host is up. Independent of `IsHostingLinkUp`: a freshly promoted peer has one up and the other down. |
| `Poll()` | Drives the service, once per `NewfarmHostMigration.Poll`. |
| `StartHostingAsync(uint timeoutMilliseconds)` | Hosts the session on this peer, returning a `SessionHostResult`. |
| `JoinAsync(string credential, uint timeoutMilliseconds)` | Joins the session at the credential. |
| `StopHostingAsync()` | Stops hosting; `HostedCredential` becomes empty and `IsHostingLinkUp` false. |
| `LeaveAsync()` | Leaves a joined session; `IsJoinedLinkUp` becomes false. |

`SessionHostResult` values:

- `Success`.
- `CredentialUnreachable`: the service answered but the room is not there or will not take this peer. The directory acts on this.
- `LocalFailure`: this peer could not try. It is never reported to the directory.

`RelaySessionHost` is the relay's implementation. Its `AdapterTag` is `"blitzrelay"`, `HostedCredential` reads `RelayTransport.HostedRoomCode`, and the four async calls connect and disconnect the transport's server and client sockets.
