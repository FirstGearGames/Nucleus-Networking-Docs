---
title: "Configuring TimeManager"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/prediction-configuring-timemanager.png)
Very little of the `TimeManager` has to be configured for prediction.

When using prediction it is essential that Fish-Networking's timing system is used. By default Unity's timing is used, but this can be changed on the `TimeManager` component.

Add the `TimeManager` component to your NetworkManager if it does not already exist.

Once added, change the **Physics Mode** to **Time Manager**, and you are done.

![TimeManager Physics Mode set to Time Manager](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-7842de153a90654ce16e622df2ce46076eeecc6f%2Fimage.png?alt=media)
