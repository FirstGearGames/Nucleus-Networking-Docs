---
title: "Hosting and joining a relay session"
---

> **Driving the core API directly?** See [The relay transport](../../core-api/transports/relay-transport).

## Hosting a session

Add `BlitzRelayTransport` to the `UnityCoreManager`'s GameObject and call `StartHostingSessionAsync()`. It opens a session, hosts it, and registers the room the relay names.

```csharp
bool isHosting = await blitzRelayTransport.StartHostingSessionAsync();
```

Once that returns `true`, read `RoomCode` and hand it to the players who will join directly:

```csharp
string roomCode = blitzRelayTransport.RoomCode;
```

`RoomCode` reads through to `RelayTransport.HostedRoomCode` on the underlying core transport once one exists, and falls back to the inspector-configured room otherwise. Either way, it is a room, not a session: see below for why that distinction matters past the first host.

## Joining a session

A joining peer can go one of two ways.

**By room code.** Set `RoomCode` before connecting, the same field a host leaves empty. This puts the joining peer straight into that room and nothing else.

**By session id.** Call `JoinSessionAsync(sessionId)`. It finds the session by its identifier and joins whatever room it currently lives in, wherever that is.

```csharp
bool isJoined = await blitzRelayTransport.JoinSessionAsync(sessionId);
```

`SessionId` gives you the id to distribute in the first place:

```csharp
ulong sessionId = blitzRelayTransport.SessionId;
```

It reads `SessionDirectoryUnset` (`0`) when this peer holds no session, which is the case whenever `IsHostMigrationEnabled` is off or hosting hasn't been started yet.

## Room code vs. session id

The room code names one room on the relay. Every handover moves the session to a new room, so a room code a player was handed goes stale the moment the host changes. The session id is a bearer token registered with the newfarm directory: it survives a handover because the directory, not the relay, is what a rejoining peer asks.

Give players a room code for a session that will never change host. Give them a session id for anything that might.

## Handing the room on

A host that means to leave without ending the match calls `SurrenderHostingSession()`:

```csharp
bool isSurrendered = blitzRelayTransport.SurrenderHostingSession();
```

This gives the session up to whoever the directory elects next, without leaving it and without stopping play. The component owns the coordinator that does this work, exposed as `Migration` (a `NewfarmHostMigration`). It drives the directory from the component's own `Update`, so nothing beyond starting a hosting session or joining one is required of the game; election, adoption and finding the session's new location all follow from that.

A surviving peer that is elected next adopts the world it had been receiving as its own and starts hosting it. A peer that only rejoins picks up the new host's room the same way it joined originally, through the session id.

## What the host-migration toggle does

`IsHostMigrationEnabled` (on by default) is what makes `Migration` exist at all; without it, `StartHostingSessionAsync`, `JoinSessionAsync` and `SurrenderHostingSession` all fail and log an error telling you to drive the CoreManager directly instead.

Turning it on also sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld` for you. That's a client-side setting: it decides, at the moment this peer's link to the authority drops, whether the world it received is thrown away or kept. Migration needs it kept, because the peer that gets elected next has to adopt what it was already receiving rather than starting from nothing.

`RetainReceivedWorld` is settable in a free build, but adopting the retained world is Pro-only. In a free build the setting has nowhere to go: nothing turns a retained world into a served one, so a free peer elected to host still starts empty.

Watch `SystemManager.RespawnWorldOnReconnectEnabled` too. If it's set, it defeats retention outright regardless of `DisconnectResetMode` - the world is dropped and rebuilt from the new authority's own account instead of kept.

## Services you have to run yourself

Neither ships in this repository:

- **The relay**, listening on UDP 7770, which needs a connection key (`BlitzRelayTransport`'s `_connectionKey` field/inspector setting) matching whatever the relay was configured with.
- **The newfarm directory**, listening on UDP 47778, which is what session ids and elections are resolved against.

Both addresses and ports are inspector fields on `BlitzRelayTransport` (`_relayAddress`/`_relayPort` and `_directoryAddress`/`_directoryPort`), defaulting to `127.0.0.1` and the ports above.
