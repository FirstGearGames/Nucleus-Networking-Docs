---
title: "ISessionHost"
---

`ISessionHost` is how [`NewfarmHostMigration`](./newfarm-host-migration.md) reaches the service a session runs over. The coordinator decides who hosts and tells every peer where the session went; a session host turns that into the service's own terms: hosting a session, naming where it can be reached, joining somebody else's, and leaving. Implement it to carry host migration over a service Nucleus does not cover.

It lives in `Nucleus.dll`, in the `Nucleus.Integrations.Newfarm` namespace.

## Shipped session hosts

| Session host | Service | `AdapterTag` | Credential |
|---|---|---|---|
| `LoopbackRelaySessionHost` | The loopback relay, for testing on one machine | `loopback-relay` | The room number. |
| `SteamSessionHost` | The Steam transport add-on | `steam-id` or `steam-ip` | The hosting account's Steam ID, or an address and port, depending on the transport's addressing. |

The Unity components `LoopbackRelayNetworkTransport` and `SteamTransport` create theirs for you.

## Members

| Member | What it must do |
|---|---|
| `AdapterTag` | Name the service. It is filed with every credential this publishes, so a peer handed a credential knows whether it can use it. Every peer in a session must answer the same tag. |
| `HostedCredential` | Return what another peer needs to reach the session this peer hosts, or an empty string when this peer is not hosting. It is strictly this peer's own: never the credential it used to join somebody else. |
| `IsHostingLinkUp` | Answer whether this peer's hosting side is up right now, meaning other peers can reach it. Read `false` rather than throw when there is nothing to ask. |
| `IsJoinedLinkUp` | Answer whether this peer's link to the current host is up. It is separate from `IsHostingLinkUp`: a peer just promoted has its hosting side up and its joined side down. Losing it is how a surviving peer learns its host is gone. |
| `Poll()` | Drive anything the service needs driving. It is called once per `NewfarmHostMigration.Poll()`. A service the engine's network loop already drives leaves it empty. |
| `StartHostingAsync(uint timeoutMilliseconds)` | Host the session on this peer. Return `Success` only once `HostedCredential` names where it is. A failure must leave nothing running. |
| `JoinAsync(string credential, uint timeoutMilliseconds)` | Leave whatever this peer was joined to, then join the session at the credential. |
| `StopHostingAsync()` | Stop hosting, leaving `HostedCredential` empty and `IsHostingLinkUp` false. |
| `LeaveAsync()` | Leave the joined session, leaving `IsJoinedLinkUp` false. |

A credential and an adapter tag can each be at most 64 characters, so check a long credential, such as a full IPv6 address and port, before hosting rather than after.

## Return the right SessionHostResult

| Value | Return it when |
|---|---|
| `Success` | The operation did what was asked. |
| `CredentialUnreachable` | From `JoinAsync` only: the service answered, and the answer was no. The session is not there, or will not take this peer. |
| `LocalFailure` | This peer could not do its part: the service was unreachable from here, the configuration was wrong, or the engine refused the state change. |

The difference matters. `CredentialUnreachable` is reported to the directory, which takes it as a sign the host may be gone. A `LocalFailure` is never reported, so a peer whose own setup is broken cannot get a healthy host replaced. When the service says nothing at all, return `LocalFailure`: a host that is truly gone stops answering the directory too.

## Rules every implementation follows

1. **The returned tasks never throw.** Report a failure as a `SessionHostResult`. The coordinator reads them from the game loop, and it treats a task that throws anyway as `LocalFailure` and logs it.
2. **The returned tasks complete on their own.** The coordinator only waits on them, so a handshake that needs polling to advance must drive itself.
3. **The returned tasks touch no engine state.** Adopting the world and starting the server happen on the thread that calls `Poll()`. A continuation can resume on another thread, so leave the engine alone in it.
4. **A host call can start while a join is still running.** A peer that asked to join can be elected to host before its join comes back, and the election wins. Anything you change for the length of one call, such as a borrowed timeout, has to survive the two overlapping.
