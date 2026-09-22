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

`KickClient` refuses only two things: a null `connection`, and a `connection` whose `Transport` is already null (it has already gone back to the pool, so there's nothing left to disconnect). It does not check whether this peer is a server — see [Relation to the violation pipeline](#relation-to-the-violation-pipeline) below for where that check actually lives.

## KickOptions

`KickOptions` is a `[Flags]` enum governing what the server stops doing for a client during the window between the kick being marked and executed:

| Value | Effect |
|---|---|
| `None` | Keep serving the client normally until the kick executes. |
| `PurgeOutgoing` | Discard everything already queued to the client — every kind of state, and messages queued before the kick was marked. Anything sent after the mark is unaffected. |
| `BlockOutgoing` | Queue no further state to the client: no deltas, no fulls, no despawns, no recovery. Messages are exempt, so the server can still send a reason. |
| `BlockIncoming` | Discard everything received from the client instead of processing it. The datagrams still arrive; the server just stops believing them. |
| `Default` | `PurgeOutgoing \| BlockOutgoing \| BlockIncoming` — the policy `KickClient(Connection)` and `Connection.Kick()` both use. |

## Telling the client why

Sending a reason has to happen after the kick is marked, not before, because `PurgeOutgoing` discards anything already queued. `Connection` has an overload for exactly this:

```csharp
public void Kick<T0>(T0 notice) where T0 : IMessage, new()
```

It calls `Kick()` first, then sends `notice` as an ordinary reliable message. It reaches the client because `SendMessage` is exempt from `BlockOutgoing` — the one thing still allowed out during a pending kick. `notice` is a regular message type, not a server notice; see the messages page for how to define one and pass an instance here.

Writing the two calls by hand instead is easy to get backwards: a message sent before the kick is marked survives the mark itself, but a message sent after `PurgeOutgoing` runs is silently discarded rather than refused.

## Reading the pending state

Once a kick is marked, `Connection` exposes:

- `IsKickPending` — true from the moment the kick is marked until the connection closes.
- `PendingKickOptions` — the policy that was applied.
- `IsUsable` — true only while there's still a point acting on this connection: it requires a live `Transport`, no pending kick, and a connected remote or local state. This is the one check that covers a kicked, transportless, or already-disconnected peer in a single condition.

## When the kick actually runs

Marking a connection doesn't tear it down immediately. Kicks are queued and executed by `ExecutePendingKicks`, which runs at the `LateVariableUpdate` network loop step — after that tick's messages have serialized, so a reason sent during the same tick the kick was marked has already gone out by the time the connection closes.

A second kick against a connection that already has one pending is ignored; the policy from the first call stands.

## Relation to the violation pipeline

The violation pipeline's own `Kick` action calls `ServerManager.KickClient` too, but gates it on `IsServerStarted` first — a violation that settles on `Kick` while running as a client (for example, an impossible acknowledgment from its own server) logs that the kick isn't enforced rather than kicking the server's connection out from under itself. That gate belongs to the violation pipeline, not to `KickClient`, which enforces no such check on its own. See the violations page for how actions are decided.
