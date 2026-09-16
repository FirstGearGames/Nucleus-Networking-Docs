---
title: "SpawnablePrefabs"
---

Fish-Networking uses a collection of prefabs to manage spawning of network objects across the network. Whenever you instantiate and [spawn](../../../guides/features/networked-gameobjects-and-scripts/spawning/) an object on the server, FishNet will use the selected **Spawnable Prefabs** collection to find which object it is and to automatically instantiate and link the objects on all clients.

The **Spawnable Prefabs** collection can be set on your [NetworkManager](../../components/managers/network-manager.md) component.

{% hint style="success" %}
The NetworkManager will automatically set the **Spawnable Prefabs** to an automatically managed [DefaultPrefabObjects ](defaultprefabobjects.md)asset if a custom one is not selected.
{% endhint %}

<figure><img src="https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/network-manager-spawnable-prefabs.png" alt="NetworkManager component highlighting Spawnable Prefabs field"><figcaption><p>The <strong>Spawnable Prefabs</strong> field on the NetworkManager</p></figcaption></figure>
