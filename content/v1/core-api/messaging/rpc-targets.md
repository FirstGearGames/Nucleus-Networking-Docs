---
title: "Choosing Who Receives a Call"
---

## RpcTarget

`RpcTarget` names the recipients of a remote call. It is a struct with factory members, not an enum, because the targets do not all carry the same information — only a connection target needs a connection.

- `RpcTarget.Server` — the server itself, and nobody after it.
- `RpcTarget.Observers` — every connection that observes the system.
- `RpcTarget.ObserversExcept(Connection excludedConnection, bool isControllerExcluded = false)` — every observer except the named connection, and optionally except the system's controlling client.
- `RpcTarget.To(Connection connection)` — one named connection, from either peer.

The exclusions live on `ObserversExcept` rather than on the send call itself, because skipping a peer or the controller only means anything when fanning out. That keeps the whole question of who receives a call in a single argument.

### Server is a destination, not a first hop

`RpcTarget.Server` sends to the server and stops there. Nothing forwards a call sent this way. If a client wants the other peers watching the object to see something, it addresses them directly with `Observers` or `To`, and the server still decides whether that arrives by returning `RpcRelayAction.Cancel` from a handler that has read it.

### A target names recipients, it does not grant permission

Building an `RpcTarget` never checks who is allowed to use it. That check happens when the call is sent:

- `RpcTarget.Server` is a client's to use.
- `RpcTarget.ObserversExcept` is the server's alone.

A client that names `ObserversExcept` — or otherwise sends from the wrong peer — is refused at the send, and the reason is logged rather than thrown, since no legitimate engine path produces that call.

### A client's Observers request is admitted, not guaranteed

`RpcTarget.Observers` works from either peer, but the two directions are not identical. The server holds the observers and serves them directly. A client holds none, so sending with `Observers` is a request for a fan-out: the server admits it exactly as it admits any other client call, and a handler may still refuse it.

### To(Connection) names the recipient by reference

`RpcTarget.To(Connection connection)` reaches one connection from either peer. The server sends straight there. A client has no direct link to another client, so it names the recipient and the server passes the call on — running its own handlers first, so it can still refuse.

Either way the recipient is named by reference: every client holds a `Connection` for every peer the server has reported, so `To` never needs to look a peer up by id.

## RpcRoute on the wire

`RpcRoute` is what actually travels with the call, so the receiver can tell a legitimate call from one the sender was never entitled to make:

| Value | Meaning |
|---|---|
| `Server` | A client's call to the server itself, which stops there. |
| `Observers` | A call to every connection observing the system — sent by the server, or requested by a client. The one value legal in both directions, told apart by `Connection.IsServer` on the connection the call arrived on. |
| `Target` | The server's call to a single observing connection. |
| `TargetRelay` | A client's call to a single connection it named, which the server passes on once it admits it. |

`RpcRoute.Target` is server-only. One arriving from a client is discarded and logged rather than raised, because no engine path produces it — reaching it would mean forgery.

When the server passes a `TargetRelay` call on, it rewrites the route to `Target`. The recipient therefore cannot tell a call the server routed for a client from one the server addressed to it directly.
