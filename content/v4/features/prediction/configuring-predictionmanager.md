---
title: "Configuring PredictionManager"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/prediction-manager-component (1).png)
The `PredictionManager` is responsible for global prediction settings and other prediction related information.

You do not necessarily need to add it to your NetworkManager object, but doing so allows you to alter default settings.

![PredictionManager component in the Inspector](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-953040ef64f9da64afe3c72e24e01669ca124778%2Fprediction-manager-component.png?alt=media)

## Interpolation

Depending on your game type you may want to adjust the default client and server interpolation. In short, more interpolation means more resilience against network instability at the cost of larger delays between running actions.

Having more interpolation also means reducing the chances of having to predict data when it is expected to be known. There are a variety of ways to know if data is confirmed, predicted, or in the future; this topic is covered later.

**Client interpolation** indicates how many ticks inputs from the server (and other clients) are held before they are run. For casual games an interpolation of 2–3 may be desired to drastically improve the likelihood that inputs will always be available to run. This will add a delay to when those inputs are run, so perhaps for fast-paced games a value of 1 would be better.

**Server interpolation** is much the same but typically should be a lower value. This is how much of a buffer the server tries to hold for inputs, resulting in the server not running them after a number of ticks equal to the specified interpolation.

## Excessive Replicate Dropping

Typically speaking the server will never have more than its Server Interpolation ±1 in queue. However, if the client is having network issues and is sending inputs in bursts, the queue could for example go from 0 to 5 if 5 client inputs came through at once.

When the server queued inputs exceed the maximum it will begin to drop old values. This protects the server against an allocation attack and also prevents cheating by the client trying to send extra inputs.

You may disable dropping of excessive replicates but this opens your game up to cheating, as multiple replicates will be run per tick on the server to consume extras. There is still a generous hard-coded value of the maximum amount of replicates which may be queued, to protect from allocation attacks.
