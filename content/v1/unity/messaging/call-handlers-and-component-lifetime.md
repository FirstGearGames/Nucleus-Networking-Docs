---
title: "Registering Call Handlers Across a Component's Lifetime"
---

> **Driving the core API directly?** See [Handler Registration and Scope](../../core-api/messaging/rpc-handler-registration.md).

Register call handlers through `NetworkSystem.RegisterRpcHandler<T0>`, not `RpcManager`, so a handler runs only for calls addressed to that system. The system then unregisters the handler when it despawns, registers it again if it respawns, and drops it when the instance returns to the pool, so `OnDestroy` never needs `UnregisterRpcHandler`.

## Register in OnSystemLinked

In a script deriving from `NucleusBehaviour<TComponent0>`, register in `OnSystemLinked`:

```csharp
public class Beacon : NucleusBehaviour<BeaconComponent>
{
    protected override void OnSystemLinked()
    {
        NetworkSystem.RegisterRpcHandler<BeaconStrikeRpc>(OnBeaconStruck);
    }

    protected override void OnSystemUnlinked()
    {
        // Reset per-life state.
    }
}
```

Do not register in `Awake`. `NetworkSystem` is null until the system links, and a pooled instance is reactivated without running `Awake` again. `OnSystemLinked` runs on the first spawn and on every respawn after a pool return.

## Or subscribe to the marker's link events

A script that does not derive from `NucleusBehaviour` subscribes to the `NetworkSystemObject`'s events instead:

- `SystemsLinked` and `SystemsUnlinked` fire once for the object's whole set of systems. An ungrouped object fires on its first link; a grouped object fires when its linked count reaches the group's replicated member count. Use these for object-wide work.
- `SystemLinked` and `SystemUnlinked` fire once for each system as it links or unlinks, so several times on a `NetworkSystemGroup`.

If you subscribe to `SystemsLinked` after the object has already linked, your handler runs immediately. `SystemsUnlinked` does not do this: a late subscriber hears nothing until the next unlink.

```csharp
private void Awake()
{
    _networkSystemObject = GetComponent<NetworkSystemObject>();

    // Runs OnSystemsLinked at once if the object already linked before this Awake ran.
    _networkSystemObject.SystemsLinked += OnSystemsLinked;
    _networkSystemObject.SystemsUnlinked += OnSystemsUnlinked;
}

private void OnSystemsLinked(NetworkSystemObject networkSystemObject)
{
    if (!networkSystemObject.TryGetFirstSystem(out NetworkSystem system))
        return;

    system.RegisterRpcHandler<BeaconStrikeRpc>(OnBeaconStruck);
}

private void OnSystemsUnlinked(NetworkSystemObject networkSystemObject)
{
    // Reset per-life state here; a pooled, reactivated object never runs Awake again.
}

private void OnDestroy()
{
    if (_networkSystemObject != null)
    {
        _networkSystemObject.SystemsLinked -= OnSystemsLinked;
        _networkSystemObject.SystemsUnlinked -= OnSystemsUnlinked;
    }
}
```

`TryGetFirstSystem` returns the object's primary system, the one to scope object-wide work against.

Unsubscribe from the marker events in `OnDestroy`, as above. This matters most for a component on a different GameObject that can outlive the marker.

## Reach the manager from a plain MonoBehaviour

A script that is not a `NucleusBehaviour` gets the session through `NucleusUnity.BoundCoreManager`:

```csharp
CoreManager coreManager = NucleusUnity.BoundCoreManager;

if (coreManager is null)
{
    Debug.LogError("No bound CoreManager; the scene needs a UnityCoreManager.");
    enabled = false;
    return;
}
```

It is `null` until the session starts and is cleared when it ends. It never carries a previous play session's manager into the next one, even with domain reload disabled.
