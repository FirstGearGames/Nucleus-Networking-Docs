---
title: "Play mode, domain reload and session lifetime"
---

> **Driving the core API directly?** See [Shutting a session down](../../core-api/core/shutting-down-a-session.md).

## The problem

`CoreManager` keeps a static registry of every live manager in the process (`LiveCoreManagers`, behind `CoreManager.Instance`), and the Unity integration keeps its own static session state alongside it (`NucleusUnity.BoundCoreManager`, `NucleusUnity.SpawnHandler`, the prefab pool, the network prefab registry). None of that is scoped to a play session. Stopping play mode does not clear static fields on its own, and with Unity's domain reload disabled it especially does not: the same AppDomain, and the same static fields, carry straight into the next Play button press. Without an explicit reset, a second session inherits the first one's `CoreManager`, a `SpawnHandler` bound to GameObjects Unity already destroyed, and a prefab registry that thinks its content is already loaded.

`NucleusUnity` closes that gap with five resets that run at the head of every session, before any of your code executes.

## The five session-start resets

Three run as `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]`, the earliest hook Unity offers, ahead of every `Awake`:

- **`CoreManager.ResetRegistry()`** clears the static `LiveCoreManagers` list and nulls `CoreManager.Instance`. It only drops references, it does not call `Deinitialize()` on anything still in the list — a manager left over from an ended session may already be holding GameObjects Unity destroyed, so nothing in the registry is safe to call into. The orderly unwind is `Deinitialize()`, called while the session is still live (see below); this reset is the backstop for when that never ran.
- **`NetworkPrefabRegistry.Clear()`** clears the static prefab registry. Without it, the next session's `NetworkPrefabCollection` finds every bundle already marked registered by a collection that Unity destroyed without ever unregistering, and loads nothing.
- **Session binding slots**: `NucleusUnity.SpawnHandler` and `NucleusUnity.BoundCoreManager` are set to `null`, the prefab pool is reset to a fresh `DefaultNetworkPrefabPool()`, and the internal host-visibility binder list is cleared. This is the same backstop reasoning as above, applied to the integration's own static fields rather than the engine's registry: a session that stopped without its `Deinitialize` call would otherwise leave the next session pointing at a dead `CoreManager` and a pool full of destroyed instances.

Two more run at `RuntimeInitializeLoadType.BeforeSceneLoad`, inside `RegisterServices`, just after the SubsystemRegistration hooks and still ahead of your own bootstrap:

- **The logger service** is (re)installed with `LoggingService.UseLogger(new Logging.Logger())`.
- **The application-state service** is (re)installed with `ApplicationStateService.UseApplicationState(new Environment.ApplicationState())`.

Both are re-registered every session rather than assumed to already be set, for the same static-state reason as everything else here.

## Fast enter play mode and `IsApplicationQuitting`

With domain reload disabled, none of the engine's static state is rebuilt by Unity itself — it is entirely up to these `RuntimeInitializeOnLoadMethod` hooks, which Unity still re-runs on every play session regardless of the domain reload setting. That's what makes the five resets load-bearing rather than defensive: without them, fast enter play mode is the case where the previous session's `CoreManager`, `SpawnHandler` and prefab registry would otherwise still be sitting there when the next one starts.

`RegisterServices` also resets `NucleusUnity.IsApplicationQuitting` to `false` and re-subscribes `OnApplicationQuitting` to `Application.quitting`. The flag latches to `true` when the application begins tearing down, and a marker destroyed during that teardown uses it to know its transport is already going down with it rather than treating the destroy as a normal despawn. Resetting it per session (rather than leaving it `true` from the previous run) is what keeps a second play session from starting in an already-quitting state.

## Teardown on stop

`UnityCoreManager` is the component that owns the session's `CoreManager`. Its `OnDestroy` runs the unwind:

```csharp
private void OnDestroy()
{
    if (CoreManager is null)
        return;

    NucleusUnity.Deinitialize(CoreManager);
    CoreManager.Deinitialize();
}
```

The `CoreManager is null` check covers an `Awake` that threw before `CoreManager = new(...)` ran — there is nothing to unwind, so the method does nothing. `NucleusUnity.Deinitialize` runs first, releasing the `SpawnHandler` binding while the manager graph is still whole; `CoreManager.Deinitialize()` then releases the managers themselves, stops the network loop, and shuts down transports.

`CoreManager.Deinitialize()` is idempotent: `CoreManager.IsDeinitialized` is set at the start of the call and checked on entry, so a second call is a no-op. That flag is public specifically so a second teardown path — a destroy callback that fires after an explicit `Deinitialize()` already ran — can tell an already-torn-down manager from a live one without keeping its own tracking.

## Symptoms of a session that leaked into the next one

**A handler fires twice, or answers for an object that no longer exists.** Something is still subscribed from the previous session. Check whether the `CoreManager` that owned it actually reached `OnDestroy` — a `DisallowMultipleComponent` conflict, a disabled GameObject, or a domain-reload-disabled run that skipped teardown entirely (stopped from the editor toolbar mid-frame, or killed) will all skip `UnityCoreManager.OnDestroy`, leaving that session's subscriptions live into the next one.

**A manager keeps responding after play has stopped, or the next session's `CoreManager.Instance` isn't the one you expect.** The `SubsystemRegistration` resets run before every session, but only clear static state — they do not call into a manager that was never torn down. If `Deinitialize()` never ran on the previous `CoreManager`, its manager objects still exist and still hold whatever GameObjects, transports, or callbacks they had, even though `ResetRegistry()` has already dropped them from the registry and `Instance`. Look for a missing or thrown `Awake`/`OnDestroy` on `UnityCoreManager` in the previous session's log before assuming the reset itself is at fault.

**Content that loaded in the first session doesn't load in the second.** Usually `NetworkPrefabRegistry.Clear()` ran (it always does, at `SubsystemRegistration`) but the session's `NetworkPrefabCollection` never re-registered afterward — check that the collection load actually runs on the new session rather than assuming it was skipped by the reset.

## A torn-down `CoreManager` is not reusable

Once `Deinitialize()` has run, `IsDeinitialized` stays `true` for the life of that object; there is no re-initialize path. A `UnityCoreManager` whose `Awake` wants to start a new session builds a new `CoreManager` — it does not, and cannot, revive the one `OnDestroy` just tore down.
