---
title: "Letting clients set members"
---

## What write access controls

Every `NetworkSystem` has a `MemberWriteAccess`, layered beside control rather than replacing it. The controller may always set members; access widens who else can, beyond the controller alone.

```csharp
public enum MemberWriteAccess : byte
{
    Controller = 0,
    AnyClient = 2,
}
```

`Controller` is the default: the server, or the single controlling client. `AnyClient` opens writes to the server and to any client that currently observes the system.

## Setting and reading access

The server sets access with `TrySetWriteAccess`:

```csharp
public bool TrySetWriteAccess(MemberWriteAccess stateWriteAccess)
```

It's server-only; a client call is rejected. Widening a system's own permission state through a client call would make the permission client-settable, so the guard exists at the entry point rather than downstream. It also refuses to widen a system that holds a collection member (see below).

The current setting is readable from `WriteAccess`. On the client side, the read that matters is `CanLocalClientWriteMembers`: whether the server most recently told this client it may write. It's a capability hint the server pushes down, not something the client derives locally, and it's always `false` on the server.

## Access widens permission, it never replaces observation

`AnyClient` is scoped to observers, not to every client in the world. The eligibility test is always "does this connection observe the system" - asked under every access, controller included. A peer that has stopped observing has, by definition, stopped being told what the value is, so there's nothing it could honestly be writing against.

The consequence worth repeating: losing interest in a system silently removes write permission with it. `AnyClient` means you may write what you can see. Interest changes and write permission changes are the same event.

## What access does not change

`ControllerConnectionId` stays exclusive and server-assigned regardless of write access. Client state, prediction, and reconcile remain controller-only whatever the access says - widening write access adds a path for setting members, it doesn't touch control.

## Nothing travels as a grant

The server checks every incoming write against its own copy of `WriteAccess`. A client is told only which access is in force and whether it personally may write (`CanLocalClientWriteMembers`), and nothing a client sends can widen what it may write.

## The echo-withholding window

A client that sets a member would otherwise receive its own write back as a correction and stutter on it. To prevent that, a losing or contested write is shown locally for a window before the server's value is accepted:

```csharp
public uint MemberWriteConvergenceDeadlineTicks = UnsetConvergenceDeadlineTicks;

public const uint UnsetConvergenceDeadlineTicks = uint.MaxValue;
```

Left at `UnsetConvergenceDeadlineTicks`, the deadline is derived from the connection's measured round-trip time rather than fixed. Set it explicitly per system when the default feel is wrong - a shared UI value and a contested physics object don't want the same answer. This window exists only in a Pro build; a free build has no echo-withholding at all.

## Write access beyond the controller ships only in Pro

Write access beyond `Controller`, and the echo-withholding window that goes with it, are Pro. `MemberWriteAccess` itself, `NetworkSystem.WriteAccess` and `NetworkSystem.TrySetWriteAccess` are Pro-only too, so a free build has none of them and code naming them does not compile. A free build's eligibility check admits the controller alone.

Two limits apply even with Pro:

- A system holding a collection member cannot be widened past `Controller`. `TrySetWriteAccess` rejects the call.
- A client write on a system with more than one possible writer costs more bandwidth than a write from a single controller.
