---
title: "Testing host migration on one machine"
components: "LoopbackRelayNetworkTransport, LoopbackRelayHostMigration"
---

`LoopbackRelayNetworkTransport` and `LoopbackRelayHostMigration` let you test host migration with two editors on one machine, with nothing to install or launch. They are for testing only. A shipped game uses the Steam transport instead.

## The main editor runs the relay

While the scene plays, the main editor runs a relay inside its own process, on the loopback address. A second editor, either a ParrelSync clone or a Multiplayer Play Mode player, runs no relay and uses the main editor's.

`LoopbackRelayNetworkTransport`:

| Field | Default | Purpose |
|---|---|---|
| Relay Hosting Enabled | on | Runs the relay in the main editor while the scene plays. |
| Relay Port | `47779` | TCP port the relay listens on. Every editor sharing the relay uses the same port. |
| Room Id | `1` | Room a client start joins without host migration. Joining by session id ignores it. |

`LoopbackRelayHostMigration`, on the same GameObject:

| Field | Default | Purpose |
|---|---|---|
| Directory Address | `newfarm.nucleus-networking.com` | The newfarm directory the session registers with, which finds a session by its id and elects a new host when the old one goes. The public directory is free to use. Set `127.0.0.1` to have the main editor run a directory itself, with no internet connection needed. |
| Directory Port | `47778` | UDP port the directory listens on. |

If the relay's port is already taken, for example by another project playing the same scene, the main editor logs a warning and uses whatever is already listening there. Stop the other project, or change the port in every editor. The same goes for the directory's port when the main editor runs one.

## It is for testing only

- The relay listens on the loopback address alone, so only editors and builds on this machine can reach it.
- It admits any process on this machine, with no authentication.
- Nothing starts the relay or a directory in a build.
- It shows that a handover works. It says nothing about how a session behaves on a lossy network.

## Test a handover with two editors

1. Add `LoopbackRelayNetworkTransport` and `LoopbackRelayHostMigration` to the `UnityCoreManager`'s GameObject, and leave **Automatic Start Mode** on the `UnityTransportManager` at `None`. The session calls start the server and client themselves.
2. Having `LoopbackRelayHostMigration` there is what turns host migration on. It also sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld`, so a client keeps its world when the host drops. See [Keeping the world across a disconnect](../../core-api/core/retaining-the-world-across-a-disconnect.md).
3. Write a script that hosts in the main editor and joins in the clone, as below. Call `EnsureAddedAsync()` on the `UnityTransportManager` first, because the session calls refuse until the transport is added.
4. Open the scene in a ParrelSync clone. See [Test with two editors](../../start-here/testing-with-two-editors.md).
5. Press Play in the main editor first, so the relay is running, then in the clone.
6. Hand the session over by calling `TrySurrenderHostingSession()` on the host. Once the clone hosts, stopping play in it tests a lost host. Stopping play in the main editor ends the session for everybody instead, because it runs the relay.

When the handover works, the clone hosts the session and keeps every object the main editor had.

```csharp
await unityTransportManager.EnsureAddedAsync();

// In the main editor:
bool isHosting = await loopbackRelayHostMigration.StartHostingSessionAsync();
ulong sessionId = loopbackRelayHostMigration.SessionId;

// In the clone, with the session id the main editor handed over:
bool isJoined = await loopbackRelayHostMigration.JoinSessionAsync(sessionId);
```

Pass the session id to the clone however suits the test, such as a file both editors read. In a game it travels through your own invite channel, such as a lobby or a friend list.

Once a peer hosts or joins, the component runs every handover itself through a [`NewfarmHostMigration`](../../core-api/transports/newfarm-host-migration.md), which its `Migration` property returns. The elected peer adopts the world it was receiving and hosts it, and the others rejoin it by session id. A host that stops its server or quits hands the session on at once.

The `RelaySession` demo under `Demos/Transports` does all of this, and hands its session id over in a file.

## Hand out the session id, not the room

A room closes with the peer that opened it, so the room changes at every handover. The session id stays the same for the life of the session, so it is what players keep and share.

## Join a room directly without host migration

Without a `LoopbackRelayHostMigration`, the relay works by room: start the server through the `UnityTransportManager`, and start clients to join the room in **Room Id**. In a Free build the component is there but `StartHostingSessionAsync`, `JoinSessionAsync` and `TrySurrenderHostingSession` refuse with a logged error, and `SessionId` reads `UnsetSessionId` (`0`).

## Ship on the Steam transport

The loopback relay never leaves this machine, so a shipped game needs a transport its players can reach. The Steam transport add-on, `SteamTransport`, reaches players by Steam ID or IP address. Put a `SteamHostMigration` beside it, which has the same `StartHostingSessionAsync`, `JoinSessionAsync`, `SessionId` and `TrySurrenderHostingSession`. Both compile when Steamworks.NET is installed. Like every host migration component it registers with the public directory by default, and you can point it at your own.

## Carry sessions over another service

Every host migration component derives from `NetworkHostMigration`, which does everything a session needs except reach the service it is carried over. To carry sessions over another service, derive from it and return that service's [session host](../../core-api/transports/session-hosts.md) from `CreateSessionHost`. Override `GetDirectoryAddress` and `GetDirectoryPort` to read the directory from somewhere other than the inspector, and `OnPromoted`, `OnRejoined`, `OnAbandoned` and the other hooks to react to a handover.
