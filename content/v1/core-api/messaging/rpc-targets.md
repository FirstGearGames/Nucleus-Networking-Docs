---
title: "Choosing Who Receives a Call"
---

## Name the recipients with RpcTarget

| Target | Reaches | Who may send it |
|---|---|---|
| `RpcTarget.Server` | The server, and nobody after it. | Client, including a host |
| `RpcTarget.Observers` | Every connection that observes the system. | Either peer |
| `RpcTarget.ObserversExcept(Connection excludedConnection, bool isControllerExcluded = false)` | Every observer except the named connection, and optionally except the system's controlling client. | Server |
| `RpcTarget.To(Connection connection)` | One named connection. | Either peer |

Building a target checks nothing. Sending from the wrong peer, such as a client using `ObserversExcept`, is refused at the send and the reason is logged.

## A client's call to other peers goes through the server

A client has no direct link to other clients, so the server handles each of its calls first:

- **`Observers`** from a client asks the server to fan the call out. The server admits it like any other client call, and a handler can still refuse it.
- **`To`** from a client names the recipient. The server runs its own handlers first, so it can refuse, then passes the call on. The recipient cannot tell it apart from a call the server addressed to it directly.
- **`Server`** is never forwarded. To reach other peers, address them with `Observers` or `To`.

Every client holds a `Connection` for every peer the server has reported, so `To` takes the connection itself, never an id.

A call from a client addressed the way only the server addresses calls is discarded and logged.
