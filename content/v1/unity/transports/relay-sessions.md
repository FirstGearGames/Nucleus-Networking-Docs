---
title: "Testing host migration on one machine"
components: "LoopbackRelayNetworkTransport"
---

`LoopbackRelayNetworkTransport` lets you test host migration with two editors on one machine, with nothing to install or launch. It is for testing only. A shipped game uses the Steam transport instead.

## What it runs

While the scene plays, the main editor runs a relay inside its own process, on the loopback address. With host migration on, it also runs a newfarm directory beside it, which finds a session by its id and elects a new host when the old one goes. A ParrelSync clone runs neither and uses the main editor's.

No editor listens for another. Every editor connects out to the relay, and the one hosting is the one holding a room. The relay numbers rooms from 1 as it opens them.

| Field | Default | Purpose |
|---|---|---|
| Relay Hosting Enabled | on | Runs the relay, and the directory when host migration is on, in the main editor while the scene plays. |
| Relay Port | `47779` | TCP port the relay listens on. Every editor sharing the relay uses the same port. |
| Room Id | `1` | Room a client start joins when host migration is off. Joining by session id ignores it. |
| Is Host Migration Enabled | on | Registers the session with the directory so it survives losing its host. Needs Pro. |
| Directory Port | `47778` | UDP port the directory listens on. Shown only while host migration is on. |

If a port is already taken, for example by another project playing the same scene, the main editor logs a warning and uses whatever is already listening there. Stop the other project, or change both ports in every editor.

## It is for testing only

- The relay listens on the loopback address alone, so only editors and builds on this machine can reach it.
- It admits any process on this machine, with no authentication.
- Nothing starts the relay or the directory in a build.
- It shows that a handover works. It says nothing about how a session behaves on a lossy network.

## Test a handover with two editors

1. Add `LoopbackRelayNetworkTransport` to the `UnityCoreManager`'s GameObject, and leave **Automatic Start Mode** on the `UnityTransportManager` at `None`. The session calls start the server and client themselves.
2. Leave **Is Host Migration Enabled** on. It also sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld`, so a client keeps its world when the host drops. See [Keeping the world across a disconnect](../../core-api/core/retaining-the-world-across-a-disconnect.md).
3. Write a script that hosts in the main editor and joins in the clone, as below. Call `EnsureAddedAsync()` on the `UnityTransportManager` first, because the session calls refuse until the transport is added.
4. Open the scene in a ParrelSync clone. See [Test with two editors](../../start-here/testing-with-two-editors.md).
5. Press Play in the main editor first, so the relay and the directory are running, then in the clone.
6. Hand the session over by calling `TrySurrenderHostingSession()` on the host. Once the clone hosts, stopping play in it tests a lost host. Stopping play in the main editor ends the session for everybody instead, because it runs the relay and the directory.

```csharp
await unityTransportManager.EnsureAddedAsync();

// In the main editor:
bool isHosting = await loopbackRelayNetworkTransport.StartHostingSessionAsync();
ulong sessionId = loopbackRelayNetworkTransport.SessionId;

// In the clone, with the session id the main editor handed over:
bool isJoined = await loopbackRelayNetworkTransport.JoinSessionAsync(sessionId);
```

Pass the session id to the clone however suits the test, such as a file both editors read. In a game it travels through your own invite channel, such as a lobby or a friend list.

Once a peer hosts or joins, the component runs every handover itself. The elected peer adopts the world it was receiving and hosts it, and the others rejoin it by session id.

The `RelaySession` demo under `Demos/Transports` does all of this, and hands its session id over in a file.

## Hand out the session id, not the room

A room closes with the peer that opened it, so the room changes at every handover. The session id stays the same for the life of the session, so it is what players keep and share.

## Without host migration

With **Is Host Migration Enabled** off, or in a Free build, `StartHostingSessionAsync`, `JoinSessionAsync` and `TrySurrenderHostingSession` refuse with a logged error, and `SessionId` reads `UnsetSessionId` (`0`). Start the server through the `UnityTransportManager` instead, and start clients to join the room in **Room Id**.

## Ship on the Steam transport

The loopback relay never leaves this machine, so a shipped game needs a transport its players can reach. The Steam transport add-on, `SteamTransport`, reaches players by Steam ID or IP address and has the same `StartHostingSessionAsync`, `JoinSessionAsync`, `SessionId` and `TrySurrenderHostingSession`. It compiles when Steamworks.NET is installed. Its host migration is off by default, and it registers sessions with a newfarm directory at the address set on the component, so a shipped game runs a directory every player can reach.
