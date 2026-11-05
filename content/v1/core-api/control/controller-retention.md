---
title: "Controller retention"
---

> **Using Unity?** See [Keeping a player's objects across a disconnect](../../unity/control/controller-retention-in-unity.md) for the inspector fields and `NetworkPlayerDisconnectMode`.

Control is always given up the moment a connection leaves. Connection ids are recycled, so an object still naming a departed controller would hand its write permission and client state routing to the next connection given that id. `ControllerRetentionPolicy` only decides whether the departing connection is issued a token so its objects can be handed back later.

## Choose Release or Retain

- `Release` (0), the default: the object is uncontrolled once its controller leaves, and nothing is remembered about who held it.
- `Retain` (1): the object is uncontrolled, and it joins the retention record the departing connection is issued a token for, so a returning player can be handed it back.

`SystemManager.ResolveControllerRetentionPolicy(NetworkSystem)` returns a system's policy, taking the first that is set:

1. `NetworkSystem.ControllerRetentionPolicyOverride`.
2. The override on the system's group.
3. `SystemManager.DefaultControllerRetentionPolicy` (`Release` by default).

Systems and groups leave their override unset by default.

## Save the token on the client

When a connection is first given control of something retained, the server delivers it a token once, reliably, over `ControllerRetentionTokenNotice`. On the client, `SystemManager.LocalControllerRetentionToken` holds it and `SystemManager.LocalControllerRetentionTokenReceived` fires when it arrives. Persist it then, somewhere that outlives the session.

`ControllerRetentionToken` is a readonly struct with `Id`, `Generation` and `IsValid` (true when `Id` is not the unset value). It is meaningful only to the peer that issued it and is safe to store beside an account record. A stale token fails to resolve instead of naming somebody else's record.

## Reclaim the objects with the token

```csharp
public bool TryReclaimController(Connection connection, ControllerRetentionToken controllerRetentionToken)
```

`SystemManager.TryReclaimController` hands the connection every object the record holds and ends the record. It returns `false` for a token that does not resolve: one whose record expired, was evicted or was already redeemed.

It does not check that the returning peer is the same player. Prove that first, through whatever channel your authentication already trusts, and store the token against a server-determined identity rather than in place of one. A server that accepts a token straight off the wire with no identity check behind it trusts whatever a client sends.

## Three events report a record's lifetime

- `ControllerRetained`: a record opened for a departing connection. Raised only when at least one object was retained.
- `ControllerRetentionEnded`: a record stopped being redeemable. Carries the token and a `ControllerRetentionEndReason`.
- `ControllerRetentionAdopted`: a record standing after this peer adopted a dead host's world. It only means anything under host migration, which is planned but not yet built.

## Only a reclaim returns the objects

`ControllerRetentionEndReason` says why a record ended:

- `Reclaimed` (0): a returning connection redeemed the token and was handed the objects.
- `Expired` (1): the record outlived `SystemManager.ControllerRetentionSeconds`.
- `Evicted` (2): the record was the oldest standing when a new one needed room under `SystemManager.MaximumRetainedControllerRecords`.
- `Emptied` (3): every object in the record left the world or was handed to another controller.

Every reason but `Reclaimed` leaves the objects uncontrolled and unrelated to one another. To act on a record's objects as a set, such as despawning a player's belongings when they don't return, do it in `ControllerRetentionEnded`, before the reason takes effect.

## Limit records by time and by count

- `SystemManager.ControllerRetentionSeconds` (default `DefaultControllerRetentionSeconds`, 120) is how long a record stays redeemable. `SystemManager.UnlimitedControllerRetentionSeconds` (0) disables expiry, leaving the record count as the only limit.
- `SystemManager.MaximumRetainedControllerRecords` (default `DefaultMaximumRetainedControllerRecords`, 64) is how many records may stand at once. Past that, the oldest is evicted, so the most recent departure stays redeemable.

## Retention does not migrate a host

Retention lets a peer promoted after a host dies rebuild retained records from the objects it adopted. Migrating the host itself is covered in [Surviving the loss of a host](../transports/hosting-topologies.md).
