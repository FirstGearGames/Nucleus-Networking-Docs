---
title: "Hosting and joining a relay session"
---

> **Driving the core API directly?** See [The relay transport](../../core-api/transports/relay-transport.md).

## Run the relay and the directory

Nucleus does not include either service, so run both yourself:

- **The relay**, listening on UDP 7770, with a connection key that matches **Connection Key** on `BlitzRelayTransport`.
- **The newfarm directory**, listening on UDP 47778, which resolves session ids and elections.

Their addresses and ports are fields on `BlitzRelayTransport`, defaulting to `127.0.0.1` and the ports above.

## Host a session

1. Add `BlitzRelayTransport` to the `UnityCoreManager`'s GameObject.
2. Call `StartHostingSessionAsync()`. It opens a session, hosts it and registers the room the relay names.
3. When it returns `true`, give joining players the `RoomCode` or the `SessionId`.

```csharp
bool isHosting = await blitzRelayTransport.StartHostingSessionAsync();

string roomCode = blitzRelayTransport.RoomCode;
ulong sessionId = blitzRelayTransport.SessionId;
```

`RoomCode` reads `RelayTransport.HostedRoomCode` on the core transport once one exists, and the inspector's **Room Code** otherwise. `SessionId` reads `SessionDirectoryUnset` (`0`) when this peer holds no session, which is the case while `IsHostMigrationEnabled` is off or before hosting starts.

## Join a session

- **By room code:** set `RoomCode` before connecting. The peer joins that room and nothing else.
- **By session id:** call `JoinSessionAsync(sessionId)`. It finds the session and joins whatever room it is in now.

```csharp
bool isJoined = await blitzRelayTransport.JoinSessionAsync(sessionId);
```

## Hand out a session id if the host can change

A room code names one room on the relay. Every handover moves the session to a new room, so a room code goes stale when the host changes. A session id is registered with the newfarm directory and survives a handover, because a rejoining peer asks the directory, not the relay.

Give players a room code only for a session that will never change host. Otherwise give them the session id.

## Hand hosting to another peer

To stop hosting without ending the match, call `TrySurrenderHostingSession()`. The session passes to whoever the directory elects next, and play does not stop.

```csharp
bool isSurrendered = blitzRelayTransport.TrySurrenderHostingSession();
```

The component runs the handover itself through `Migration`, a `NewfarmHostMigration` it drives from its own `Update`. Once your game starts hosting or joins, election, adoption and finding the session's new location need nothing more from it. The elected peer adopts the world it was receiving and hosts it. Other peers rejoin the new host's room through the session id, the same way they joined.

## Keep Host Migration on

`IsHostMigrationEnabled` (on by default) is what creates `Migration`. With it off, `StartHostingSessionAsync`, `JoinSessionAsync` and `TrySurrenderHostingSession` fail and log an error telling you to drive the `CoreManager` directly.

Turning it on also sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld`, so a client keeps the world it received when its link to the server drops. The elected peer needs that world to adopt it. `RetainReceivedWorld` can be set in a Free build, but adopting the retained world needs Pro, so the Blitz Relay and Newfarm Migration assemblies do not compile against a Free `Nucleus.dll`.

`SystemManager.RespawnWorldOnReconnectEnabled` changes only what happens when a client reconnects. The world is still kept when the link drops, and an elected peer still adopts it, but a peer that rejoins drops what it kept and rebuilds it from the new server instead of being relinked to it. That costs a spawn per object, and never keeps anything the new server does not know about.
