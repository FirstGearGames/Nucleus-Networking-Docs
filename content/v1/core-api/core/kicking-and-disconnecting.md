---
title: "Kicking and disconnecting a client"
---

## Kick a client from the server

```csharp
coreManager.ServerManager.KickClient(connection);

// With an explicit policy:
coreManager.ServerManager.KickClient(connection, KickOptions.BlockOutgoing);

// Shorthand on the Connection, with the default policy:
connection.Kick();
```

`KickClient` ignores a null `connection`, a `connection` whose `Transport` is already null (it is back in the pool), and a `connection` that already has a kick pending. It does not check that this peer is a server.

## KickOptions decides what stops before the kick runs

`KickOptions` is a `[Flags]` enum for what the server stops doing between marking the kick and running it:

| Value | Effect |
|---|---|
| `None` | Keep serving the client normally until the kick executes. |
| `PurgeOutgoing` | Discard the state of every kind and the remote calls already queued to the client. Messages already queued are kept, which is how a reason sent before the kick still reaches the client. |
| `BlockOutgoing` | Queue nothing further to the client: no state, no despawns, no recovery, no remote calls and no messages. |
| `BlockIncoming` | Discard everything received from the client instead of processing it. |
| `Default` | `PurgeOutgoing | BlockOutgoing | BlockIncoming`: the policy `KickClient(Connection)` and `Connection.Kick()` use. |

## Telling the client why

Pass a notice, any message type of your own, to the kick. The engine sends it on the reliable channel, then marks the kick:

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

Always pass the notice to the kick rather than sending it yourself: a message sent after `Kick()` is silently dropped. The notice overloads also take a policy: `KickClient<T0>(connection, notice, kickOptions)`.

- The notice is sent only if this call actually kicks. A kick against a client that already has one pending is ignored, notice and all.
- On the client, handle the notice with an ordinary message handler. It is dispatched before the client sees its own disconnect; see [Kick and refusal notices](./server-notices.md).
- The notice's type is how the client tells a kick from any other disconnect. Define one type per reason, or one type with a reason field.
- Leave the notice type's `IsAuthenticationRequired` at its default. Even a refused client reads a notice sent through `DenyClient` (see [Authenticating clients](./authentication.md)).

## The kick runs at the end of the frame, with a timeout

The policy applies at once. The disconnect runs once per frame at `LateSerialize`'s place in the loop, after that frame's messages are sent, so a notice has already gone out. A kick marked later in the frame (from a `TickAdvance` or `LateVariableUpdate` callback) runs on the next frame.

The transport then closes the link once the client has received what was already sent, so a client that receives its notice is normally gone almost at once. A client that never acknowledges is closed outright at the start of the first tick after the timeout, measured from the kick:

```csharp
public ulong KickTimeoutMilliseconds = 500;
```

`ServerManager.KickTimeoutMilliseconds` is the timeout every kick uses unless you pass one. On Synapse, keep your own timeout above 250 ms: Synapse resends a lost reliable message every 250 ms, so a shorter timeout can close the link before a lost notice is resent. To give one kick a different timeout:

```csharp
coreManager.ServerManager.KickClient(connection, KickOptions.Default, timeoutMilliseconds: 2000);
coreManager.ServerManager.KickClient(connection, new KickedNotice { Reason = "Server restarting." }, KickOptions.Default, timeoutMilliseconds: 2000);
connection.Kick(timeoutMilliseconds: 2000);
connection.Kick(new KickedNotice { Reason = "Server restarting." }, timeoutMilliseconds: 2000);
```

A marked kick cannot be stopped or loosened. A second kick against the same client is ignored, and the first policy and timeout stand. A client that leaves on its own before the kick runs is simply dropped from it.

## Read the pending state on the Connection

- `IsKickPending`: true from the moment the kick is marked until the connection closes.
- `PendingKickOptions`: the policy that was applied.
- `IsUsable`: true only while there is no pending kick and the remote or local state is connected. This one check covers a kicked or already disconnected peer.

## Violation kicks only run on a server

A violation that settles on the `Kick` action calls `ServerManager.KickClient` only when `IsServerStarted` is true. On a client it logs that the kick is not enforced instead. `KickClient` itself has no such check. See [Violations](../diagnostics/violations.md).
