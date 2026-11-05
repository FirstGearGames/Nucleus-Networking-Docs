---
title: "Handling violations in Unity"
---

> **Driving the core API directly?** See [Violations](../../core-api/diagnostics/violations.md)

There is no violation component and nothing to set in an inspector. Register handlers in C# on the `ViolationManager`, reached through `NucleusUnity.BoundCoreManager.ViolationManager`, with `RegisterViolationHandler<T0>`, `RegisterViolationDetectedHandler<T0>` or `RegisterViolationObserver`.

## Registering at the right time

Register from `Start`, or from `ManagersInstantiated` on a `UnityManager`, not from `Awake`. The managers may not exist yet when your `Awake` runs.

```csharp
private CoreManager _coreManager;
private ViolationManager.ViolationDetectedHandler<UnauthorizedMemberChangeViolation> _handler;

private void Start()
{
    _coreManager = NucleusUnity.BoundCoreManager;
    _handler = OnUnauthorizedMemberChange;
    _coreManager.ViolationManager.UnauthorizedMemberChangeViolationDetected += _handler;
}

private void OnUnauthorizedMemberChange(in ViolationContext<UnauthorizedMemberChangeViolation> violationContext)
{
    // inspect violationContext.Connection, violationContext.Violation, violationContext.Action
}
```

## Unregistering in OnDestroy

Unregister every handler, observer and subscriber in `OnDestroy`:

```csharp
private void OnDestroy()
{
    if (_coreManager is not null)
        _coreManager.ViolationManager.UnauthorizedMemberChangeViolationDetected -= _handler;
}
```

A registration is not tied to the scene or the GameObject that made it. It lives as long as the `ViolationManager`, which outlives a scene load and, with domain reload disabled, can outlive a play session. A handler you never unregister keeps a destroyed `MonoBehaviour` alive and is still called on the next raise. Unregister on objects a pool recycles too.

If a handler throws (usually a `MissingReferenceException` from a destroyed target), the exception is logged as an error and the violation falls back to its default action. A throwing observer does not stop the ones after it, and a throwing subscriber does not stop enforcement.

## Only a server enforces a kick

A `ViolationAction.Kick` is carried out only on a peer that has a server started. On a client-only peer the kick is logged as not enforced and the connection is left alone. Put deciding handlers that return `Kick` on the build that runs the server. Handlers that only observe or log can go anywhere.

## See violations in the console

With no handler registered, most violations are `ViolationAction.Ignore` and write nothing. The scene and bundle protocol faults default to `Kick`. `PacketTransformRejectedViolation` (Pro) takes `ViolationManager.DefaultAction` (`Ignore`) and always logs a warning.

Otherwise, a line is written only when `violationContext.Log` is set. The raise site may set it, and the deciding handler may change or clear it. To see the silent ones, register an `IViolationObserver` or a per-type subscriber and log them yourself. A logged violation looks like this:

```
Violation [<ViolationTypeName>] from Connection [<connection>]: <message>
```

A `Kick` logs a similar line before disconnecting, and a `Kick` on a non-server peer logs that it was not enforced.

## Find the GameObject behind a violation

Many violation payloads carry a `SystemId` (for example `UnauthorizedMemberChangeViolation.SystemId`) rather than a GameObject. Resolve the system, then its `NetworkSystemObject`:

```csharp
if (_coreManager.SystemManager.TryGetSystemReference(violationContext.Violation.SystemId, out NetworkSystem networkSystem)
    && networkSystem is not null
    && NetworkSystemObject.TryGetLinked(networkSystem, out NetworkSystemObject networkSystemObject))
{
    GameObject offendingGameObject = networkSystemObject.gameObject;
}
```
