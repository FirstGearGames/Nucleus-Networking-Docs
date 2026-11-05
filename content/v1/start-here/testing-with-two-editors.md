---
title: "Test with two editors"
---

> **Using plain .NET?** See [Run two peers in one process](./running-two-peers-in-one-process.md).

One editor only shows one player. To see a second player, run a second Unity editor on the same project with [ParrelSync](https://github.com/VeriorPies/ParrelSync).

## Open a second editor

1. Choose **Window > Package Manager**, click **+**, choose **Add package from git URL**, and enter `https://github.com/VeriorPies/ParrelSync.git?path=/ParrelSync`.
2. Choose **ParrelSync > Clones Manager**, click **Create new clone**, then click **Open in New Editor**.

The clone shares your project's Assets folder, so a change you save in one editor shows up in both.

## Play in both editors

1. Press Play in the main editor. With **Start On Play** set to **Auto**, it becomes the host.
2. Press Play in the clone. It joins the host as a client.

Each editor shows two capsules. Click in one editor's Game view and press WASD: that capsule moves in both editors.

Stuck? See [If nothing replicates](./nothing-is-replicating.md).
