---
title: "Session events"
---

> **Using Unity?** See [Reacting to session events in Unity](../../unity/core/unity-session-events).

A session turns on four moments, spread across three managers. Each answers a different question, and each is raised at a specific point in a specific code path, not on a generic "something changed" tick.

## ServerManager.ClientAuthenticated

```csharp
public event ClientAuthenticatedHandler? ClientAuthenticated;
public delegate void ClientAuthenticatedHandler(Connection connection);
```

Raised on the server the moment a client is admitted, from inside `ApproveClient`. By the time it fires the connection is already marked authenticated and its `Connection.Identity` is stamped, so a handler can read both.

It is raised **before** the `AuthenticationResponse` is sent to the client and **before** the roster add is queued. Two things follow from that ordering:

- The client itself does not know it has been accepted yet (see `LocalClientAuthenticated` below), so nothing sent from here reaches it ahead of its own identity.
- Other clients have not been told this connection exists yet, because the roster add is queued after this event returns.

It is also not necessarily true yet that interest has registered the new connection as an observer of anything. `InterestManager` subscribes its own handler to `ClientAuthenticated` in `ManagersInstantiated`, so it runs whenever the framework happens to invoke subscribers, and it only registers the connection immediately when `Connection.CanReceiveState` is already true. A fresh remote client whose round trip has not been measured yet is instead queued into `InterestManager`'s internal wait set and registered a round trip later, once the transport's round-trip-time discovery fires. A host's own client is typically resolved immediately.

Either way, per-player setup done inside this handler is still tick-aligned with the roster: the roster add this connection is owed, and the roster add announcing it to everyone else, both ride the same tick's state stream regardless of when interest finishes registering it as an observer.

## ServerManager.ClientDisconnecting

```csharp
public event ClientDisconnectingHandler? ClientDisconnecting;
public delegate void ClientDisconnectingHandler(Connection connection);
```

Raised on the server for a client that has dropped, while the objects it controlled are still readable through it. It is raised from the release path — specifically from the same handler that is about to release the connection's controlled systems — immediately before that release runs, which is why a lookup of what the connection controlled still answers correctly here and not a line later.

Do not subscribe to a lower-level transport disconnect event expecting the same guarantee. Handler order between independent subscribers of a raw transport event is not something to rely on; `ClientDisconnecting` exists specifically because release itself is one of those subscribers, and this event is the one call site that can promise "before release" as a contract.

## ClientManager.LocalClientAuthenticated

```csharp
public event LocalClientAuthenticatedHandler? LocalClientAuthenticated;
public delegate void LocalClientAuthenticatedHandler(Connection localClientConnection);
```

The only moment a peer learns who it is. `Connection.Id` on the local client connection is `Connection.UnsetId` from the moment the socket connects until this fires. It is raised from inside the handler for the incoming `AuthenticationResponse` message, after the local connection's `Id` has been set to the server-assigned value and after it has been marked authenticated — both are true by the time a handler runs.

Raised identically on a host: the host's own client half receives the same response and adopts the same server-assigned identity, so a handler does not need to special-case which role it is running under.

## TransportManager.PeerConnectionDiscovered / PeerConnectionDropped

```csharp
public event PeerConnectionChangedHandler? PeerConnectionDiscovered;
public event PeerConnectionChangedHandler? PeerConnectionDropped;
public delegate void PeerConnectionChangedHandler(Connection connection);
```

These are about *other* peers, not this connection's own session. They fire once a `Connection` for that other peer becomes available or is about to go away, and they mean something different depending on role:

- On a client, `PeerConnectionDiscovered` fires from `TryAddPeerConnection` when the authority reports a new peer. The `Connection` handed out is a stand-in — an identity with no live link behind it (`Connection.IsPeerStandIn` is true).
- On a host, the same event fires from `RaiseHostPeerConnectionDiscovered`, called once the server side of `ApproveClient` has already admitted the peer. The `Connection` is the authority's own entry for that peer, so `IsPeerStandIn` is false. It is never raised for the host's own client, since no client is ever told about itself this way.

`PeerConnectionDropped` mirrors this exactly, firing from `TryRemovePeerConnection` on a client or `RaiseHostPeerConnectionDropped` on a host, in both cases while the entry is still held. Anything that referenced a stand-in must drop that reference inside this handler: the instance returns to its pool immediately afterward, and the next peer to connect can be handed that same object.

Unlike `ClientAuthenticated` and `ClientDisconnecting`, these two never fire for this peer's own session — they only ever describe someone else.

## Ordering on a host

A host runs the server and client halves of the session in one process, and that collapses steps that are two separate machines' worth of events on a dedicated server plus remote client.

For the host's own client connecting, `ApproveClient` raises `ClientAuthenticated` first, then sends the `AuthenticationResponse`. Because the host's connection to itself is marked as a loopback pair before that send, the response is delivered in-process immediately rather than crossing a socket — which means `LocalClientAuthenticated` fires synchronously inside that same send call, immediately after `ClientAuthenticated`, rather than a round trip later.

For a remote peer authenticating against a host, `ApproveClient` also ends by calling `RaiseHostPeerConnectionDiscovered` for that same connection. So `ClientAuthenticated` and `PeerConnectionDiscovered` both fire for that one peer, in that order, out of the same call — something a pure client never sees for itself, since a client only learns about a peer once a roster entry lands.

Disconnection follows the mirror shape: `ClientDisconnecting` is raised from the release path before a connection's controlled systems are released, and `PeerConnectionDropped` is raised (via `RaiseHostPeerConnectionDropped`, host only, and never for the host's own client) out of the same connection-state-changed handling that release runs from.

## What's safe inside each raise

| Event | Safe here | Defer instead |
|---|---|---|
| `ClientAuthenticated` | Read `Connection.Identity`; do per-connection setup — it is still tick-aligned with the roster add queued right after. | Anything that assumes the connection is already a registered observer; that may not be true until a round trip later. |
| `ClientDisconnecting` | Look up what this connection controlled or owned; nothing has released yet. | Anything that depends on the connection's controlled systems already being gone — release runs immediately after this returns. |
| `LocalClientAuthenticated` | Read this peer's own `Connection.Id` for the first time; anything scoped to "who am I". | Assuming the roster of other peers has already arrived; it rides the state stream separately. |
| `PeerConnectionDiscovered` | Store a reference to the peer's `Connection` for later use. | — |
| `PeerConnectionDropped` | Drop every stored reference to this peer's `Connection`. | Holding onto it past this handler — the instance is pooled and reused right after. |
