---
title: "Keeping a player's objects across a disconnect"
---

> **Driving the core API directly?** See [Controller retention](../../core-api/control/controller-retention.md).

By default, a disconnecting player's object stays in the world, uncontrolled, and nothing remembers who held it. With retention, the object is also held on a record and handed back to the same player if they reconnect before the record expires. An object whose record expires, is evicted or is redeemed by someone else is despawned.

These settings act only on the server. They do nothing on a client.

## Set the project default on Unity System Manager

Under **Controller Retention** on the **Unity System Manager**:

| Field | Default | Sets |
|---|---|---|
| **On Controller Disconnect** | `ControllerRetentionPolicy.Release` | `SystemManager.DefaultControllerRetentionPolicy`: the policy for every controlled object that does not override it. |
| **Retention Seconds** | 120 | `SystemManager.ControllerRetentionSeconds`: how long a retained set stays redeemable. Zero never expires. |
| **Maximum Retained Sets** | 64 | `SystemManager.MaximumRetainedControllerRecords`: how many retained sets may stand at once before the oldest is evicted. |

The last two are shown only while **On Controller Disconnect** is `Retain`.

## Override it per prefab on NetworkSystemObject

Turn on **Override On Disconnect** on a prefab's `NetworkSystemObject`, then set its **On Controller Disconnect**, which defaults to `ControllerRetentionPolicy.Retain`. The override (`ControllerRetentionPolicyOverride`) covers every system the object carries.

## Choose a Disconnect Mode on NetworkPlayerSpawner

**Disconnect Mode** (`NetworkPlayerDisconnectMode`) on `NetworkPlayerSpawner` decides what happens to the player objects it spawns, overriding the manager's default:

- **`Despawn`** (default): the object leaves with its player, and a returning player gets a new one.
- **`RetainForReturn`**: the object stays, uncontrolled, and is handed back through the spawner when the same `Connection.Identity` reconnects before the record lapses.

Use `RetainForReturn` only with an `IClientAuthenticator` that gives each player a real identity. The default `AddressClientAuthenticator` identifies a client by its address, and two players behind one NAT share an address, so the second can be handed the first player's object.

## Read further

- Tokens, the retention events and reclaiming an object by hand: [Controller retention](../../core-api/control/controller-retention.md).
- What happens to retained objects when the host itself is lost: [Surviving the loss of a host](../transports/hosting-topologies.md).
