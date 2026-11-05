---
title: "Assigning and releasing control"
---

> **Using Unity?** See [Giving a client control of an object](../../unity/control/transferring-control-in-unity.md).

## Assign control from the server

```csharp
public void SetController(Connection controllingClientConnection)
```

- Pass a `Connection` to make that client the controller, or `null` to return control to the server.
- Only a peer with a started server may call it. A client that calls it gets a logged error and nothing happens.
- Calling it with the current controller, or with `null` when the server already controls the system, does nothing.

Every peer learns of the change through ordinary replication. There is no message to send.

## The controller decides client state, prediction and write permission

Whether a connection holds `ControllerConnectionId` decides:

- **Client state routing**: whose client state the system applies.
- **Prediction**: whether this peer predicts the system locally.
- **Write permission**: the controller may always set members, whatever `MemberWriteAccess` says.

The server rejects a client write to a system the client does not control and raises an `UnauthorizedMemberChangeViolation`:

```csharp
public struct UnauthorizedMemberChangeViolation : IViolation
{
    public uint SystemId;
}
```

It is raised with `ViolationAction.Ignore`, because the usual cause is a race (control or permission changed before the client's earlier write landed), not an attack. The write is dropped and the connection is not punished.

## Retention decides what happens when the controller leaves

The server drops the departing connection's reference automatically. Whether the controlling identity is cleared at once or held for a returning connection to reclaim is set by [Controller retention](./controller-retention.md).
