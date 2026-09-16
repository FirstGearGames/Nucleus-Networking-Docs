---
title: "Configuring NetworkObject"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/prediction-configuring-networkobject.png)
Setting up the `NetworkObject` inspector for prediction is mandatory for using prediction methods in scripts belonging to the `NetworkObject`.

To begin you must first choose to **Enable Prediction**. Next you will set the **Prediction Type**. If you are using a `Rigidbody` or `Rigidbody2D` set the prediction type accordingly. **Other** is used for non-physics such as character controllers.

![NetworkObject prediction settings in the Inspector](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-038982bc95b3840b2e9f4c6e227c60fc94d40720%2Fimage.png?alt=media)

## State Forwarding

State forwarding will allow the same inputs to run on all clients as they do on the server. This can be useful if you want all clients and server to run the same input-based logic, similar to if the client or server owns the object. State forwarding is more CPU intensive as it means a state buffer must be kept, and the object must reconcile to make corrections and re-run past states.

Even with the overhead, state forwarding is often the most preferred approach because you gain the ability to run code identical to how the client and server ran it, resulting in a more reliable simulation and potentially easier coding approach.

When state forwarding is disabled, only the owner and server will run the inputs, and only the owner will keep the buffer for objects they own. This also means you must forward any information to clients that is essential to displaying actions on non-owned objects — such as using a `NetworkAnimator` to relay animations, or using RPCs to send gun fire audio. Movement is also not forwarded, so you may want to attach a `NetworkTransform` and specify it within the **NetworkTransform** field.

## Graphical Object

This is the object which holds your graphics for the `NetworkObject`. By graphics, this means anything which holds visual representation that you would likely want smoothed between ticks, as well as corrections from any potential de-synchronizations.

When using a graphical object it's very important to remember that you do not want any components on or beneath it that could negatively be affected by smoothing, such as a capsule to move your player. Typically your colliders and triggers which affect gameplay or transform the `NetworkObject` should be on the same GameObject as your `NetworkObject` — or at the very least, not within the graphical object.

**Detaching the graphical object** is a supplemental feature which might be useful depending on your setup. The default is keeping the graphical object as a child. When attached, the graphical object rolls back to its transform properties after the tick, then smooths to the transform properties it had after the tick. This allows lower tick rates with smooth transform updates rather than everything stepping at the tick rate delta.

However, keeping the graphical object attached could be problematic for certain animation setups or cameras. Third party assets often do not expect transforms to teleport back and then smooth to their destination, and in result you might see unexpected behavior. By detaching the graphical object it is no longer rolled back after the tick and simply exists in world space moving towards the proper goal over the duration of a tick. In most scenarios detaching would likely be better, but there is always a chance it's not right for you — hence the default of staying attached.

## Smoothing

The smoothing options are only present when a graphical object is set.

There are certain cases where you may want to customize smoothing to control what is actually smoothed versus what you want to control yourself. That's where the **Smoothed Properties** come in. You will notice there is a smoothed properties setting for if you are the owner of the object, or a spectator (not owner). In a number of cases developers want to self-smooth things such as rotation while letting FishNet handle position and scale. In such a scenario you would just untick rotation from the smoothed properties.

**Adaptive Interpolation** under Spectator options determines the level of interpolation on spectated objects. A lower value means less interpolation — and in result a larger chance that a de-synchronization will be more visually apparent. A higher value means more interpolation and much less chance of seeing the effects of a de-synchronization. The adaptive interpolation API is also exposed, letting you tweak it at runtime.
