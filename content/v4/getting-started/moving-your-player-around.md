---
title: "Moving Your Player Around"
---

Get your player objects moving around and synchronized!

Now that your player object is properly spawned and prepared, it's time to get it moving. In this section, we'll implement a simple client-authoritative movement script and utilize FishNet's `NetworkTransform` component to effortlessly synchronize that movement across all connected devices.

## Client-Authoritative Movement

For many games, particularly those with real-time player input, client-authoritative movement is the most straightforward approach. This means the client directly controls its own player object and then informs the server (and other clients) about its position and rotation.

> **Warning:** Client-authoritative movement makes it easier for the client to cheat with speed hacks, teleportation, and other movement related hacks, but it is a lot easier to implement and understand.

## Step 1 — Creating a Player Movement Script

Select your Player prefab in the Project window. In the Inspector, click on **Add Component** and search for **New Script**. Name the script `PlayerMovement` and click **Create and Add**.

![Creating the player movement script](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-5911c34a9718fe4408bf3ffb1262376822937113%2Fcreate-player-movement-script.png?alt=media)

## Step 2 — Editing the Script

Double-click the `PlayerMovement` script to open it in your code editor. Replace the default code with the following:

```csharp
using FishNet.Object;
using UnityEngine;

// Inherit from NetworkBehaviour instead of MonoBehaviour
public class PlayerMovement : NetworkBehaviour
{
    public float MoveSpeed = 5f;

    private void Update()
    {
        // Only run this code on the object the local client owns.
        // This prevents us from moving other players' objects.
        if (!IsOwner) return;

        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");
        Vector3 moveDirection = new Vector3(horizontal, 0f, vertical);

        if (moveDirection.magnitude > 1f)
            moveDirection.Normalize();

        transform.position += MoveSpeed * Time.deltaTime * moveDirection;
    }
}
```

Unlike typical single-player scripts that use `MonoBehaviour`, this script inherits from `NetworkBehaviour`. This allows for direct access to the `IsOwner` field. Although you could still check ownership via the NetworkObject component on a MonoBehaviour, NetworkBehaviour provides significant advantages — it enables RPCs, SyncVars, and specialized override methods (akin to Unity's Start, Awake, and OnDestroy but for networked objects).

Since there will be multiple player game objects in the game, we need to determine which one is "our" local player and only move that with our input. The `IsOwner` guard clause handles this.

If using Unity's [New Input System](https://docs.unity3d.com/Packages/com.unity.inputsystem@1.0/manual/index.html), you should add the `Player Input` component to your Player Prefab and be sure to **disable it** by default.

![Player Input component disabled by default](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-1e811dc9f4ff3a7fc19c13a7ad8078e1f00a1387%2Fplayer-input-component-disabled.png?alt=media)

Then use the following script instead:

```csharp
using FishNet.Object;
using UnityEngine;
using UnityEngine.InputSystem;

// Inherit from NetworkBehaviour instead of MonoBehaviour
public class PlayerMovement : NetworkBehaviour
{
    public float MoveSpeed = 5f;
    private Vector2 _currentMovementInput;

    public override void OnStartClient()
    {
        if (IsOwner)
            GetComponent<PlayerInput>().enabled = true;
    }

    public void OnMove(InputValue value)
    {
        _currentMovementInput = value.Get<Vector2>();
    }

    public void Update()
    {
        // Only run this code on the object the local client owns.
        if (!IsOwner) return;

        Vector3 moveDirection = new Vector3(_currentMovementInput.x, 0f, _currentMovementInput.y);

        if (moveDirection.magnitude > 1f)
            moveDirection.Normalize();

        transform.position += MoveSpeed * Time.deltaTime * moveDirection;
    }
}
```

We use the `NetworkBehaviour` `OnStartClient` callback to enable the `PlayerInput` component when `IsOwner` is true. This method runs when the network object is initialized on the network and only on the client side.

> **Info:** You might wonder why we can't use `Awake` or `Start` here — FishNet doesn't always have enough time to link the object on the network and assign its owner before those methods execute.

## Step 3 — Synchronizing the Movement

Now we have code that will allow clients to move only their respective player object, but nothing is yet synchronized over the network. To fix this, we will use Fish-Networking's built-in **NetworkTransform** component.

Open your Player Prefab and add the **NetworkTransform** component to it.

The most important settings right now are **Client Authoritative** and **Synchronize Position** — both should be enabled. This means positional changes made by the owner client will automatically be synchronized to the server and then to all other clients.

![NetworkTransform component settings](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-974a1f62c11a147f17a9f809dfbc60c1408a3b9f%2Fnetwork-transform-component.png?alt=media)

## Step 4 — Testing the Player Movement

Save your scene and press the **Play** button in Unity's Editor. Your player capsule should now be visible. Use the W, A, S, D keys or arrow keys to move your player around the scene.

To test multiplayer movement, build and run the game (or use multiple editor windows). You should then be able to control your player in the editor, and the second instance will control its own player, seeing both players move independently.

![Player movement synchronized over the network](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-89b75132d353512211a50d38c9bc190da84a4ea3%2Fplayer-movement-gif.gif?alt=media)
