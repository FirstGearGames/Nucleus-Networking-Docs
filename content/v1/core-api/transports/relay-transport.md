---
title: "The relay transport"
---

> **Using Unity?** See [Blitz Relay Transport component](../../unity/transports/blitz-relay-transport-component.md).

## RelayTransport

`RelayTransport` is a `SocketPairTransport<RelayServerSocket, RelayClientSocket>`: like every socket-pair transport it has a server socket and a client socket, but neither one listens. Both peers are outbound clients of a Blitz Relay server. One of them opens a room and holds it; the rest dial in with the room's name. That is what removes the port-forwarding problem — nobody needs an inbound port, a public IP, or a NAT hole, because nothing on either peer ever accepts a connection.

| Member | Purpose |
|---|---|
| `RelayEndPoint` | The relay to carry this session. Defaults to loopback on `DefaultRelayPort` (7770). |
| `ConnectionKey` | The key the relay admits peers with. This is the relay operator's key, not a player's. |
| `RoomCode` | The room to join, and once the server connects, the room the relay named for it. Set it before connecting a client (a joining peer reads it); read it after connecting a server (the server's side writes it once the relay assigns a room). |
| `HostedRoomCode` | The room this peer is itself hosting, or empty when its own hosting side isn't up. Distinct from `RoomCode`, which for a peer that only joined answers with the room it was told to join, not one it hosts. |
| `MaximumClients` | How many clients the room this peer creates will hold. Defaults to `DefaultMaximumClients` (16). Used only when `ServerConfiguration.MaximumConnections` hasn't been set — a relayed room has to be given a real size when it's made, unlike a listening transport where "unset" can mean no limit. |
| `RelayHandshakeTimeoutMilliseconds` | How long to wait for the relay to answer a handshake before giving up. Defaults to 10000. |

## DatagramOverheadBytes

`RelayTransport.DatagramOverheadBytes` is the relay's own header on a host data frame (message type, virtual client id, channel) plus the overhead the socket library beneath the relay adds to every datagram. The engine reserves this before building a packet, so it comes straight off your usable transmission unit compared to a transport that talks to the wire directly — a relayed session pays for the relay's framing in addition to the socket layer's.

## Why the room needs a session-host seam

A relayed room belongs to whichever peer made it, and it dies with that peer. Every other peer's link to the room dies with it too. That means a handover isn't a reconnect — it's a brand-new room, under a name nobody could have known in advance, with no channel left between the survivors to learn it. `RelayTransport` alone has no way to solve that; it only knows how to open, join, and leave a room it's told about.

## ISessionHost

`ISessionHost` is the seam a session-carrying service implements so `NewfarmHostMigration` can drive it without knowing what the service actually is:

| Member | Role |
|---|---|
| `AdapterTag` | Names the service, filed with the directory alongside every credential this publishes, so a peer receiving a credential knows whether it can use it. |
| `HostedCredential` | What another peer needs to reach the session this peer is hosting, or empty when this peer isn't hosting one. |
| `IsHostingLinkUp` | Whether this peer's own hosting side is up. |
| `IsJoinedLinkUp` | Whether this peer's link to whoever is hosting the session is up. Independent of `IsHostingLinkUp` by design — a freshly promoted peer has one up and the other down. |
| `Poll()` | Drives whatever the service needs driving, once per `NewfarmHostMigration.Poll`. |
| `StartHostingAsync(uint timeoutMilliseconds)` | Stands the session up on this peer, returning a `SessionHostResult`. |
| `JoinAsync(string credential, uint timeoutMilliseconds)` | Joins the session at the given credential. |
| `StopHostingAsync()` | Stops hosting, leaving `HostedCredential` empty and `IsHostingLinkUp` false. |
| `LeaveAsync()` | Leaves a session this peer had joined, leaving `IsJoinedLinkUp` false. |

`RelaySessionHost` is `RelayTransport`'s implementation of this: its `AdapterTag` is `"blitzrelay"`, `HostedCredential` reads `RelayTransport.HostedRoomCode`, and `StartHostingAsync`/`JoinAsync`/`StopHostingAsync`/`LeaveAsync` connect and disconnect the transport's server and client sockets. `SessionHostResult` is a two-way distinction, not a bool: `Success`, `CredentialUnreachable` (the service answered and the room isn't there or won't have this peer — the signal a directory acts on), and `LocalFailure` (this peer's own side couldn't try, which is never reported to the directory).

## NewfarmHostMigration

`NewfarmHostMigration` is the coordinator that keeps a session alive across a lost host: it registers the session with a newfarm directory, notices the host going, and either takes the session over itself or rejoins wherever the directory says it moved. It's constructed with a `CoreManager`, an `ISessionHost`, and a directory endpoint.

```csharp
NewfarmHostMigration hostMigration = new(coreManager, sessionHost, directoryIpEndPoint);
```

Driving it:

- `StartHostingAsync(uint timeoutMilliseconds = DefaultTimeoutMilliseconds)` — opens a session with the directory and stands it up on this peer.
- `JoinAsync(ulong sessionId, uint timeoutMilliseconds = DefaultTimeoutMilliseconds)` — finds a session by id and joins wherever it currently lives. A join can end with this peer elected to host it, which still reports success.
- `SurrenderHosting()` — gives the session up to whoever the directory elects next, while this peer stays in the session as an ordinary client afterward.
- `CloseSession()` — ends the session for everybody, rather than handing it on.
- `Poll()` — call once a frame or once a tick. Drives the directory link, the `ISessionHost`, and watches for the current host going quiet.

State and identity:

- `State` — a `NewfarmMigrationState` describing what this peer is currently doing about the session.
- `SessionId` — the id the directory issued for this session; what a host distributes to its clients so they can find their way back.

Events:

- `Promoting` — raised on the peer told to take the session over, before it does. The session is not hosted again until this returns.
- `Promoted(string credential)` — raised once this peer is hosting the session, carrying the credential the service named.
- `Rejoined(string credential)` — raised on a surviving peer once it has rejoined the session where it moved.
- `Abandoned(string reason)` — raised when the session could not be carried on, whether the directory refused it or no peer would host it.

The half that makes a handover mean anything — carrying the game world across it rather than starting the new host empty — is Pro. It lives in `ClientManager.Adoption.Pro.cs` and `SceneManager.Adoption.Pro.cs`: a client kept with `DisconnectResetMode.RetainReceivedWorld` retains the world it had when its link dropped, and the newly promoted server adopts that retained world as its own to serve. Without Pro, `NewfarmHostMigration` still finds the new host and reconnects everyone to it; it just doesn't carry state across the move.

## Assembly boundary

`RelayTransport` and `RelaySessionHost` live in their own assembly, `Nucleus.Integrations.BlitzRelay`, reached through the one `InternalsVisibleTo` grant the engine makes:

```csharp
[assembly: InternalsVisibleTo("Nucleus.Integrations.BlitzRelay")]
```

A `Transport` is built on internal members of the engine's socket layer, so nothing outside the engine can write one without this grant. It's scoped to exactly this assembly — nothing else can reach those internals, and nothing in the engine itself names a relay, references one, or knows one exists. The relay server and the newfarm directory server are separate services; `RelayTransport` talks to the relay, `NewfarmHostMigration` talks to the directory, and neither runs as part of the other.

## Scope

This is the relay-plus-directory handover this transport ships: a room that moves and a coordinator that finds the new one. It is not a general engine-level host migration feature — no such feature exists yet outside this relay/directory pairing.
