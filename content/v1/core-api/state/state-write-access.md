---
title: "Letting clients write state"
---

## What write access controls

Every `NetworkSystem` has a `StateWriteAccess`, layered beside control rather than replacing it. The controller may always write state; access widens who else can, beyond the controller alone.

```csharp
public enum StateWriteAccess : byte
{
    Controller = 0,
    AnyClient = 2,
}
```

`Controller` is the default and the behavior every system had before write access existed: the server, or the single controlling client. `AnyClient` opens writes to the server and to any client that currently observes the system.

Ordinal 1 is deliberately vacant. `StateWriteAccess` is serialized into authored scenes, so renumbering `AnyClient` would silently reinterpret every scene that already carries a value of 1 as something else.

## Setting and reading access

The server sets access with `SetWriteAccess`:

```csharp
public bool SetWriteAccess(StateWriteAccess stateWriteAccess)
```

It's server-only; a client call is rejected. Widening a system's own permission state through a client call would make the permission client-settable, so the guard exists at the entry point rather than downstream. It also refuses to widen a system that holds a collection member (see below).

The current setting is readable from `WriteAccess`. On the client side, the read that matters is `CanLocalClientWriteState`: whether the authority most recently told this client it may write. It's a capability hint the authority pushes down, not something the client derives locally, and it's always `false` on the server.

## Access widens permission, it never replaces observation

`AnyClient` is scoped to observers, not to every client in the world. The eligibility test is always "does this connection observe the system" - asked under every access, controller included. A peer that has stopped observing has, by definition, stopped being told what the value is, so there's nothing it could honestly be writing against.

The consequence worth repeating: losing interest in a system silently removes write permission with it. `AnyClient` means you may write what you can see. Interest changes and write permission changes are the same event.

## What access does not change

`ControllerConnectionId` stays exclusive and server-assigned regardless of write access. Inputs, prediction, and reconcile remain controller-only whatever the access says - widening write access adds a path for state members, it doesn't touch control.

## Nothing travels as a grant

The authority enforces every write from its own copy of `WriteAccess`. A client is told only which access is in force and whether it personally may write (`CanLocalClientWriteState`); it is never handed anything resembling a permission token. A forged or replayed "I may write" claim from a client is inert, because the server never trusts the client's own read of its permission - it re-checks against `WriteAccess` on every incoming write.

## The echo-withholding window

A client that writes state upstream would otherwise receive its own write back as a correction and stutter on it. To prevent that, a losing or contested write is shown locally for a window before the authority's value is accepted:

```csharp
public uint StateWriteConvergenceDeadlineTicks = UnsetConvergenceDeadlineTicks;

public const uint UnsetConvergenceDeadlineTicks = uint.MaxValue;
```

Left at `UnsetConvergenceDeadlineTicks`, the deadline is derived from the connection's measured round-trip time rather than fixed. Set it explicitly per system when the default feel is wrong - a shared UI value and a contested physics object don't want the same answer. `StateWriteConvergenceDeadlineTicks` itself is declared alongside the widening logic, so this window exists only in a Pro build; a free build has no echo-withholding at all.

## Pro feature

Write access beyond `Controller`, and the echo-withholding window that goes with it, are Pro. The gate is structural: both live in `NetworkSystem.WriteAccess.Pro.cs`, split from the free-side `NetworkSystem.WriteAccess.cs`. A free build's eligibility check admits the controller alone, so `AnyClient` has no effect without Pro.

Two limits apply even with Pro:

- A system holding a collection member cannot be widened past `Controller`. `SetWriteAccess` rejects the call, because a client write to a collection arrives as an absolute with no operation log to relay to other observers.
- A client permitted to write on a system with more than one possible writer sends its members upstream as absolutes, not deltas. A member holds a single decode baseline, so two writers' deltas can't both reconstruct against it safely - only one sender per baseline can use the cheaper delta stream, and a multi-writer system gives that up.
