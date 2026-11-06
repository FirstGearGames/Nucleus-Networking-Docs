---
title: "What control means"
---

Every `NetworkSystem` answers three separate questions: who is the server, who controls it, and who observes it. Mixing them up causes bugs that work on one machine and fail over the network.

## Each system has a server, at most one controller and any number of observers

- **The server** is the peer where `NetworkSystem.IsServerStarted` is true. Its word on a system's state is final, whatever any client believes.
- **The controller** is the one connection, the server or a single client, that drives the system. At most one connection controls a system at a time, and if no client controls it, the server does. Check the local peer with `IsController`; see [Reading who controls a system](./controlling-a-system.md) for every `ControllerType` value.
- **An observer** is any peer the system is replicated to. A system can have any number of observers, including none. The interest system decides who observes; see [What area of interest is](../interest/area-of-interest.md).

```csharp
if (networkSystem.IsController(ControllerType.Client))
{
    // This peer is the client controlling this system.
}
```

## Only the server assigns a controller

The server assigns control with `SetController`. A client that calls it is rejected: the server logs an error and nothing changes. Every observer is told who the controller is, and `IsController` reads that replicated identity, never anything a client asserts about itself. A controller change raises `ControllerChanged`.

## Control decides who sends client state, who predicts and who sets members

These are controller-only, whatever the write-access setting:

- **Client state.** Only the controller's client state is accepted for the system.
- **Prediction.** The controlling client predicts the system from its own client state, and the server checks the result and corrects it when they differ. Any other client receives the server's state, and during a reconcile holds the system at the server's values while its own systems replay, unless it sets `NetworkSystem.IsObserverPredictionEnabled`.
- **Setting members.** The controller can always set members. The default access, `MemberWriteAccess.Controller`, allows the server or the controlling client. The Pro setting `MemberWriteAccess.AnyClient` widens this to other observers; see [Letting clients set members](../state/state-write-access.md).

Remote calls work the same way: `RpcSendAccess.Controller` is the default, so only whoever drives the object may ask it to do anything.

## A connection must observe a system before anything else is checked

When a client sets a member or makes a remote call, the server checks, in order:

1. Does the connection observe the system? If not, it is refused.
2. Is it the system's controller (`ControllerConnectionId`)? If so, it is admitted.
3. Otherwise it is admitted only when the access in force is the any-client one (`MemberWriteAccess.AnyClient` or `RpcSendAccess.AnyClient`).

A client that does not observe the system is refused even when it is the controller or the access allows any client.

## A host hides control bugs

A host runs the server and a client in one process. It is the server, it usually controls its own player object (so `IsController(ControllerType.Client)` is true), and interest never culls it, so it observes everything. One peer is all three roles at once, and every check above passes.

That hides bugs that appear as soon as a second machine joins: a missing observer registration, a write-access setting that was never exercised, or client state code that assumed the controller and the server were the same connection.
