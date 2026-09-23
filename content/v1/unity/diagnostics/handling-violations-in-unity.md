---
title: "Handling violations in Unity"
---

> **Driving the core API directly?** See [Violations](../../core-api/diagnostics/violations.md)

## No violation manager component

The Unity integration ships no manager component for violations. There is nothing to drag onto a GameObject and no inspector to configure. `ViolationManager` lives on the `CoreManager`, and you reach it from C# through whichever reference your bootstrap gives you:

```csharp
CoreManager coreManager = GetComponent<UnityCoreManager>().CoreManager;
ViolationManager violationManager = coreManager.ViolationManager;
```

or, from anywhere that isn't the manager root itself:

```csharp
CoreManager coreManager = NucleusUnity.BoundCoreManager;
```

`NucleusUnity.BoundCoreManager` is set once `UnityCoreManager` has bound the integration, and cleared on teardown. Registration is always a C# call against `ViolationManager` - `RegisterViolationHandler<T0>`, `RegisterViolationDetectedHandler<T0>`, or `RegisterViolationObserver`.

## Registering at the right time

`UnityCoreManager` builds the `CoreManager` in its own `Awake`, which runs at `[DefaultExecutionOrder(-10000)]` so the rest of the scene sees a constructed manager. That also means a `MonoBehaviour` sitting on the same GameObject as `UnityCoreManager` cannot register from its own `Awake` - execution order puts `UnityCoreManager.Awake` first only because of that attribute, and a component without one is not guaranteed to run after it. Register from `Start`, or from any callback that is documented to run after the manager root's `Awake` (`ManagersInstantiated` on a `UnityManager`, for instance).

```csharp
private CoreManager _coreManager;
private ViolationManager.ViolationDetectedHandler<UncontrolledStateChangeViolation> _handler;

private void Start()
{
    _coreManager = NucleusUnity.BoundCoreManager;
    _handler = OnUncontrolledStateChange;
    _coreManager.ViolationManager.UncontrolledStateChangeViolationDetected += _handler;
}

private void OnUncontrolledStateChange(in ViolationContext<UncontrolledStateChangeViolation> violationContext)
{
    // inspect violationContext.Connection, violationContext.Violation, violationContext.Action
}
```

## Unregistering in OnDestroy

Unregister every handler and subscriber in `OnDestroy`, symmetrically with where you registered:

```csharp
private void OnDestroy()
{
    if (_coreManager is not null)
        _coreManager.ViolationManager.UncontrolledStateChangeViolationDetected -= _handler;
}
```

A registration is not scoped to the scene or to the GameObject that made it - it lives for the lifetime of the `ViolationManager`, which outlives a scene load and, with fast enter-play-mode (no domain reload), can outlive a whole play session. A handler you never unregister keeps a reference to a destroyed `MonoBehaviour` alive in the manager's dictionary, and on the next raise the manager invokes a delegate whose target no longer exists. That is a leak, not a convenience - unregister it every time, including on an object a pool recycles rather than destroys.

## Only a server enforces a kick

`ViolationManager` settles an action for each violation and then enforces it. A `ViolationAction.Kick` is only ever carried out when the local peer has a server started; on a client-only peer the manager logs that the kick settled but was not enforced, and the connection is left alone. A deciding handler registered on a client-only build therefore never actually kicks anyone - it can still log or observe, but nothing it returns changes what happens to the offending connection. Put the handler that decides `Kick` on the build that runs the server; a client-only handler that only observes or logs is fine anywhere.

## Reading a violation from the console

With no handler registered, most violations are raised with `ViolationAction.Ignore` and write nothing to the console. The scene- and bundle-protocol faults default to `Kick`, and only `PacketTransformRejectedViolation` (Pro) falls back to `ViolationManager.DefaultAction`, which is `ViolationAction.Log`. To see the silent ones, register an `IViolationObserver` or a per-type subscriber as above and log them yourself. A `Log` action writes a warning of the form:

```
Violation [<ViolationTypeName>] from Connection [<connection>].
```

A `Kick` action logs a similar line before disconnecting; a `Kick` settled on a non-server peer logs that it was not enforced.

Several violation payloads carry a `SystemId` (for example `UncontrolledStateChangeViolation.SystemId`) rather than a GameObject reference. To find the GameObject behind that id, resolve the system first and then the marker:

```csharp
if (_coreManager.SystemManager.TryGetSystemReference(violationContext.Violation.SystemId, out NetworkSystem networkSystem)
    && networkSystem is not null
    && NetworkSystemObject.TryGetLinked(networkSystem, out NetworkSystemObject networkSystemObject))
{
    GameObject offendingGameObject = networkSystemObject.gameObject;
}
```

`SystemManager.TryGetSystemReference` turns the wire id into a `NetworkSystem`; `NetworkSystemObject.TryGetLinked` (or the marker's own `System` property, once you already hold the marker) is what ties that `NetworkSystem` back to the GameObject it is linked to.
