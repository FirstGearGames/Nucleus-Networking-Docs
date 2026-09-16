---
title: "NetworkTrigger2D"
---


## Description

This component is used for receiving trigger events for prediction enabled objects for 2D Colliders. It is very much equivalent to a Collider's `OnTriggerEnter`, `OnTriggerExit`, and `OnTriggerStay` messages, except that to receive these you would add this component to your game object and subscribe to its public events.

{% hint style="success" %}
Check out this API page [here](https://fish-networking.com/FishNet/api/api/FishNet.Component.Prediction.NetworkCollider2D.html) for the specific details.
{% endhint %}

## Settings

<div align="left"><figure><img src="https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/network-trigger-2d-component.png" alt=""><figcaption><p>Default settings</p></figcaption></figure></div>

### :gear: **Maximum Simultaneous Hits**

> This is the maximum number of simultaneous hits that the component will check for. You can use this field to customize how many overlapping colliders the component should be able to detect. It should be noted that having too large of a value will decrease its performance. In most cases, the default value of 16 suffices.

### :gear: **History Duration**

> This determines how long collision history is retained. Lower values optimize memory usage slightly, but may lead to the collision records becoming out of sync on clients with excessively high latency.

### :gear: **Additional Size**

> The **Additional Size** determines the distance in units by which collision traces are extended. This extension helps prevent missed overlaps when colliders do not intersect sufficiently. Depending on the scale used in your game you may want to raise or lower this value.

### :gear: **Layers**

> These are the Layers to detect collisions on. This is used when value is not set as **Nothing**.
