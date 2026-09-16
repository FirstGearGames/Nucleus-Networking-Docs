## General

> **Important:** When creating `SceneLoadData` or `SceneUnloadData` there are provided constructors that automatically create `SceneLookupData` for you. Most likely you will be using these constructors and will not be creating a separate `SceneLookupData`.

When you specify a scene by reference or handle, the `SceneManager` will prefer to look up that scene using the scene handle. This is important information when using Scene Stacking. Looking up a scene by handle or object reference will place connections in the scene specified, but when using scene names, the server will create a new scene instance for the specified connections and place them into that scene. The described behavior only applies when loading scenes over multiple load calls; such as if you call `LoadConnectionScene` twice, each with its own connection.

## Default Values

> **Note:** A Scene Handle is an integer that Unity generates for a scene instance when it is loaded. You can use it to specify an instance of a scene that is already loaded, but not for loading a new instance of that scene.

```csharp
// SceneLookupData default values
SceneLookupData slud = new SceneLookupData()
{
    // If Handle is greater than 0 then it will ignore Name and use Handle
    // to look up the scene.
    Handle = 0,

    // If Handle is set to 0, then Name is used to look up the scene instead.
    Name = null
};
```

See Loading Scenes and Unloading Scenes for implementation.
