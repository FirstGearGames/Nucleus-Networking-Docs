---
title: "Reacting to session events in Unity"
---

> **Driving the core API directly?** See [Session events](../../core-api/core/session-events.md).

A scene script usually needs to know when a client authenticates, when one drops, or when the local client's own authentication comes back. Those moments arrive as events on `ServerManager` and `ClientManager`, reached through the `UnityServerManager` and `UnityClientManager` components on the CoreManager's GameObject.

## Subscribing at the right time

`UnityCoreManager` builds the CoreManager and then calls `ManagersInstantiated(UnityCoreManager)` on every `UnityManager` on its GameObject, so that's the first point the managers are guaranteed to exist. A component driving one of those managers overrides it directly:

```csharp
public class SessionLogger : UnityManager
{
    public override void ManagersInstantiated(UnityCoreManager unityCoreManager)
    {
        base.ManagersInstantiated(unityCoreManager);

        // Managers exist now; safe to bind.
    }
}
```

An ordinary scene script that isn't a `UnityManager` doesn't get that callback. `UnityCoreManager` carries `[DefaultExecutionOrder(-10000)]` specifically so its `Awake` runs before an ordinary script's own `Awake`; subscribing from `Start` instead is still the simpler default to reach for, since it needs no dependence on execution order at all.

```csharp
public class LobbyUI : MonoBehaviour
{
    private void Start()
    {
        // Bind here, never in Awake.
    }
}
```

## The four events

Reached through the manager components once bound:

- `NucleusServerManager.ClientAuthenticated` — a `ServerManager.ClientAuthenticatedHandler(Connection connection)`, raised after the client is marked authenticated.
- `NucleusServerManager.ClientDisconnecting` — a `ServerManager.ClientDisconnectingHandler(Connection connection)`, raised while the objects the departing client controlled are still readable through it.
- `NucleusServerManager.ClientAuthenticationDenied` — a `ServerManager.AuthenticationDeniedHandler(Connection connection, string denialReason)`, raised for a client refused or timed out, before it disconnects.
- `NucleusClientManager.LocalClientAuthenticated` — a `ClientManager.LocalClientAuthenticatedHandler(Connection localClientConnection)`, for the local client's own authentication.

```csharp
public class SessionLogger : UnityManager
{
    private UnityServerManager _unityServerManager;

    public override void ManagersInstantiated(UnityCoreManager unityCoreManager)
    {
        base.ManagersInstantiated(unityCoreManager);

        _unityServerManager = GetComponent<UnityServerManager>();
        _unityServerManager.NucleusServerManager.ClientAuthenticated += OnClientAuthenticated;
        _unityServerManager.NucleusServerManager.ClientDisconnecting += OnClientDisconnecting;
        _unityServerManager.NucleusServerManager.ClientAuthenticationDenied += OnClientAuthenticationDenied;
    }

    private void OnClientAuthenticated(Connection connection) { }
    private void OnClientDisconnecting(Connection connection) { }
    private void OnClientAuthenticationDenied(Connection connection, string denialReason) { }

    private void OnDestroy()
    {
        if (_unityServerManager == null)
            return;

        _unityServerManager.NucleusServerManager.ClientAuthenticated -= OnClientAuthenticated;
        _unityServerManager.NucleusServerManager.ClientDisconnecting -= OnClientDisconnecting;
        _unityServerManager.NucleusServerManager.ClientAuthenticationDenied -= OnClientAuthenticationDenied;
    }
}
```

## Unsubscribe in OnDestroy

Every subscription made here needs a matching removal in `OnDestroy`. This matters more in the editor than it sounds: fast enter play mode skips the domain reload, so a static handler left subscribed from a previous play session survives into the next one, still firing against a `Connection` from a session that's already gone. A handler on an instance method is only as safe as its `OnDestroy` unsubscribe; a `static` handler that never unsubscribes is the leak fast enter play mode makes visible first.

## Resolving the managers without a serialized reference

A script that isn't sitting next to `UnityServerManager` in the Inspector can still reach the session through `NucleusUnity.BoundCoreManager`, which is the CoreManager the integration is bound to:

```csharp
CoreManager coreManager = NucleusUnity.BoundCoreManager;
if (coreManager != null)
    coreManager.ServerManager.ClientAuthenticated += OnClientAuthenticated;
```

During shutdown, check `NucleusUnity.IsApplicationQuitting` before touching anything session-related — it's set once `Application.quitting` fires and re-armed per session, so it reliably tells a teardown path whether the transport is already coming down around it.

## Scripts on a networked object

A `NucleusBehaviour` attached to a networked object doesn't need any of the above — it has its own role hooks, `OnServerStarted`, `OnClientStarted` and `OnControllerChanged`, documented alongside systems rather than here.
