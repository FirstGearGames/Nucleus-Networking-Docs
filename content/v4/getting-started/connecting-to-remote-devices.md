---
title: "Connecting to Remote Devices"
---

Learn how to connect clients to a remote FishNet server, allowing players on different machines to join your game.

Once you have a basic networked game set up and can connect as a host, the next crucial step for true multiplayer is enabling clients to connect to a server running on a different machine. This guide will walk you through the process of connecting to remote devices.

## Step 1 — Identifying the Server's IP Address

For a client to connect to a remote server, it needs to know the server's IP address.

**Local Network (LAN):** If the server and client are on the same local network (e.g., two computers in the same house), you'll need the server machine's local IP address (e.g., `192.168.1.100`). You can usually find this through your operating system's network settings.

**Public Network (Internet):** If clients are connecting over the internet, you'll need the server's public IP address. This is often the IP address of the router that the server machine is connected to. You might need to set up port forwarding on the server's router to allow incoming connections to the game server's port.

> **Info:** For testing on a local network, you can often find your machine's IP address by opening a command prompt (Windows) and typing `ipconfig`, or a terminal (macOS/Linux) and typing `ifconfig` or `ip a`. Look for the IPv4 address associated with your active network adapter.

## Step 2 — Configuring the Client to Connect

To connect as a client to a remote server, you'll need to manually set the server's address.

1. **Locate the NetworkManager** — In your Unity scene, select the NetworkManager game object.
2. **Select or add the Transport Component** — In the Inspector, locate the Transport component (e.g., **Tugboat** if you're using the default). If there is none, add **Tugboat** now.
3. **Set the Address** — Find the **Client Address** field within the Transport component. Enter the IP address of your remote server here.
4. **Set the Port (if different)** — The default port for FishNet is `7777`. If your server is configured to use a different port, update the **Port** field accordingly.

![Tugboat transport component with client address configured](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-12cea2ebc611580c7468ce0e33eb0dac2f6025cd%2Ftugboat-component.png?alt=media)

> **Info:** The NetworkHudCanvas is a convenient debugging tool. In a finished game, you would typically create your own UI for players to enter an IP address and connect.

## Step 3 — Building and Testing the Connection

To test connecting to a remote device, you'll either need to build your game or set up your Unity editor with your project on the other devices.

1. **Build the Client** — Go to **File > Build Settings...**. Ensure your scene is added to "Scenes In Build". Select your target platform and click **Build**.
2. **Start the Server** — Launch one instance of your game on the machine that will act as the server. If it's a dedicated server build, the FishNet server will start automatically. Otherwise, start it with the NetworkHudCanvas **Server** button or Autostart option.
3. **Launch the Client** — On a separate machine, launch the client build you just created.
4. **Connect** — If you disabled auto-start, click the **Start Client** button from the NetworkHudCanvas in the client build.

If configured correctly, the client should connect to the server, and you should see network-related messages in both the server and client consoles indicating a successful connection.

## Step 4 — Troubleshooting Common Connection Issues

If your client fails to connect, consider these common issues:

**Incorrect IP Address:** Double-check that the IP address entered in the Transport component is correct for the server machine. Also make sure you entered it in the **Client Address** field and not one of the **Server Bind Address** fields.

**Firewall:** Ensure that the firewall on the server machine is not blocking incoming connections on the game's port (default `7777`). You may need to create an inbound rule to allow traffic.

**Port Forwarding (for Internet connections):** If connecting over the internet, the server's router needs to be configured to forward the game's port to the server machine's local IP address. Without this, external clients cannot reach your server.

**Server Not Running:** Verify that the server instance of your game is actually running and has successfully started its network services.

**Different Game Versions:** Ensure both the server and client are running the exact same version of your game build. Mismatched versions can cause connection failures.

**Network Congestion/Latency:** On public networks, high latency or packet loss can sometimes lead to connection timeouts.

> **Info:** If you are trying to test over the Internet, it may be easier and safer to use an application to create a virtual LAN instead of port forwarding your router.
