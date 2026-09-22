---
title: "Keeping a player's objects across a disconnect"
---

> **Driving the core API directly?** See [Controller retention](../../core-api/control/controller-retention).

By default, a disconnecting player's object is despawned. Retention changes that: the object is left in the world, uncontrolled, and handed back to the same player if they reconnect before a record expires. Two components decide whether that happens and how long it lasts, and a third can override it per prefab.

## Unity System Manager: the project-wide default

The **Unity System Manager** component exposes three fields that configure `SystemManager` when the managers are instantiated:

- **Controller Retention Policy** — the retention policy applied to every controlled object whose system, and whose object, does not override it. Defaults to `ControllerRetentionPolicy.Release`, so retention is off project-wide until something turns it on.
- **Controller Retention Seconds** — how long a retained set stays redeemable, in seconds. Defaults to 120. Zero never expires it.
- **Maximum Retained Controller Records** — how many retained sets may stand at once before the oldest is evicted. Defaults to 64.

These three map straight onto `SystemManager.DefaultControllerRetentionPolicy`, `ControllerRetentionSeconds`, and `MaximumRetainedControllerRecords`.

## NetworkSystemObject: the per-prefab override

`NetworkSystemObject` carries its own retention toggle, for a prefab that needs to disagree with the project default. It has two fields:

- **the retention-override toggle** (`_controllerRetentionOverrideEnabled`) — off by default. Unity cannot serialize the absence of an enum value, so this toggle is what lets "inherit the manager's default" be told apart from "I have an opinion."
- **the policy field** (`_controllerRetentionPolicy`) — read only when the toggle is on, and it defaults to `ControllerRetentionPolicy.Retain` once enabled. That default is deliberate: a script that turns the toggle on is doing so to hold the object, not to restate the manager's `Release` default.

Turning the toggle on writes the policy to the object's system group (`ControllerRetentionPolicyOverride`) the first time the group is rented, so the override rides with every system the object's group carries, not with one system in isolation.

## NetworkPlayerSpawner: Disconnect Mode

`NetworkPlayerSpawner` has its own setting, **Disconnect Mode**, of type `NetworkPlayerDisconnectMode`:

- **`Despawn`** (default) — the player's object leaves the world with them. A returning player is always given a new one. Nothing is correlated, so there's nothing to hand to the wrong person.
- **`RetainForReturn`** — the player's object stays in the world, uncontrolled, and is handed back to the same player if they reconnect before the record lapses. The spawner marks every system it spawns `Retain`, and stores the retention token the departure issues against the connection's `Connection.Identity`. When that identity reconnects, the token is redeemed and the object is handed back through the same spawner.

An object whose record expires, is evicted, or is redeemed by someone else is despawned; nobody is coming back for it.

## The NAT warning

`RetainForReturn` is only as trustworthy as the identity behind it. The default `AddressClientAuthenticator` identifies a client by the address it connected from, and two players behind one NAT share that address. Under the default authenticator, `RetainForReturn` can hand the second player the first player's object. Use `RetainForReturn` only with an `IClientAuthenticator` that issues a real per-player identity.

## What none of this does on a client

Controller retention is server bookkeeping: the Unity System Manager fields, the `NetworkSystemObject` override, and the `NetworkPlayerSpawner` Disconnect Mode all govern what the server does when a controller disconnects. A plain client can have every one of these fields set — they're serialized on the prefab and the scene components either way — but none of them does anything on a client. A client never decides retention for an object it doesn't control the fate of.

## Where to go next

Tokens, the retention events, and reclaiming a retained object by hand are covered on the API page: [Controller retention](../../core-api/control/controller-retention).

This page does not cover host migration or world adoption. For what happens to retained objects when the host itself is lost, see [Surviving the loss of a host](../transports/surviving-the-loss-of-a-host).
