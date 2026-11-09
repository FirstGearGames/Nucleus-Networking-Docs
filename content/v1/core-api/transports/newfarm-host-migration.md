---
title: "NewfarmHostMigration"
---

> **Using Unity?** `LoopbackRelayNetworkTransport` and `SteamTransport` create and poll a `NewfarmHostMigration` for you. See [Testing host migration on one machine](../../unity/transports/relay-sessions.md).

`NewfarmHostMigration` keeps a session going when the peer hosting it leaves. It registers the session with a newfarm directory, notices when the host goes, and then either takes the session over with the world this peer kept or rejoins the peer that did. Players find the session by a session id that stays the same for its whole life, while the address of whoever hosts it changes at every handover.

It lives in the `Nucleus.Integrations.Newfarm` assembly and needs Pro. It reaches the service the session runs over through an [`ISessionHost`](./session-hosts.md), so the same coordinator works over any service with one.

## What you need

- Pro. With a free `Nucleus.dll`, `StartHostingAsync` and `JoinAsync` refuse: they log an error, raise `Abandoned` and return `false`. `ServerManager.IsHostMigrationAvailable` says which you have.
- A newfarm directory server that every player can reach. Nucleus does not run one for you. In Unity, the loopback relay component runs one inside the main editor for testing.
- An `ISessionHost` for the service the session runs over.
- `ClientManager.DisconnectResetMode` set to `DisconnectResetMode.RetainReceivedWorld` on every peer, so a survivor still holds the world when its link drops. Set it before the first link comes up.

## Create one

```csharp
coreManager.ClientManager.DisconnectResetMode = DisconnectResetMode.RetainReceivedWorld;

NewfarmHostMigration hostMigration = new(coreManager, sessionHost, new IPEndPoint(directoryAddress, 47778));
```

The second constructor takes a `NewfarmClientConfig` instead of an endpoint, for when the directory's timings are not the defaults:

| Field | Default | Purpose |
|---|---|---|
| `HostHeartbeatIntervalMilliseconds` | `1000` | How often a hosting peer tells the directory it is still hosting. Keep it well under the directory's host timeout. |
| `WaiterHeartbeatIntervalMilliseconds` | `1000` | How often a waiting peer tells the directory it is still waiting. |
| `RequestRetryIntervalMilliseconds` | `500` | How often an unanswered request to the directory is repeated. |
| `UnreachableReportIntervalMilliseconds` | `5000` | The shortest time between two reports that this peer cannot reach the host. |

## Drive it

Call `Poll()` once a frame or once a tick, on the thread that drives the engine. Every event is raised from inside `Poll()`, and everything that touches the engine happens there too.

1. On the first host, call `StartHostingAsync()`. It opens a session with the directory, hosts it through the `ISessionHost`, and returns `true` once this peer is hosting.
2. Hand `SessionId` to the other players through your own channel, such as a lobby or an invite.
3. On every other peer, call `JoinAsync(sessionId)`. It asks the directory where the session lives and joins it. A peer can be elected to host while it is joining, which still returns `true`; read `State` to learn which it became.
4. Keep calling `Poll()` on every peer. When the host goes, the directory elects one survivor, which adopts the world it kept and hosts it, and the others rejoin it. Nothing else is needed from you.

When a host should leave without the session ending, call `TrySurrenderHosting()`. The directory elects someone else at once, and this peer rejoins as a client. When the match is over, call `CloseSession()` to end the session for everybody.

`Dispose()` releases the directory link. A hosting peer that is disposed surrenders the session rather than closing it, so the others carry on without it.

## Members

| Member | What it does |
|---|---|
| `StartHostingAsync(uint timeoutMilliseconds = DefaultTimeoutMilliseconds)` | Opens a session and hosts it on this peer. Returns `true` when this peer is hosting. |
| `JoinAsync(ulong sessionId, uint timeoutMilliseconds = DefaultTimeoutMilliseconds)` | Finds a session by its id and joins it, or hosts it if this peer is elected while asking. Returns `true` when this peer is in the session. |
| `TrySurrenderHosting()` | Hands the session to whoever the directory elects next and stays in it as a client. Returns `false` when this peer is not hosting. |
| `CloseSession()` | Ends the session for everybody. |
| `Poll()` | Drives the directory link and the session host, and watches for the host going. |
| `Dispose()` | Releases the directory link, surrendering the session first when this peer hosts it. |
| `State` | What this peer is doing about the session, as a `NewfarmMigrationState`. |
| `SessionId` | The session's id, or `UnsetSessionId` (`0`) while this peer holds none. Whoever holds it can join the session or be elected to host it, so share it with the players and nobody else. |
| `TimeoutMilliseconds` | How long a promotion or a rejoin that this peer runs on its own may take. Defaults to `DefaultTimeoutMilliseconds` (15000). |

## Events

| Event | When it is raised |
|---|---|
| `Promoting` | On the peer elected to take the session over, before it does. The session is not hosted again until the handler returns, so stand up anything the game needs here. |
| `Promoted(string credential)` | Once this peer hosts the session, with the credential its session host published. Look for the objects this peer now owns here, not on the server-started state change. |
| `Rejoined(string credential)` | On a surviving peer once it has rejoined the session where it moved. |
| `Abandoned(string reason)` | When the session cannot carry on for this peer: the directory refused it or did not answer in time, or this peer failed several times in a row to reach where the directory pointed. |

## States

| `NewfarmMigrationState` | Meaning |
|---|---|
| `Idle` | Holds no session. |
| `OpeningSession` | Waiting for the directory to open a session. |
| `Hosting` | Hosting the session. |
| `Joining` | Finding the session for the first time. |
| `Playing` | In the session as a client, watching for the host going. |
| `Waiting` | The host went, and this peer is waiting to be told who hosts next. |
| `Promoting` | Elected, and standing the session up. |
| `Abandoned` | No longer part of the session. |

## Things to know

- **The hosting peer runs the server half only.** Hosting and promotion start the server, not a client of it. Drive the host player's own objects as the server, or connect its client half yourself afterwards.
- **A promoted peer keeps the identifiers the world already had.** Players who rejoin find their objects in place, and controller retention, when it is on, hands each one back.
- **A survivor stays on the old host's world until it rejoins.** Between the host going and the new host taking over, a client receives nothing, so moving objects stop or drift. How long that lasts depends on how quickly the directory notices the host is gone.
