---
title: "SceneLoadData"
---


## General

Loading scenes of all types depend upon SceneLoadData. The SceneLoadData class contains information about what scenes to load, how to load them, which objects to move to new scenes, and more. You can view the SceneLoadData API [here](https://fish-networking.com/FishNet/api/api/FishNet.Managing.Scened.SceneLoadData.html).

## Default values

```csharp
SceneLoadData sld = new SceneLoadData()
{
    PreferredActiveScene = null,
    SceneLookupDatas = new SceneLookupData[0],
    MovedNetworkObjects = new NetworkObject[0],
    ReplaceScenes = ReplaceOption.None,
    Params = new LoadParams()
    {
        ServerParams = new object[0],
        ClientParams = new byte[0]
    },
    Options = new LoadOptions()
    {
        AutomaticallyUnload = true,
        AllowStacking = false,
        LocalPhysics = LocalPhysicsMode.None,
        ReloadScenes = false, // Obsolete, Coming Soon.
        Addressables = false
    }
};
```

<details>

<summary>PreferredActiveScene</summary>

Preferred Active Scene will allow you to choose what scene will be active on the server and/or client. You can choose to have the chosen SceneLookupData apply to both the server and client or separate ones for each.

If left with the default value of null, the first valid scene loaded will become the ActiveScene.

</details>

<details>

<summary>SceneLookupDatas</summary>

This Array is populated with scenes you would like to load, depending on the parameters you pass into the SceneLoadData when constructed.

See [**Loading Scenes**](../loading-scenes/) for examples.

</details>

<details>

<summary>MovedNetworkObjects</summary>

Instantiated NetworkObjects can be moved when loading new scenes, such as if you want to move a player to a different scene as you load the new scene. You may include an array of NetworkObjects to move to the new scenes. NetworkObjects within this array will be moved to the first scene specified in SceneLookupData.\
\
See [**Persisting NetworkObjects**](../persisting-networkobjects.md) for more details on what type of NetworkObjects you are allowed to move.

</details>

<details>

<summary>ReplaceScenes</summary>

Like the Unity SceneManager when loading a single scene, ReplaceScenes allows you to replace currently loaded scenes with new ones. There are a variety of options to use.\
\
See [**Replacing Scenes**](../loading-scenes/#replacing-scenes) Section of Loading Scenes guide for more details and examples.

</details>

<details>

<summary>Params</summary>

Params are an optional way to assign data to your scene loads/unloads. This data will be available within[ **Scene Events**](../scene-events.md), Information used in Params can be useful for storing information about the scene load/unload and referencing it later when the scene load/unload completes.

**ServerParams**

_ServerParams_ are only included on the server side, and are not networked. It is an array of objects, meaning you can send anything you want. However when accessing the Params through event args, you will have to cast the object to the data you want.

**ClientParams**

_ClientParams_ is a byte array which may contain anything, and will be sent to clients when they receive the load scene instructions. Clients can access the _ClientParams_ within the scene change events.

</details>

<details>

<summary>Options</summary>

You may further enhance how you load/unload scenes with Options.

**AutomaticallyUnload**

* When _set to_ true scenes will be unloaded automatically on the server when there are no more connections present. This is the default behaviour.
* When set to false the scene will remain if connections leave the scene unexpected, such as being disconnected.
* However, discussed in UnloadSceneData, this behavior can be overriden using the UnloadOptions of UnloadSceneData.
* Only scenes loaded for connections will be automatically unloaded when emptied.
* Global scenes can only be unloaded using ReplaceScenes or by calling unload on them.

**AllowStacking**

* When _AllowStacking_ remains false the SceneManager will not stack scenes in your SceneLoadDatas.
* If true, then scenes can be stacked (loaded multiple times).
* In the SceneLookupData section it was mentioned that if a Scene reference or handle is specified then the SceneManager will favor loading a scene using a scene handle. When you would like to load connections into the same stacked scene over multiple load calls, you will populate your SceneLookupDatas by Scene reference or handle.
* See [**Scene Stacking**](../scene-stacking.md) for more detail and examples

**LocalPhysics**

* [_LocalPhysics_](https://docs.unity3d.com/ScriptReference/SceneManagement.LocalPhysicsMode.html) is a Unity property that lets you determine how physics are simulated in your scenes.
* Generally, if you are stacking scenes you will want to set a LocalPhysics mode so that stacked scenes do not collide with each other.

**Addressables**

* _Addressables_ is only used as a reference and performs no additional functionality.
* You may set this value to know if a scene is loading using addressables, without having to create Params.

</details>
