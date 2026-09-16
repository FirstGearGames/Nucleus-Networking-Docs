---
title: "Transports"
---

Transports control how data is sent, received, and handled over the network.

The Transport is the low-level layer responsible for sending and receiving raw data over the network. It abstracts away the details of TCP/UDP sockets and handles packet delivery, reliability, ordering, and more.

FishNet uses events internally to plug into transport messages. Although it would be unlikely you would need to access such messages, they are available to you for your development as well.

There are many transports available — some are maintained by the Fish-Networking team and others maintained by the community.

| Transport | Description |
|-----------|-------------|
| **Tugboat** | Uses LiteNetLib. The default recommended transport for most games. |
| **Bayou** | WebGL-compatible transport for browser-based games. |
| **Yak** | Offline transport for local/offline gameplay without network overhead. |
| **Multipass** | Enables using multiple transports simultaneously. |
| **FishySteamworks** | Steam networking via Steamworks.NET. |
| **FishyFacepunch** | Steam networking via Facepunch.Steamworks. |
| **FishyEOS** | Epic Online Services relay and P2P transport. |
| **FishyUnityTransport** | Unity's official transport layer (e.g. for Relay). |
| **FishyRealtime** | Photon Realtime relay transport. |
| **FishyWebRTC** | WebRTC transport for browser-to-browser connectivity. |
| **CanoeWebRTC** | Community WebRTC transport alternative. |
