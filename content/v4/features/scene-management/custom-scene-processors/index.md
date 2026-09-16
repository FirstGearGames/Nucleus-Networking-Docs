You can create a custom scene processor to handle how a scene is loaded/unloaded.

FishNet's `SceneManager` uses Unity's methods under the hood; you can override its functionality to add or change how it functions. This can be useful when using addressables or for making custom loading screens.

To start, simply create a script that inherits from `DefaultSceneProcessor`, add it to your network manager object, and then in the `SceneManager` component on the network manager, assign it as the **Scene Processor**.

## Addressables

You will need to make a custom scene processor if you want your game to make use of addressable networked scenes.

## Loading Screen

You can use a custom scene processor to easily hook up your loading screen into FishNet's networked scene loading.
