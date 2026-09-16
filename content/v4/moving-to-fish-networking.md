---
title: "Moving to Fish-Networking"
---
Helpful tips for how to move your project from another solution to FishNet.

Moving to Fish-Networking will vary depending on which previous networking solution you are coming from. With other solutions changing their API so regularly it may be difficult to keep transition information up to date but we will try our best.

If you encounter any questions we welcome you on our Discord, where our helpful community can get you started.

## Leaving Mirror Networking

> Always backup before making large changes. Having another copy of your project to reference during the upgrade is a great idea!

> The majority of these changes can be done by using quick replace within your IDE!

### Upgrade tool

An upgrade tool is provided to help transition from Mirror to Fish-Net. The tool will replace several Mirror components with the like ones for Fish-Net. Note that while the components will be replaced the settings of your components will not be preserved. For best results keep a copy of your original project for reference until switching over.

Currently supported components are: `NetworkIdentity`, `NetworkProximityChecker`, `NetworkTransform`/`Child`, `NetworkAnimator`, `NetworkSceneChecker`.

Additional components from FirstGearGames Mirror Assets/Projects are supported: `FlexNetworkTransform`/`Child`, `FastProximityChecker`, `FlexNetworkAnimator`, `FlexSceneChecker`.

> The upgrade tool requires scripting defines to function. These defines should be removed after running the upgrade tool.
>
> - `MIRROR` — for Mirror components.
> - `FGG_ASSETS` — for FirstGearGames assets.
> - `FGG_PROJECTS` — for FirstGearGames projects.

Before running the upgrade tool you will likely need to remove a few files. If using FirstGearGames Mirror assets or projects, delete any of the demo folders included for those assets and projects.

In addition, any scripts requiring component `NetworkIdentity` will need to have the declaring line removed.

```csharp
// Replace the following with an empty string.
[RequireComponent(typeof(NetworkIdentity))]
// The hotkey in Visual Studio is Ctrl + Shift + H.
```

### Component changes

| Mirror | Fish-Networking | Notes |
|--------|----------------|-------|
| Interest Management | ObserverManager (see also: NetworkObserver) | Both support multiple conditions |
| NetworkIdentity | NetworkObject | |

> Changing out components can be a tedious task. Save time by using **Window -> Fish-Networking -> Upgrading -> From Mirror -> Replace Components**. This will swap out most components for you.
>
> Mirror and Fish-Networking must be within your project to run the operation mentioned. Afterwards you may remove Mirror.

### NetworkBehaviour property renames

> Each `IsServer`, `IsClient`, etc option has two varieties: Initialized and Started.
>
> **Initialized** means the object has been marked as ready for network use by the side (e.g.: client or server). **Started** means the client or server socket is connected, but does not mean the object has been initialized for network use yet.
>
> When converting from Mirror you will most likely want to use Initialized.

| Mirror | Fish-Networking | Notes |
|--------|----------------|-------|
| `hasAuthority` | `IsOwner` | |
| `isLocalPlayer` | removed, use `IsOwner` instead | |
| `isClient` | `IsClientInitialized` | |
| `isClientOnly` | `IsClientOnlyInitialized` | |
| `isServer` | `IsServerInitialized` | |
| `isServerOnly` | `IsServerOnlyInitialized` | |
| `connectionToClient` | `Owner` | Can be used on client |
| `connectionToServer` | `LocalConnection` | |
| `netId` | `ObjectId` | |

### NetworkBehaviour callbacks

Callbacks such as `OnStartClient` for the most part are the same in Fish-Networking. Some of the callbacks do provide additional information which is not available within Mirror's callbacks. There are also several new callbacks to use. For a complete guide on using Fish-Networking callbacks see the Network Behaviour Guides page.

### Remote Procedure Call renames

See Remote Procedure Calls for enhanced features and usage related to RPCs.

| Mirror | Fish-Networking | Notes |
|--------|----------------|-------|
| `[Command]` | `[ServerRpc]` | |
| `[TargetRpc]` | `[TargetRpc]` | First parameter must be a `NetworkConnection` |
| `[ClientRpc]` | `[ObserversRpc]` | |

> RPCs within Fish-Networking have many advantages over Mirror; see Remote Procedure Calls for more information.

### Manager renames

Mirror uses several singletons while Fish-Networking uses an anti-singleton design. There are still easy ways to access similar features. All of the same access can be returned from the `NetworkObject` component, as well as by using `InstanceFinder`.

All of these may also be found within the `NetworkManager`.

| Mirror | Fish-Networking | Notes |
|--------|----------------|-------|
| `NetworkManager` | `NetworkManager` | Unchanged |
| `NetworkServer` | `ServerManager` | |
| `NetworkClient` | `ClientManager` | |
| | `TransportManager` | Fish-Networking only |
| | `TimeManager` | Fish-Networking only |
| | `SceneManager` | Fish-Networking only |

### Switching from Mirror.NetworkManager

The `NetworkManager` in Mirror features several overrides for state changes, such as when clients connect, disconnect, server start or stop, scene changes, and more.

Fish-Networking instead uses sealed managers with events. To mimic the `NetworkManager` of Mirror create a new `MonoBehaviour` and place it on your `NetworkManager` object. Instead of using overrides subscribe to your needed events from each appropriate Fish-Networking manager.

```csharp
// Mirror example.
// Called when a remote client connects.
public override OnServerConnect(NetworkConnectionToClient conn) {}

// FishNet example.
// Called when a remote client state changes.
networkManager.ServerManager.OnRemoteConnectionState += YourCallback;
```

### NetworkManager callback equivalents

| Mirror | Fish-Networking |
|--------|----------------|
| `ServerChangeScene` / `OnServerChangeScene` / `OnServerSceneChanged` | `SceneManager.OnLoadEnd` |
| `ClientChangeScene` / `OnClientChangeScene` / `OnClientSceneChanged` | `SceneManager.OnClientPresenceChangeEnd` — See SceneManager guide for more information |
| `OnServerReady` | `SceneManager.OnClientLoadedStartScenes` |
| `OnServerConnect` / `OnServerDisconnect` | `ServerManager.OnRemoteConnectionState` |
| `OnServerAddPlayer` / `OnClientNotReady` | |
| `OnStartHost` / `OnStopHost` | Not needed |
| `OnStartServer` / `OnStopServer` / `OnServerError` | `ServerManager.OnServerConnectionState` |
| `OnStartClient` / `OnStopClient` / `OnClientConnect` / `OnClientDisconnect` / `OnClientError` | `ClientManager.OnClientConnectionState` |

## Automatic online/offline scenes

To mimic the Online and Offline scene setting in the Mirror `NetworkManager` you can add the `DefaultScene` component to your network manager object and fill it in with your desired scenes.
