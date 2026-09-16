Using the `DefaultScene` component to automatically manage simple scene setups.

If you're looking for a simple way to manage scene transitions when your network starts or stops, FishNet has an easy way to manage it without any custom code. The `DefaultScene` component is a ready-made solution that automatically loads your designated online scene when the network starts, and your offline scene when the network shuts down.

This is perfect for developers who want a plug-and-play setup without writing custom scene logic.

## Setup Instructions

To get started:

1. Add the `DefaultScene` component to your NetworkManager GameObject.
2. In the Inspector, assign your **Offline Scene** and **Online Scene**.
3. Make sure the two scenes are different — using the same scene for both will prevent the component from functioning properly.
