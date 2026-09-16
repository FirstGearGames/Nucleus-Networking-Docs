---
title: "OfflineRigidbody"
---


## Description

When using predictions, especially physics prediction, the client will often re-simulate physics to make corrections. You generally want to add an OfflineRigidbody component to prevent non-networked objects from simulating multiple times during a correction.

## Settings

<div align="left"><figure><img src="https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/offline-rigidbody-component.png" alt=""><figcaption><p>Default settings</p></figcaption></figure></div>

### :gear:  **Rigidbody Type**

> This is to specify if the offline object uses a rigidbody3d, or 2d.

### :gear:  **Get In Children**

> This setting should be enabled if you have child rigidbodies. Keeping this disabled when child rigidbodies are not present will save a very small amount of performance.

## Combining Smoothers

There is a fair chance you will want to have the graphical object on your rigidbodies smoothed between ticks. There are a variety of components to accomplish this; see them on the [tick-smoothers](../tick-smoothers/ "mention") page.
