---
title: "Reacting to session events in Unity"
---

> **Driving the core API directly?** See [Session events](../../core-api/core/session-events.md).

## Four events report session changes

| Event | Handler | Raised |
|---|---|---|
| `NucleusServerManager.ClientAuthenticated` | `ServerManager.ClientAuthenticatedHandler(Connection connection)` | After a client is marked authenticated. |
| `NucleusServerManager.ClientDisconnecting` | `ServerManager.ClientDisconnectingHandler(Connection connection)` | While the objects the departing client controlled are still readable through it. |
| `NucleusServerManager.ClientAuthenticationDenied` | `ServerManager.AuthenticationDeniedHandler(Connection connection)` | For a client refused or timed out, before it disconnects. |
| `NucleusClientManager.LocalClientAuthenticated` | `ClientManager.LocalClientAuthenticatedHandler(Connection localClientConnection)` | When the local client's own authentication completes. |

Reach them through the `UnityServerManager` and `UnityClientManager` components on the Nucleus GameObject.

## Subscribe and unsubscribe

1. Subscribe once the managers exist: in `Start` for an ordinary script, or in `ManagersInstantiated` for a `UnityManager` subclass. Never subscribe in `Awake`.
2. Unsubscribe every handler in `OnDestroy`. With domain reload disabled, a handler left subscribed survives into the next play session and fires against a `Connection` from a session that is gone. A `static` handler that never unsubscribes is the usual culprit.

```csharp
public class SessionLogger : MonoBehaviour
{
    [SerializeField] private UnityServerManager _unityServerManager;

    private void Start()
    {
        _unityServerManager.NucleusServerManager.ClientAuthenticated += OnClientAuthenticated;
        _unityServerManager.NucleusServerManager.ClientDisconnecting += OnClientDisconnecting;
        _unityServerManager.NucleusServerManager.ClientAuthenticationDenied += OnClientAuthenticationDenied;
    }

    private void OnClientAuthenticated(Connection connection) { }
    private void OnClientDisconnecting(Connection connection) { }
    private void OnClientAuthenticationDenied(Connection connection) { }

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

A script with no reference to the components can reach the session through `NucleusUnity.BoundCoreManager`:

```csharp
CoreManager coreManager = NucleusUnity.BoundCoreManager;
if (coreManager != null)
    coreManager.ServerManager.ClientAuthenticated += OnClientAuthenticated;
```

During shutdown, check `NucleusUnity.IsApplicationQuitting` before touching anything session-related. It turns true once `Application.quitting` fires and resets each session, so a teardown path can tell whether the transport is already coming down.

## Scripts on a networked object use their own hooks

A `NucleusBehaviour` on a networked object does not need these events. It has its own hooks, `OnServerStarted`, `OnClientStarted` and `OnControllerChanged`; see [NucleusBehaviour](../systems/nucleus-behaviour.md).
