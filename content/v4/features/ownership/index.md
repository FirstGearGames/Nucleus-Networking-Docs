---
title: "Ownership"
---
## What is Ownership?

Ownership is a core concept in Fish-Net, determining which client has control over an object.

Every `NetworkObject` in Fish-Net can be assigned a client to own it, or the object can have no assigned owner. The server is exclusively responsible for changing ownership of objects, even though it cannot own an object itself.

When a client owns an object, they are considered its rightful user, capable of actions like moving a character or using a weapon. Ownership can also be temporarily granted for interactions with world objects, such as using a turret.

Ownership checks are essential for ensuring proper control over objects. Common scenarios include:

- Validating if a client can manipulate an object.
- Checking ownership status for player-related values like name or score.
- Ensuring only the owner executes specific network calls (e.g., `ServerRpc`s).

## Assigning Ownership

Ownership can be granted in several ways:

**Spawning with Ownership:** When creating an object, ownership can be assigned to a specific connection.

```csharp
GameObject go = Instantiate(_yourPrefab);
InstanceFinder.ServerManager.Spawn(go, ownerConnection);
```

**Changing or Adding Ownership:** If an object is already spawned, ownership can be modified at any time. Previous owners are replaced with the new owner.

```csharp
networkObject.GiveOwnership(newOwnerConnection);
```

**Removing Ownership:** Ownership can be revoked from a client when needed.

```csharp
networkObject.RemoveOwnership();
```

> **Tip:** `ownerConnection` and `newOwnerConnection` above represent a `NetworkConnection` that will be set as the new owner.

## Checking Ownership

Ownership can be verified via the following `NetworkObject` or `NetworkBehaviour` properties:

```csharp
base.IsOwner;     // Returns true if the local client owns the object.
base.Owner;       // Retrieves the current owner NetworkConnection.
base.IsController; // True if the local client owns the object or is the server with no assigned owner.
```

## Simple Movement Example

A client must own an object to execute certain actions. Below is an example of movement logic restricted to the object's owner:

```csharp
void Update()
{
    // The client's game instance will have several player objects in it if there
    // are multiple players playing, but he will only own one of them and should
    // only move the one that he owns.
    if (base.IsOwner)
    {
        float hor = Input.GetAxisRaw("Horizontal");
        float ver = Input.GetAxisRaw("Vertical");
        transform.position += new Vector3(hor, 0f, ver);
    }
}
```

When paired with a Network Transform set to Client Authoritative, this movement will be relayed to the server and synchronized across all clients.

## Transferring Ownership

Only the server can assign, transfer, or remove ownership. Typically, ownership is granted when spawning an object.

**Automatic Ownership Assignment:** The `PlayerSpawner` script (found in the NetworkManager prefab) ensures the spawned player object is owned by its respective client.

**Immediate Ownership:** In cases where a client needs immediate ownership — such as controlling a turret without delay — the `PredictedOwner` component can be used. This component can be extended for customized logic.
