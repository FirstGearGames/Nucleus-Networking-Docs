---
title: "Player objects"
---

## NetworkPlayerSpawner gives every client one object of its own

On the server, `NetworkPlayerSpawner` spawns one prefab for each authenticated client, gives that client control of it, and remembers which object belongs to which connection. A player object is an ordinary networked object that one client controls; replication, interest, client state, write permission and controller retention all work as for any controlled object.

Only the server spawns. The spawner also gives an object to every client that authenticated before it existed, and does so again whenever this peer's server role starts. Losing the server role clears every connection-to-object record the spawner holds.

## Set it up in the inspector

- **Player Prefab** (`GameObject`): the networked prefab spawned for each client. It needs a `NetworkSystemObject`; without one, the spawner logs an error and disables itself.
- **Spawn Points** (`Transform[]`): the poses new objects are placed on, taken in turn and wrapping round. Leave it empty to spawn every player on the spawner's own transform.
- **Disconnect Mode** (`NetworkPlayerDisconnectMode`, default `Despawn`): what happens to a player's object when that player leaves.
  - `Despawn`: the object leaves with the player, and a returning player always gets a new one.
  - `RetainForReturn`: the object stays in the world, uncontrolled, and is handed back to the same player if they return before the retention record lapses. The spawner marks every system on the object `ControllerRetentionPolicy.Retain`. An object whose record expires, is evicted or empties is despawned then.

`RetainForReturn` matches a returning player by `Connection.Identity`, so it is only as trustworthy as that identity. The default `AddressClientAuthenticator` identifies a client by its address, which two players behind one NAT can share, so the second player could be handed the first player's object. Use an `IClientAuthenticator` that issues a real per-player identity with this mode.

## Find a player's object from code

```csharp
public bool IsServerStarted { get; }
public int PlayerObjectCount { get; }

public bool EnsurePlayerObject(Connection connection);

public bool TryGetPlayerObject(uint connectionId, out NetworkSystemObject playerNetworkSystemObject);
public bool TryGetPlayerObject(Connection connection, out NetworkSystemObject playerNetworkSystemObject);
```

- `EnsurePlayerObject` gives a connection its object. Calling it again for the same connection never spawns a second one: it first uses this spawner's record, then an object the connection already controls (after a world adoption), then a retention record redeemed by identity, and only then spawns.
- `TryGetPlayerObject` looks up by `Connection.Id` or by the `Connection`. It only answers for objects this spawner created or took over.
- `PlayerObjectCount` is how many clients this spawner holds an object for.

## React when a player gets or loses an object

```csharp
public event PlayerObjectSpawnedHandler PlayerObjectSpawned;
public event PlayerObjectReclaimedHandler PlayerObjectReclaimed;
public event PlayerObjectDespawnedHandler PlayerObjectDespawned;
```

- **`PlayerObjectSpawned(Connection connection, NetworkSystemObject playerNetworkSystemObject)`**: raised on the server when a client is given a new object, after it has been made the controller.
- **`PlayerObjectReclaimed(Connection connection, NetworkSystemObject playerNetworkSystemObject)`**: raised when a client is given an object that already existed, either redeemed from a retention record or already under its control after this peer adopted a world. The object keeps the state it had, so anything you reset for a fresh player must also run here and be safe on a used object.
- **`PlayerObjectDespawned(NetworkSystemObject playerNetworkSystemObject)`**: raised when a player object leaves the world, because its player left under `Despawn` or its retention record lapsed.

## Write your own spawner

Your own spawner needs two things:

1. On `ClientAuthenticated`, spawn your prefab, get its `NetworkSystemObject`, and give the client control:

```csharp
private void OnClientAuthenticated(Connection connection)
{
    // spawn your prefab, get its NetworkSystemObject, then:
    playerNetworkSystem.SetController(connection);
}
```

2. At startup, do the same for every connection that is already authenticated. `ClientAuthenticated` never fires for a client that authenticated before you subscribed, and an emulated or in-memory connection is authenticated as it connects without raising the event at all.
