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

## Tune how long a contested write shows locally

So that a client does not see its own write bounce back as a correction, a losing or contested write keeps showing locally for a window before the server's value is accepted. Set the window per system:

```csharp
public uint MemberWriteConvergenceDeadlineTicks = UnsetConvergenceDeadlineTicks;

public const uint UnsetConvergenceDeadlineTicks = uint.MaxValue;
```

Left at `UnsetConvergenceDeadlineTicks`, the window follows the connection's measured round-trip time. Set `NetworkSystem.MemberWriteConvergenceDeadlineTicks` when that feels wrong: a shared UI value and a contested physics object want different windows.

## Write access beyond the controller is Pro

`MemberWriteAccess`, `NetworkSystem.WriteAccess`, `NetworkSystem.TrySetWriteAccess` and the convergence window are Pro. In Free, code naming them does not compile, and only the controller writes.

Even with Pro:

- A system holding a collection member cannot be widened past `Controller`.
- A client write on a system with more than one possible writer costs more bandwidth than a write from a single controller.
