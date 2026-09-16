---
title: "Services"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/attach_money_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/group_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/public_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/graph_5_24dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.png)

> We strongly recommend reviewing our [Server Hosting](/docs/v4/server-hosting) page for terminology as well the Pros/Cons of services mentioned on this page.
>
> This information is updated to the best of our knowledge. If you are interested in a service listed below — to better understand their platform — please visit the provided links to their official website.

## Our recommended service

**PlayFlow Cloud**, a company we've had the pleasure of working with firsthand, is recommended as our top-pick for a hosting service. Their outstanding support, reliable service, and superior pricing have consistently impressed our staff and community.

:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-8cfe8cae899ea64c0f572fdff4436402f60222c7%2Fplayflow-card.png?alt=media" href="/docs/v4/server-hosting/services/playflow-cloud" maxwidth="420px"
**PlayFlow Cloud**

⭐⭐⭐⭐⭐

💰 Generous free tier with better pricing than competitors.

👥 Lobby & Matchmaking, with an included SDK handling the work.

🌐 Worldwide dedicated and instanced servers.

⚙️ User-friendly control panel, metrics, support, and more.
:::

## Other services

Here is a non-extensive selection of other hosting services that work well with FishNet.

### Dedicated servers

These hosts offer session-based servers, as well as persistent servers. Relay services may be available as well.

:::cardrow
:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-7931e05fa76c3964f8d89d4a061e8f5138edc626%2Fhathora-card.png?alt=media" href="https://hathora.dev/"
**Hathora**

- Pay-per-use pricing.
- Session-based servers available.
- Persistent servers available.
- Relay servers available.
- Match Making / Lobbies.
:::
:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-6dcee078ca2c6b71f075038907032b04e07def32%2Fedgegap-card.png?alt=media" href="https://edgegap.com/"
**Edgegap**

- Pay-per-use pricing.
- Session-based servers available.
- Persistent servers available.
- Relay servers available.
- Match Making / Lobbies.
:::
:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-5bd6bf706e19717756460e9c753ef33e4552dc20%2Faws-card.png?alt=media" href="https://aws.amazon.com/"
**AWS (GameLift)**

AWS is a bit more difficult to setup and manage. We generally only recommend AWS to experienced developers.

- Pay-per-use pricing — a little more complex.
- Session-based servers available.
- Persistent servers available.
- Relay servers available.
- Match Making / Lobbies.

We have a community guide for AWS: [Community Guide](/docs/v4/server-hosting/services/getting-started-with-aws)
:::
:::endrow

### Relays only

These are relay-only services.

:::cardrow
:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-aeca4d68010f693799ed530b31329e20cbc93d9a%2Fsteam-card.png?alt=media" href="https://partner.steamgames.com/doc/features/multiplayer/steamdatagramrelay"
**Steam**

**Steam** relays are offered free when you launch your game on Steam; there is a percentage of sales, as well as an initial fee when using Steam.

We have an official FishNet transport for Steam, and there are third-party Unity assets available as well. A popular asset is [Toolkit for Steamworks Foundation by Heathen Engineering](https://github.com/heathen-engineering/Toolkit-for-Steamworks-Foundation).

- Free for games launched using Steam.
- Session-based relays.
- Match Making / Lobbies.
- Friends list (Steam).
:::
:::card img="https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-15e783a9025667b3a21de9b587e479abbfd1651e%2Feos-card.png?alt=media" href="https://onlineservices.epicgames.com/en-US/services"
**Epic Online Services (EOS)**

**EOS** provides a number of features for free. The API and documentation is a bit more complex, which may be difficult for beginners. A vetted third-party [EOS transport](/docs/v4/components/transports/fishyeos-epic-online-services) is available for FishNet, which may help with some of those hurdles.

A cross-platform friends list is possible with EOS but at the cost of complexity; e.g.: you will not be able to directly access your Steam friends via the EOS platform.

- Free to all developers.
- Session-based relays.
- \*Match Making / Lobbies.
- \*Friends list.
:::
:::endrow
