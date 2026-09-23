---
title: "What control means"
---

Every `NetworkSystem` has three questions attached to it: who is the server, who controls it, and who observes it. They are answered separately, and mixing them up is the most common source of "why did that work on my machine but not over the network" bugs.

## The three roles

**The server is the server.** `NetworkSystem` exposes `IsServerStarted` for this; the server's word on a system's state is final, whatever any client believes.

**The controller is the one connection - server or a single client - that drives the system.** Control is exclusive: at most one connection controls a given system at a time. `ControllerType` names who that can be:

```csharp
[System.Flags]
public enum ControllerType : byte
{
    None = 0,
    Server = 1 << 0,
    Client = 1 << 1,
    AnyController = Server | Client,
}
```

Ask which one applies to the local peer with `IsController`:

```csharp
if (networkSystem.IsController(ControllerType.Client))
{
    // This peer is the client controlling this system.
}
```

`ControllerType.Server`'s own meaning is exact: "the local peer is the server and no client controls the system." A system is never controller-less from the server's point of view - if no client controls it, the server does.

**An observer is any peer the system is replicated to.** Observation is separate from both of the above: the server and the controller are single, named connections, while a system can have any number of observers, including none.

## Control is exclusive and server-assigned

Only the server assigns a controller, through `SetController`. A client that calls it is rejected outright - the server logs an error and nothing changes. Control replicates from there: every observer is told who the controller is, and `IsController` reads that replicated identity rather than anything a client could assert about itself.

Because control is exclusive, a system is never controlled by two clients at once, and a controller change is a single, well-defined event (`ControllerChanged`) rather than a negotiation.

## What control decides

Three things ride on who the controller is, and all three are controller-only regardless of any write-access setting:

- **Who may send inputs.** Only the controller's inputs are accepted for the system.
- **Whose predicted members ride those inputs.** Prediction and reconcile are controller-only - a non-controlling observer never predicts or reconciles the system, it only receives the server's replicated state.
- **Who may write state by default.** `StateWriteAccess.Controller` - "the server, or the single controlling client" - is the default access, and it is also the behavior every system had before write access existed as a setting at all. The controller can always write state; widening that to other observers is a separate, additive Pro setting (`StateWriteAccess.AnyClient`), covered on [Letting clients write state](../state/state-write-access.md).

The same shape holds for RPCs: `RpcSendAccess.Controller` is the default there too, and its own doc comment puts it plainly - "only whoever drives the object may ask it to do anything."

## Observation is required under every check

Control and write access decide what a connection is *permitted* to do once it is already being told about the system. Being told about it - observation - is checked first, unconditionally, before either of them is consulted. The server asks the same three questions of a client's state write and of a client's remote call:

1. Does the connection observe the system? If not, it is refused.
2. Is it the system's controller (`ControllerConnectionId`)? If so, it is admitted.
3. Otherwise it is admitted only when the access in force is the any-client one (`StateWriteAccess.AnyClient` or `RpcSendAccess.AnyClient`).

State writes and remote calls both go through this same check. A client that does not observe a system fails it immediately, regardless of whether it is the controller or the write access has been widened to any client. Widening control or write access never substitutes for being an observer - a connection has to be told about a system before anything it does about that system means anything. Observation itself is decided by the interest system, covered on [What area of interest is](../interest/area-of-interest.md).

## The host case

A host runs the server and a client in the same process. That peer's `IsServerStarted` is true, so it is the server. If it also controls a given system - the ordinary case for a host's own player object - it satisfies `IsController(ControllerType.Client)` as well. And because a host holds every system in its own process, its own peer is exempt from being culled by interest: it observes everything by construction.

So on a host, one process can be server, controller and observer for the same system simultaneously. That collapses three checks that are independent everywhere else into one that always passes, which is exactly what hides the bugs that show up the moment a second machine joins: a missing observer registration, a write-access setting that was never actually exercised, an input path that assumed the controller and the server were the same connection. None of those fail on a host, because on a host they can't - there is only one peer to be all three roles at once.
