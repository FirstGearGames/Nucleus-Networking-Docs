---
title: "Replicating your first object"
---

> **Driving the core API directly?** See [Replicating your first system](./replicating-your-first-system.md).

## The marker component

`NetworkSystemObject` is the single point of correlation between a GameObject and a `NetworkSystem`. Every networked prefab and every networked scene object needs exactly one, at its root, and it carries the identifiers that tell the two peers they're talking about the same object:

- `PrefabId` — the prefab's identifier within its content shard, or zero when unset.
- `PrefabBundleId` — the identifier of the content shard that owns the prefab.
- `SceneObjectId` — the identifier of a scene object, or zero when this isn't one.

All three back onto private, editor-stamped fields (`_prefabId`, `_prefabBundleId`, `_sceneObjectId`); nothing sets them from script. `NetworkSystemObject` carries `[DisallowMultipleComponent]`, so a GameObject can only ever have one.

Start every networked object the same way: create the prefab, add `NetworkSystemObject` to its root, and stop there for this step — the identifier isn't stamped yet.

## Giving the prefab an id

A prefab with no `PrefabId` can't spawn over the network. Run **Nucleus > Rebuild Network Prefab Collection** from the Unity menu (`NetworkPrefabCollectionBuilder.Rebuild`, on `[MenuItem("Nucleus/Rebuild Network Prefab Collection")]`) after adding a new networked prefab, and again any time you add or remove one. It scans the project for prefabs carrying a `NetworkSystemObject`, stamps each with a prefab id and its bundle's id, and writes the shard's prefab collection asset.

The id lives on the prefab asset itself, which is where the trap comes from: duplicate a networked prefab in the Project window and the copy carries the same stamped `_prefabId` as the original, because duplication copies the serialized data verbatim. Until you rebuild, both prefabs claim the same identifier and the wrong one can end up resolved on the receiving end. Clear the duplicate's identifier back to zero and rebuild — the collection build only preserves an identifier that's already set and unique, so a cleared one is stamped fresh.

## Adding NetworkTransform

Add `NetworkTransform` to the same GameObject and the object's position, rotation, and scale replicate with no code: the controller writes the transform each frame, and every other peer applies it through an interpolation buffer. It also requires a `NetworkSystemObject` on the same object.

Two fields are worth knowing on day one:

- **Transform Space** (`_transformSpace`, a `TransformSpace`) — `Local` by default, replicating the offset the object holds inside its parent, which is what lets a carried object (one riding a moving platform, say) cost nothing while it rides. Switch to `World` for an object that may hang from something unreplicated; a `World` object's pose is unaffected by reparenting.
- **Send Interval** (`_sendInterval`, a `SendInterval`) — defaults to `Normal`. Only applies under the `Interval` transmission mode; the default transmission mode projects the path instead and isn't paced by this field.

The inspector also exposes **Interpolate Scale Enabled**, **Kinematic Management Enabled**, **Transmission Mode**, and **Path Continuation**. They exist and are worth knowing about later; the two above are the ones that matter for getting an object moving today.

## Writing the first script

A script that needs the networked object inherits `NucleusBehaviour<TComponent0>` rather than plain `MonoBehaviour`. `TComponent0` names the one `NetworkComponent` type this script's system must carry:

```csharp
using Nucleus.Components;

public partial class FirstObjectComponent : NetworkComponent
{
    public readonly NetworkMember<bool> IsActive = new();
}
```

```csharp
using Nucleus.Connections;
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Systems;
using UnityEngine;

public class FirstObjectController : NucleusBehaviour<FirstObjectComponent>
{
    protected override void OnSystemLinked()
    {
        Debug.Log($"[{gameObject.name}] linked. CoreManager: {CoreManager}, NetworkSystem: {NetworkSystem}");
    }

    protected override void OnServerStarted()
    {
        Debug.Log($"[{gameObject.name}] server role is up.");
    }

    protected override void OnClientStarted()
    {
        if (IsController(ControllerType.Client))
            Debug.Log($"[{gameObject.name}] this peer controls the object.");
    }

    protected override void OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)
    {
        Debug.Log($"[{gameObject.name}] controller changed from {previousControllerConnection} to {currentControllerConnection}.");
    }

    private void Update()
    {
        if (!IsController(ControllerType.Client) || !IsStarted(Invoker.Client))
            return;

        // Safe to act on the object here: this peer controls it and the client role is up.
    }
}
```

`NucleusBehaviour<TComponent0>.Awake` calls `NetworkSystemObjectPool.RequireSystem<NetworkSystem, TComponent0>` for you, so there's no manual rent to write. From `NucleusBehaviourBase` you inherit:

- `NetworkSystem` — the linked system, null until it links.
- `CoreManager` — resolved in `Awake`.
- `IsController(ControllerType controllerType)` — false until a system is linked, otherwise the system's own answer.
- `IsStarted(Invoker invoker)` — whether this peer's server or client role is started, meaningful only once a system is linked.
- `EnsureIsController(ControllerType controllerType)` and `EnsureIsStarted(Invoker invoker)` — the same checks, but log a warning on every failing call instead of failing silently. `Update()` above uses the plain forms deliberately: it runs every frame, and a non-controlling or not-yet-started peer failing the check there is the normal case, not a bug. Reach for the loud forms in one-off code — a button handler, an RPC — where a failure means something is actually wrong.

## The lifecycle hooks

A first script overrides four things: `OnSystemLinked`, `OnServerStarted`, `OnClientStarted`, and `OnControllerChanged`. Each has a stopped counterpart (`OnSystemUnlinked`, `OnServerStopped`, `OnClientStopped`) for symmetry, but those aren't needed to get an object moving.

Linking doesn't wait for a role to start — it adopts whatever's already running. A scene object's `Awake` runs on every peer regardless of which one has a server or client up yet, so when the system links, the behaviour immediately checks whether the server and client roles are already started and calls `OnServerStarted`/`OnClientStarted` right then if they are, rather than waiting for a state-change edge that a role already running will never raise again. A role that starts later still raises the matching hook when it does.

For an object placed in the scene before anyone connects, this means `OnSystemLinked` fires first (from `Awake`, on every peer), and `OnServerStarted`/`OnClientStarted` fire immediately after it on whichever peer already has that role up — on a host, both fire back to back.
