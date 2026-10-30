---
title: "Kicking and disconnecting a client"
---

## Kicking a client

`ServerManager.KickClient(Connection)` marks a connection for removal:

```csharp
coreManager.ServerManager.KickClient(connection);
```

An overload takes an explicit `KickOptions` policy:

```csharp
coreManager.ServerManager.KickClient(connection, KickOptions.BlockOutgoing);
```

`Connection` also exposes a shorthand that calls back into `ServerManager` under the default policy:

```csharp
connection.Kick();
```

`KickClient` refuses only three things: a null `connection`, a `connection` whose `Transport` is already null (it has already gone back to the pool, so there's nothing left to disconnect), and a `connection` that already has a kick pending. It does not check whether this peer is a server; see [Relation to the violation pipeline](#relation-to-the-violation-pipeline) below for where that check actually lives.

## KickOptions

`KickOptions` is a `[Flags]` enum governing what the server stops doing for a client during the window between the kick being marked and executed:

| Value | Effect |
|---|---|
| `None` | Keep serving the client normally until the kick executes. |
| `PurgeOutgoing` | Discard the state of every kind and the remote calls already queued to the client. Messages already queued are kept, which is how a reason sent before the kick still reaches the client. |
| `BlockOutgoing` | Queue nothing further to the client: no state, no despawns, no recovery, no remote calls and no messages. |
| `BlockIncoming` | Discard everything received from the client instead of processing it. The datagrams still arrive; the server just stops believing them. |
| `Default` | `PurgeOutgoing | BlockOutgoing | BlockIncoming`: the policy `KickClient(Connection)` and `Connection.Kick()` both use. |

## Telling the client why

A kick can carry a notice: any message type of your own that explains it. Pass it to the kick and the engine sends it on the reliable channel, then marks the kick:

```csharp
[NetworkType]
public struct KickedNotice : IMessage
{
    public string Reason;
}
```

```csharp
coreManager.ServerManager.KickClient(connection, new KickedNotice { Reason = "Idle for too long." });

// The same call through the Connection shorthand:
connection.Kick(new KickedNotice { Reason = "Idle for too long." });
```

The order is the reason these overloads exist. `BlockOutgoing` refuses every message queued after the kick is marked, and `PurgeOutgoing` keeps the messages already queued, so the notice has to be sent first. Writing the two calls by hand is easy to get backwards: a message sent after `Kick()` is silently dropped. Pass the notice to the kick and the order is always right.

The notice is sent only to a client this call actually kicks. A kick against a client that already has one pending is ignored, notice and all, so a client is never told two different reasons.

On the client, the notice arrives as an ordinary message, so you handle it with an ordinary message handler, and it is dispatched before the client sees its own disconnect (see [Kick and refusal notices](./server-notices.md)). The notice's type is how the client tells a kick from any other disconnect: define one type per reason you want to distinguish, or one type with a reason field, and register a handler for it. Give a notice type the default `IsAuthenticationRequired`; a client being kicked is already authenticated, and even a refused client reads a notice sent through `DenyClient` (see [Authenticating clients](./authentication.md)).

Every `KickClient` overload also takes a `KickOptions` policy, and the notice overloads take one too: `KickClient<T0>(connection, notice, kickOptions)`.

## When the kick actually runs

Marking a connection doesn't tear it down immediately. The policy applies at once, and the disconnect itself is queued and runs once per frame, at `LateSerialize`'s place in the network loop, after that frame's messages have been sent, so a notice has already gone out by the time the link is asked to close. A kick marked after that point (from a `TickAdvance` or `LateVariableUpdate` callback) runs on the next frame.

At that point the transport is asked to close the link once the client has received what was already sent to it, so a client that receives its notice is normally gone almost at once. A client that never acknowledges is bounded by a timeout: if the link is still open once the timeout has passed, measured from the kick, it is closed outright at the start of the next tick, before anything that tick receives is read.

```csharp
public ulong KickTimeoutMilliseconds = 500;
```

`ServerManager.KickTimeoutMilliseconds` is the timeout every kick uses unless you pass one. Keep a timeout of your own above 250 ms on Synapse: it resends a lost reliable message every 250 ms, so a shorter timeout can close the link before a lost notice is resent. To give one kick a different timeout, use an overload that takes it:

```csharp
coreManager.ServerManager.KickClient(connection, KickOptions.Default, timeoutMilliseconds: 2000);
coreManager.ServerManager.KickClient(connection, new KickedNotice { Reason = "Server restarting." }, KickOptions.Default, timeoutMilliseconds: 2000);
connection.Kick(timeoutMilliseconds: 2000);
connection.Kick(new KickedNotice { Reason = "Server restarting." }, timeoutMilliseconds: 2000);
```

Once marked, a kick cannot be stopped or loosened: a second kick against the same client is ignored, and the first policy and timeout stand. A client that departs on its own before the kick runs is simply dropped from it.

## Reading the pending state

Once a kick is marked, `Connection` exposes:

- `IsKickPending`: true from the moment the kick is marked until the connection closes.
- `PendingKickOptions`: the policy that was applied.
- `IsUsable`: true only while there's still a point acting on this connection: no pending kick, and a connected remote or local state. This is the one check that covers a kicked or already-disconnected peer in a single condition.

## Relation to the violation pipeline

The violation pipeline's own `Kick` action calls `ServerManager.KickClient` too, but gates it on `IsServerStarted` first — a violation that settles on `Kick` while running as a client (for example, an impossible acknowledgment from its own server) logs that the kick isn't enforced rather than kicking the server's connection out from under itself. That gate belongs to the violation pipeline, not to `KickClient`, which enforces no such check on its own. See the violations page for how actions are decided.
