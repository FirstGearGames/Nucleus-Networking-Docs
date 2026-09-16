---
title: "Network Collider"
---


Each component offers callbacks for OnEnter, OnStay, and OnExit, which work even during the prediction cycle. These components are needed because of a limitation in Unity's physics system that affects their OnCollisionEnter and OnCollisionExit methods, causing them to not always be executed.

{% hint style="success" %}
Fun fact: Fish-Networking is the only framework which provides a solution for using Enter/Exit collider callbacks with prediction!
{% endhint %}

{% hint style="warning" %}
Due to the complexity of physics with prediction we currently only support these components on primitive shapes: box, cube, sphere, circle, etc.
{% endhint %}
