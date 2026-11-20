---
title: "Letting clients set members"
---

## Choose who may write a system's members

Every `NetworkSystem` has a `MemberWriteAccess`:

```csharp
public enum MemberWriteAccess : byte
{
    Controller = 0,
    AnyClient = 2,
}
```

- `Controller` (default): the server, or the single controlling client.
- `AnyClient`: the server, and any client that currently observes the system.

Write access adds writers; it does not change control. `ControllerConnectionId` stays exclusive and server-assigned, and client state, prediction and reconcile stay controller-only.

## Set access on the server

```csharp
public bool TrySetWriteAccess(MemberWriteAccess stateWriteAccess)
```

`TrySetWriteAccess` is server-only; a client call is rejected. It also refuses to widen a system that holds a collection member.

Read the current setting from `WriteAccess`. On a client, `CanLocalClientWriteMembers` says whether the server last told this client it may write. It is always `false` on the server.

The server checks every incoming write against its own `WriteAccess`. Nothing a client sends can widen what it may write.

## A client that stops observing cannot write

Every writer, the controller included, must observe the system. Losing interest in a system removes write permission at the same moment.

## How a client's write lands depends on the edition

Both editions have `AnyClient`. They differ in what a client that may write, but does not control the system, sees when it sets a member:

- **Pro:** the value changes on that client at once, and the server corrects it if it disagrees.
- **Free:** the write is a request. `Value` keeps its old value and no change callback fires on that client. The server applies the request under the same access check and validator as any write, and the result reaches the client like any other change, a round trip later. A request the server declines leaves nothing to undo.

`NetworkSystem.IsMemberWriteRequested` is `true` on a client whose writes are requests. The controller sets its own members at once in both editions. The Unity demo WriteRequests shows which way a client's writes land and how long each answer takes.

## A contested write shows locally until the server answers (Pro)

So that a client does not see its own write bounce back as a correction, a losing or contested write keeps showing locally until the server's answer has had time to arrive, then the server's value is accepted.

In Free a requesting client never shows a value the server has not sent, so there is nothing to hold.

## Limits

- A system holding a collection member cannot be widened past `Controller`.
- A client write on a system with more than one possible writer costs more bandwidth than a write from a single controller.
