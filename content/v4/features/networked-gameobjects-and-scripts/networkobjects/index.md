![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/nested-network-enabled.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/nested-network-disabled.png)

## NetworkObject

Any GameObject with a `NetworkObject` component on it will be considered a "NetworkObject" in these guides going forward. Review the NetworkObject component page for details on the various settings for a NetworkObject.

When you add a `NetworkBehaviour` component to your prefabs or scene objects, the `NetworkBehaviour` will search for a `NetworkObject` component on the same object, or within parent objects. If a `NetworkObject` is not found then one will be added automatically to the top-most object.

## Spawned NetworkObject

`NetworkObject`s that are Instantiated and Spawned using the `ServerManager.Spawn()` method will be considered a "Spawned NetworkObject". The `IsSpawned` property will be marked `true` internally on the `NetworkObject` component.

## Scene NetworkObject

Any `NetworkObject` that exists as part of the Scene — never instantiated/spawned into the scene — will be considered a "Scene NetworkObject" in these guides going forward. The `IsSceneObject` property will be marked `true` on the attached `NetworkObject` component internally.

## Global NetworkObject

Any `NetworkObject` with their bool `IsGlobal` marked `true` either in the inspector or with code will be considered a "GlobalNetworkObject" in the guides going forward.

`GlobalNetworkObject`s will automatically be put into the `DontDestroyOnLoad` scene when instantiated on the server, and when spawned on the clients.

> **Note:** Scene objects cannot be marked as global. All global objects must be instantiated and spawned.

## Nested NetworkObject

Any `NetworkObject` that is a child of another `NetworkObject` will be considered a "Nested NetworkObject" in these guides going forward. The `IsNested` property will be marked `true` on the attached `NetworkObject` component internally.
