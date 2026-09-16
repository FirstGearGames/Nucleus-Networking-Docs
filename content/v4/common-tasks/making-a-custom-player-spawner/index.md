---
title: "Making a Custom Player Spawner"
---

Step-by-step instructions for how to write a custom player spawner for various scenarios.

In many games, you'll often need to spawn a GameObject to represent a player. This can happen at various points during gameplay — such as when a player first connects, once a specific number of players have joined, after a particular scene finishes loading, or when the host initiates it with a button press.

FishNet includes a default **PlayerSpawner** component designed primarily as a quick-start tool and reference example. It automatically spawns a player object for each client upon successful connection and authentication. It also has the option to define specific player spawn points, and if multiple spawn points are provided, the component will rotate through them sequentially.

If this functionality is sufficient for your game, then you can use the default one. Otherwise, see the [Overview](/docs/v4/common-tasks/making-a-custom-player-spawner/overview) for custom spawning scenarios:

- **Spawning Players When Connected** — The default PlayerSpawner handles this for you.
- **Spawning Players Manually** — Create a script to manually spawn your players when you call a method.
- **Spawning a Selected Player** — Allow your players to choose a character object before spawning it.
- **Spawning Players When Set Number of Players Joined** — Spawn players as soon as a set number of clients have joined.
- **Spawning Players on Scene Load** — Spawn players as soon as they are loaded by FishNet into a specific scene.
