---
title: "Addressables"
---

This guide assumes you know how to load and unload addressable scenes without Fish-Networking. Below describes how to use your addressables scene logic with the Fish-Networking SceneManager.

There are a variety of ways to load and unload addressable scenes; because of this you are provided an easy way to create your own logic for accessing addressables. To begin using addressables with the SceneManager create a new script, and inherit from **DefaultSceneProcessor**.

> [!INFO]
> LoadOptions and UnloadOptions have an addressables boolean you may utilize to know if your scene change is using addressables.

The DefaultSceneProcessor script inherits from SceneProcessorBase to implement the default scene changing functionality. Your custom script inherits from DefaultSceneProcessor because often only some of the logic needs to be changed, and this allows you to only override the differences.

As mentioned, what you need to modify may vary, but most developers find themselves overriding the following methods.

```csharp
public abstract void BeginLoadAsync(string sceneName, LoadSceneParameters parameters);
public abstract void BeginUnloadAsync(Scene scene);
public abstract bool IsPercentComplete();
public abstract float GetPercentComplete();
public abstract IEnumerator AsyncsIsDone();
```

Each method contains XML documentation to provide you a better description.

After you have completed your implementation of DefaultSceneProcessor add your newly created component to your NetworkManager object.

If the _SceneManager_ component is not added to the NetworkManager object yet, add that as well. Drag your DefaultSceneProcessor implementation into the _SceneProcessor_ field on the SceneManager.

You are all set now! Whenever Fish-Networking loads or unloads a scene your processor will be used and you can control the logic.
