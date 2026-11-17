---
title: "Test with two editors"
---

> **Using plain .NET?** See [Run two peers in one process](./running-two-peers-in-one-process.md).

One editor only shows one player. To see a second player, run a second Unity editor on the same project. Use either [ParrelSync](https://github.com/VeriorPies/ParrelSync) or Unity's Multiplayer Play Mode. With **Start On Play** set to **Auto**, Nucleus starts the main editor as the host and the second editor as a client either way.

## Open a second editor with ParrelSync

1. Choose **Window > Package Manager**, click **+**, choose **Add package from git URL**, and enter `https://github.com/VeriorPies/ParrelSync.git?path=/ParrelSync`.
2. Choose **ParrelSync > Clones Manager**, click **Create new clone**, then click **Open in New Editor**.

The clone shares your project's Assets folder, so a change you save in one editor shows up in both.

## Play in the main editor and the clone

1. Press Play in the main editor. With **Start On Play** set to **Auto**, it becomes the host.
2. Press Play in the clone. It joins the host as a client.

## Or open a second editor with Multiplayer Play Mode

Multiplayer Play Mode opens the second editor for you and runs it when you press Play in the main editor.

1. Choose **Window > Package Manager**, choose **Unity Registry**, select **Multiplayer Play Mode**, and click **Install**.
2. Choose **Window > Play Mode > Scenarios**, create a scenario, and add one additional Editor instance to it.
3. Press Play in the main editor. With **Start On Play** set to **Auto**, the main editor becomes the host and the additional editor joins it as a client.

The first launch takes longer, because the additional editor imports the project once.

## Check that the two editors are connected

Each editor shows two capsules. Click in one editor's Game view and press WASD: that capsule moves in both editors.

Stuck? See [If nothing replicates](./nothing-is-replicating.md).
