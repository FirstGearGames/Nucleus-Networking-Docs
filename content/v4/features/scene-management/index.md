---
title: "Scene Management"
---
Fish-Networking comes with a powerful scene manager tool that enables you to synchronize networked scenes with minimal effort, while also exposing a lot of powerful options.

## General

The `SceneManager` component has many scene features to support your multiplayer needs. The links below will take you to the different guides for each feature that the `SceneManager` has to offer.

> **Tip:** Visit the API to see the public items exposed to the user in the SceneManager.

## Sub Pages

### Automatic Online and Offline Scenes

If you simply want an online scene to be loaded when the network starts and a different one to be loaded when it stops, then you can do that with a single component.

### Scene Events

"Scene Events" are the invoked events that happen along the loading and unloading method.

### Scene Data

The data classes that are needed for the various features to function.

### Loading Scenes

Information on how to "load" scenes and the options available to the user while loading.

### Unloading Scenes

Information on how to "unload" scenes and the options available to the user while unloading.

### Scene Stacking

"Scene Stacking" is the ability for server or host to load multiple instances of a scene at once, usually with different observers in each scene.

### Scene Caching

"Scene Caching" is the ability for the server to keep a scene loaded when either all clients have unloaded that scene, or stopped observing that scene.

### Scene Visibility

"Scene Visibility" guide offers details of using the "Scene Condition" with the `ObserverManager`, and how to manage observers in a scene.

### Persisting NetworkObjects

"Persisting NetworkObjects" is the ability to keep a network object's state when loading and unloading scenes.

### Custom Scene Processors

FishNet has the ability for users to create their own Custom Scene Processor for loading and unloading scenes. Using Addressables, for example, would need a Custom Scene Processor created.
