---
title: "Registering Call Handlers Across a Component's Lifetime"
---

> **Driving the core API directly?** See [Handler Registration and Scope](../../core-api/messaging/rpc-handler-registration).

## The marker's link events

`NetworkSystemObject` is the component that correlates a GameObject with its networked system. It raises two pairs of events as that correlation forms and breaks:

- `SystemLinked` / `SystemUnlinked` fire for each individual system as it links or unlinks. A `NetworkSystemGroup` can put several systems on one GameObject, and these fire once per member.
- `SystemsLinked` / `SystemsUnlinked` fire once for the object's whole set: an ungrouped object is a batch of one and fires on its first link, a grouped object fires when its linked count reaches the group's replicated member count.

For a component that wants to act on the object as a whole, rather than on one member of a group, `SystemsLinked` and `SystemsUnlinked` are the pair to use. There's a further reason `SystemsLinked` in particular is the safer subscription: its `add` accessor checks `IsLinkedBatchComplete()` and, if the object is already complete, invokes the handler immediately on the new subscriber. A component that wakes after the object has already linked doesn't miss the event, it's replayed. `SystemsUnlinked` has no such replay, it's a plain event, so a subscriber that joins after the object has already unlinked hears nothing until the next unlink.

```csharp
private void Awake()
{
    _networkSystemObject = GetComponent<NetworkSystemObject>();

    // Replays at once if the object already linked before this Awake ran.
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

`TryGetFirstSystem` resolves the object's primary system, the canonical member to scope object-wide work against, which is why it's the call a `SystemsLinked` handler reaches for.

## The NucleusBehaviourBase alternative

A script deriving from `NucleusBehaviour<TComponent0>` (which itself derives from `NucleusBehaviourBase`) doesn't subscribe to the marker's events by hand. It requires its system on `Awake`, and the base class calls `OnSystemLinked` and `OnSystemUnlinked` for it as that system links and unlinks:

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

A call handler belongs in `OnSystemLinked`, not `Awake`. `Awake` runs once per GameObject instantiation, but a pooled instance is reactivated without a second `Awake` running at all, its next life begins from `OnEnable`. `OnSystemLinked`, by contrast, fires every time this behaviour's system links, on the first spawn and on every respawn after a pool return. Registering there is also naturally scoped to a live `NetworkSystem`: `NetworkSystem` is null before the system links, so a handler registered in `Awake` would have nothing to register against yet on the very first life.

## Why NetworkSystem.RegisterRpcHandler, not the RpcManager overload

Both the marker-event and the `NucleusBehaviourBase` examples above register through `NetworkSystem.RegisterRpcHandler<T0>`, not through `RpcManager` directly. `NetworkSystem.RegisterRpcHandler` scopes the handler to that one system: it's invoked only for calls addressed to this system, never for another object's calls of the same type. A handler registered this way skips the branch every unscoped handler otherwise has to open with, checking which object a call was actually meant for. The scope rule itself, and what an unscoped handler on `RpcManager` looks like, is covered on the core API counterpart page linked above.

## What the system already handles for you

Once a handler is registered through `NetworkSystem.RegisterRpcHandler`, the system tracks it and takes care of its whole lifecycle from there:

- It deregisters the handler from the manager when the system despawns.
- It re-registers the handler when the system spawns again (a respawn on a pooled instance, or the handler was registered before the system had ever spawned at all).
- It's dropped from tracking only when the instance returns to the pool.

This means `OnDestroy` needs no call to `UnregisterRpcHandler`. The only thing left to unhook in `OnDestroy` is the marker event subscription itself, `SystemsLinked` / `SystemsUnlinked` (or `SystemLinked` / `SystemUnlinked`), when a component subscribed to those by hand instead of deriving from `NucleusBehaviourBase`. A destroyed marker also clears its own events as part of `OnDestroy`, but a component on a separate GameObject that can outlive the marker still owns its own unsubscribe.

## Resolving the manager from a plain MonoBehaviour

A script that isn't a `NucleusBehaviourBase` subclass, one that only needs to reach the marker's events, resolves the manager through `NucleusUnity.BoundCoreManager`:

```csharp
CoreManager coreManager = NucleusUnity.BoundCoreManager;

if (coreManager is null)
{
    Debug.LogError("No bound CoreManager; the scene needs a UnityCoreManager.");
    enabled = false;
    return;
}
```

`NucleusUnity.BoundCoreManager` is a plain static property, so with fast enter play mode (no domain reload) it can carry a previous session's value into the next one until `NucleusUnity.Initialize` re-binds it; the reset that guards against this runs at the start of every session. A script that reads it too early in a session, before that reset has run, can find a stale manager left over from the last play session rather than null.
