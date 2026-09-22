---
title: "Player objects"
---

## What it does

`NetworkPlayerSpawner` is a `MonoBehaviour` that gives every authenticated client one object of its own. On the server it spawns one prefab per client, hands that client control of the spawned object, and keeps a connection-to-object relationship so the rest of the game can ask which object belongs to whom.

The engine itself has no player concept, and this component does not add one. A player object is an ordinary networked object that happens to be controlled by one client, so everything the engine already does for a controlled object — replication, interest, input routing, write permission, controller retention — applies unchanged. What this component adds is the one decision the engine deliberately leaves out: whether an object needs creating for a given client at all.

Only the server spawns. The component observes its role from the transport (`IsServerStarted`) rather than assuming it, because a server start can fail.

## Inspector fields

- **Player Prefab** (`GameObject`) — the networked prefab spawned for each client. It needs a `NetworkSystemObject` marker; without one, `Awake` logs an error and disables the component.
- **Spawn Points** (`Transform[]`) — poses new objects are placed on, taken in turn and wrapping when exhausted. Leave this empty to spawn every player on the spawner's own transform.
- **Disconnect Mode** (`NetworkPlayerDisconnectMode`) — what happens to a player's object when that player's connection leaves. Defaults to `Despawn`.

## Disconnect modes

`NetworkPlayerDisconnectMode` has two values:

- **`Despawn`** (the default) — the player's object leaves the world with them, and a returning player is always given a new one. Needs no identity worth trusting, since every join is a first spawn.
- **`RetainForReturn`** — the player's object stays in the world, uncontrolled, and is handed back to the same player if they return before the retention record lapses. The spawner marks every system on the object `ControllerRetentionPolicy.Retain`, stores the token the departure issues against `Connection.Identity`, and redeems it when that identity returns. An object whose record expires, is evicted, or empties is despawned at that point.

`RetainForReturn` is only as trustworthy as the identity behind it. The default `AddressClientAuthenticator` identifies a client by the address it connected from, which two players behind one NAT can share — under it, this mode can hand the second player the first player's object. Use an `IClientAuthenticator` that issues a real per-player identity if you turn this on.

## API

```csharp
public bool IsServerStarted { get; }
public int PlayerObjectCount { get; }

public bool EnsurePlayerObject(Connection connection);

public bool TryGetPlayerObject(uint connectionId, out NetworkSystemObject playerNetworkSystemObject);
public bool TryGetPlayerObject(Connection connection, out NetworkSystemObject playerNetworkSystemObject);
```

`EnsurePlayerObject` is the only route to an object, and it is idempotent: a client that already holds one is a no-op, not a second spawn. It resolves in order — this spawner's own record, then whatever the connection already controls (the case after a world adoption), then a retention record redeemed by identity, and only then a fresh spawn. Call it as often as you want; asking twice for the same connection never produces a second object.

`TryGetPlayerObject` has two overloads: by connection identifier (`Connection.Id`) or by the `Connection` itself. Both only answer for objects this spawner created or took responsibility for.

`PlayerObjectCount` is how many clients this spawner currently holds an object for.

## Events

```csharp
public event PlayerObjectSpawnedHandler PlayerObjectSpawned;
public event PlayerObjectReclaimedHandler PlayerObjectReclaimed;
public event PlayerObjectDespawnedHandler PlayerObjectDespawned;
```

- **`PlayerObjectSpawned(Connection connection, NetworkSystemObject playerNetworkSystemObject)`** — raised on the server when a client is given a newly created object, after that client has been made its controller.
- **`PlayerObjectReclaimed(Connection connection, NetworkSystemObject playerNetworkSystemObject)`** — raised when a client is given an object that already existed, whether redeemed from a retention record or found already under that client's control after this peer adopted a world. The object carries whatever state it had when its previous controller left, so anything a game resets for a fresh player has to run here too, and has to be safe to run on a used object.
- **`PlayerObjectDespawned(NetworkSystemObject playerNetworkSystemObject)`** — raised when a player object leaves the world, whether because its player left under `NetworkPlayerDisconnectMode.Despawn` or because the retention record holding it lapsed unredeemed.

## The adopt pass

`Awake` resolves the component's managers from the bound `CoreManager`, subscribes to `ClientAuthenticated` and the connection state-change events, and then — only if `IsServerStarted` is already true — sweeps every currently active, authenticated client and calls `EnsurePlayerObject` on each.

That sweep exists because an event does not fire retroactively. A peer that was a client before it became the server already holds connections that authenticated before this component's subscription existed, and an emulated or in-memory connection is authenticated the moment it connects, never passed to the authenticator, so it raises no event at all. Without the adopt pass those clients would never be given an object. The same sweep runs again whenever the local connection's server role turns on, and losing that role clears every relationship this spawner is holding, since the objects belonged to the session that just ended.

## Writing your own spawner

`NetworkPlayerSpawner` adds nothing the engine doesn't already support — it just makes the per-joining-client decision for you. Writing your own is the same two calls:

```csharp
private void OnClientAuthenticated(Connection connection)
{
    // spawn your prefab, get its NetworkSystemObject, then:
    playerNetworkSystem.SetController(connection);
}
```

plus the adopt-pass sweep over already-authenticated connections at startup, for the same reason: an event you subscribe to in `Awake` never fires for a client that authenticated before your component existed.
