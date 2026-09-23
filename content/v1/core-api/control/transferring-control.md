---
title: "Assigning and releasing control"
---

> **Using Unity?** See [Giving a client control of an object](../../unity/control/transferring-control-in-unity.md).

## Assigning and releasing control

The server hands control of a `NetworkSystem` to a connection with `SetController`:

```csharp
public void SetController(Connection controllingClientConnection)
```

Pass a `Connection` to make that client the controller, or `null` to return control to the server. Only a peer with a started server may call it; a client that calls it gets a logged error and nothing happens - the call does not act on a non-server caller, it rejects it. An assignment that does not actually change the controlling identity queues nothing, so calling `SetController` with the current controller (or `null` when the server already controls it) is a no-op.

## What control gates

A single comparison - "does this connection hold `ControllerConnectionId`" - decides three separate things at once:

- **Input routing**: which connection's inputs the system applies.
- **Prediction**: whether this peer predicts the system locally at all.
- **State write permission**: the controller may always write state, regardless of `StateWriteAccess`.

They're decided by the same comparison because they describe the same relationship from three angles: the connection driving the object, the peer allowed to run it ahead of the network, and the peer allowed to tell the server what its state is. Splitting them would let a system take input from one connection while writing state for another, which is not a state Nucleus represents.

A client write for a system it does not control - or a client delta that isn't fully absolute, since a client's write always has to be - is rejected by the server and raised as an `UncontrolledStateChangeViolation`:

```csharp
public struct UncontrolledStateChangeViolation : IViolation
{
    public uint SystemId;
}
```

It's raised with `ViolationAction.Ignore`: the ordinary cause is a race (control or permission changing before the client's earlier write lands), not an attack, so the default response is to drop the write and move on rather than punish the connection.

## When the controller leaves

The server drops the departing connection's reference automatically; a system does not have to notice its controller leaving on its own. Whether the controlling identity itself is cleared right away or held for a returning connection to reclaim is a retention decision, not part of this page - see [Controller retention](./controller-retention.md) for holding a departed controller's objects.

## Replication

Control is not something game code sends. `SerializeControllerToObservers` writes the current controller and its retention token into the state stream for every delta and full observer, so every peer learns a controller change the same way it learns any other replicated state - no separate message, no extra call.
