---
title: "Controller retention"
---

> **Using Unity?** See [Keeping a player's objects across a disconnect](../../unity/control/controller-retention-in-unity.md).

Connection ids are recycled. An object left naming a departed controller is one the next renter of that id inherits, along with its state write permission and its input routing, because both are decided by the same comparison against `ControllerConnectionId`. Control is therefore always surrendered the moment a connection leaves - there is no configuration that keeps an object controlled by somebody who is gone. `ControllerRetentionPolicy` only decides whether a token is issued so the objects can be handed back to whoever comes next.

## Policy

`ControllerRetentionPolicy` has two values:

- `Release` (0) - the object is simply uncontrolled once its controller leaves, and nothing is remembered about who held it. This is the default: it costs nothing and cannot leak, because an object nobody is coming back for should not occupy a retention record.
- `Retain` (1) - the object is uncontrolled, and it joins the retention record the departing connection is issued a token for, so a returning player can be handed it back.

`SystemManager.ResolveControllerRetentionPolicy(NetworkSystem)` resolves the policy for one system, most specific first:

1. `NetworkSystem.ControllerRetentionPolicyOverride`, if set.
2. The system's group's override, if set.
3. `SystemManager.DefaultControllerRetentionPolicy` (`Release` by default).

A system and its group both leave their override unset by default, so an unconfigured world resolves to `DefaultControllerRetentionPolicy` on one comparison each.

## The token

`ControllerRetentionToken` is a readonly struct with `Id` and `Generation`, plus `IsValid` (true when `Id` is not the unset value). It is opaque: nothing in it addresses anything on the wire, it is meaningful only to the peer that issued it, and it is safe to store beside an account record. It is a token rather than the departed connection's id on purpose - ids are rented from a pool and handed out again, so a stored id would eventually name somebody else's retention. `Generation` is what makes a stale token fail rather than alias: a record's identifier reissued later is a different token, and only the current one resolves.

When a connection is first given control of something retained, the server reserves a token for it and delivers it once, reliably, over `ControllerRetentionTokenNotice`. On the client, `SystemManager.LocalControllerRetentionToken` holds the token reserved for this session, and `SystemManager.LocalControllerRetentionTokenReceived` fires when it arrives. That is the moment to persist it somewhere that outlives the session, because the connection carrying it is the one whose loss the token exists to survive.

## Reclaiming

`SystemManager.TryReclaimController(Connection connection, ControllerRetentionToken controllerRetentionToken)` hands a returning connection every object a retention record holds, and ends the record. It refuses only a token that does not resolve - a stale one, whose record expired, was evicted, or was already redeemed, returns `false` rather than a wrong answer. It does not check whether the returning peer is the same player; that question is the game's to answer before calling it.

Three events report what happens to a record over its lifetime:

- `ControllerRetained` - a record opened for a departing connection, raised only when at least one object was actually retained.
- `ControllerRetentionEnded` - a record stopped being redeemable, carrying the token and a `ControllerRetentionEndReason`.
- `ControllerRetentionAdopted` - a record standing after this peer adopted a dead host's world. It only means anything under host migration, which is planned but not yet built.

## Why every reason but Reclaimed leaves the objects uncontrolled

`ControllerRetentionEndReason` explains why a record stopped being redeemable:

- `Reclaimed` (0) - a returning connection redeemed the token and was handed the objects.
- `Expired` (1) - the record outlived `SystemManager.ControllerRetentionSeconds` without being redeemed.
- `Evicted` (2) - the record was the oldest standing when a new one needed room under `SystemManager.MaximumRetainedControllerRecords`.
- `Emptied` (3) - every object the record held left the world, so there was nothing left to redeem.

Every reason but `Reclaimed` leaves the objects uncontrolled and nothing relating them to one another. A handler that wants to act on a record's objects as a set - despawning a player's belongings when they don't return, for example - has to do it from `ControllerRetentionEnded`, before that reason takes effect.

## Limits

`SystemManager.ControllerRetentionSeconds` (default `DefaultControllerRetentionSeconds`, 120) is how long a record stays redeemable before it expires. Setting it to `SystemManager.UnlimitedControllerRetentionSeconds` (0) disables expiry entirely, leaving `MaximumRetainedControllerRecords` as the only bound.

`SystemManager.MaximumRetainedControllerRecords` (default `DefaultMaximumRetainedControllerRecords`, 64) is how many records may stand at once. Past that, the oldest standing record is evicted to make room for a new one - the most recent departure, which is the one most likely to come back, is kept redeemable.

## Security

The framework never decides that a returning peer is the same player who left. That is why a token is issued rather than an identity matched: `TryReclaimController` trusts whatever token it is handed and only refuses one that fails to resolve. Getting the token from a departed player back to the server is the game's business, not the engine's - present it through whatever channel the game's own authentication already trusts, and store it against a server-determined identity rather than in place of one. A server that accepts a token straight off the wire with no identity check behind it is trusting whatever a client hands it.

## Unity

Inspector fields for controller retention, and `NetworkPlayerDisconnectMode`, are covered on the Unity page: [Keeping a player's objects across a disconnect](../../unity/control/controller-retention-in-unity.md).

## Host migration

Controller retention is what lets a peer promoted after a host dies rebuild retained records from the objects it adopted, rather than losing them. Retention itself does not migrate a host - see [Surviving the loss of a host](../transports/hosting-topologies.md) for that.
