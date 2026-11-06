---
title: "What control means"
---

> **Driving the core API directly?** See [What control means](../../core-api/control/the-control-model.md).

Every networked object answers three separate questions: who is the server, who controls it, and who observes it. Mixing them up causes bugs that work on one machine and fail over the network.

## Each object has a server, at most one controller and any number of observers

- **The server** is the peer where `NetworkSystem.IsServerStarted` is true. Its word on an object's state is final, whatever any client believes.
- **The controller** is the one connection, the server or a single client, that drives the object. If no client controls it, the server does. Check the local peer with `IsController`; see [Control in a Unity script](./control-in-unity-scripts.md).
- **An observer** is any peer the object is replicated to, decided by the interest system; see [What area of interest is](../interest/area-of-interest.md).

## Only the server assigns a controller

The server assigns control with `SetController`; see [Giving a client control of an object](./transferring-control-in-unity.md). A client that calls it is rejected: the server logs an error and nothing changes. `IsController` reads the controller the server replicated, never anything a client asserts about itself.

## Control decides who sends client state, who predicts and who sets members

These are controller-only, whatever the write-access setting:

- **Client state.** Only the controller's client state is accepted.
- **Prediction.** The controlling client predicts the object from its own client state, and the server checks the result and corrects it when they differ. Other clients receive the server's state and hold the object still during a replay, unless **Predicted By Observers** (`NetworkSystem.IsObserverPredictionEnabled`) is ticked on its `NetworkSystemObject`.
- **Setting members.** The default access, `MemberWriteAccess.Controller`, allows the server or the controlling client. The Pro setting `MemberWriteAccess.AnyClient` widens this to other observers; see [Letting clients set members](../../core-api/state/state-write-access.md).

Remote calls work the same way: `RpcSendAccess.Controller` is the default.

## A connection must observe an object before anything else is checked

When a client sets a member or makes a remote call, the server checks, in order:

1. Does the connection observe the object? If not, it is refused.
2. Is it the object's controller? If so, it is admitted.
3. Otherwise it is admitted only when the access is `MemberWriteAccess.AnyClient` or `RpcSendAccess.AnyClient`.

## Test control on a second machine, not only on a host

A host is the server, usually controls its own player object, and observes everything, so every check above passes there. Bugs such as a missing observer, an untested write-access setting or client state code that assumes the controller is the server only appear once a second machine joins.
