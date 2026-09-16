---
title: "Tick Smoothers"
---


You may put multiple tick smoother components beneath an object if you have several different graphical pieces in your hierarchy you want smoothed. A good example of this is a vehicle where the wheels move independently of the vehicle body.

The smoother will be placed on the graphical object you wish to smooth; this object must not be the same as the target, nor higher in the hierarchy of the target; being a child of the target is fine.

{% hint style="success" %}
Tick Smoothers are only used by clients. These components will not function when only the server is started.
{% endhint %}
