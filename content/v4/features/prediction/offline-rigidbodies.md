---
title: "Offline Rigidbodies"
---
In some cases you will want the player to be able to interact with non-networked rigidbodies; these require a special component.

While prediction is in use, if you have a rigidbody object in your game that is not synchronized with the network it must contain an `OfflineRigidbody` component. Please review the `OfflineRigidbody` component page for more information on its uses.
