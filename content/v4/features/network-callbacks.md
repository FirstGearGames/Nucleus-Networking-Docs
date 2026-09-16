---
title: "Network State Events"
---
You can take advantage of numerous available events to stay informed about the current state of the network.

> **Note:** This is not a comprehensive list of available events, but merely some of the most commonly used ones. To view all available ones check out the API pages.

## Server Side Events

### OnAuthenticationResult

**Name:** `ServerManager.OnAuthenticationResult`
**Namespace:** `FishNet.Managing.Server`
**Parameters:** `NetworkConnection`, `bool`

This event is called once a client has either been authenticated or failed to authenticate. The parameters are the relevant `NetworkConnection`, and a Boolean representing if that client successfully authenticated or not. This event can be very useful to use to store the `NetworkConnection` of a client that has successfully connected to the server or to send some message to the newly connected client.

### OnServerConnectionState

**Name:** `ServerManager.OnServerConnectionState`
**Namespace:** `FishNet.Managing.Server`
**Parameters:** `ServerConnectionStateArgs`

This event is called when the server's state changes — in other words, immediately when the server starts or stops running. This event is very useful for performing network actions on the server such as loading initial scenes or spawning initial objects.

### OnRemoteConnectionState

**Name:** `ServerManager.OnRemoteConnectionState`
**Namespace:** `FishNet.Managing.Server`
**Parameters:** `NetworkConnection`, `RemoteConnectionStateArgs`

This event is called when a client's state changes with the server — in other words, immediately when a client connects or disconnects from the server. This event is very useful for detecting when a client has disconnected as well as for authentication scripts to handle sending data or checking if the server is full before authenticating a connection.

## Client Side Events

### OnAuthenticated

**Name:** `ClientManager.OnAuthenticated`
**Namespace:** `FishNet.Managing.Client`

This event is called when the local client has successfully been authenticated with the FishNet server. The client will now have a Client ID and be added to the `ServerManager.Clients` and `ClientManager.Clients` collections. This is a good event to use to know when your client is fully connected to the server and ready to play the game.

### OnClientConnectionState

**Name:** `ClientManager.OnClientConnectionState`
**Namespace:** `FishNet.Managing.Client`
**Parameters:** `ClientConnectionStateArgs`

This event is called when the local client's state changes — in other words, immediately when the client makes contact with the Fish-Networking server or is disconnected from it. This event is useful for detecting when you are disconnected from the server and when you initially connect. Authentication scripts will often use this event to send initial data to the server so that the server can authenticate the client.

> **Important:** When this event is invoked the client hasn't yet been added to the `ClientManager.Clients` collection.

### OnRemoteConnectionState

**Name:** `ClientManager.OnRemoteConnectionState`
**Namespace:** `FishNet.Managing.Client`
**Parameters:** `RemoteConnectionStateArgs`

This event is called when a remote client's state changes. This event is useful for detecting when another player has connected or disconnected from the game.

> **Note:** This is only available when using `ServerManager.ShareIds`.

## Shared Events

### OnClientLoadedStartScenes

**Name:** `SceneManager.OnClientLoadedStartScenes`
**Namespace:** `FishNet.Managing.Scened`
**Parameters:** `NetworkConnection`, `bool`

Called when a client loads the initial scenes after connecting, for example any global networked scenes. Since this event will be called on the client who loaded the start scenes as well as the server, there is a Boolean parameter which will be `true` if the event was called as the server. This can be used on the host player to prevent logic in this method from running twice. This will invoke even if the `SceneManager` is not used when the client completes fully connecting to the server.

### OnPreTick

**Name:** `TimeManager.OnPreTick`
**Namespace:** `FishNet.Managing.Timing`

This event is called right before a network tick occurs, as well as before data is read.

### OnTick

**Name:** `TimeManager.OnTick`
**Namespace:** `FishNet.Managing.Timing`

This event is called when a network tick occurs. This can be useful for sending data to the server at a set rate to prevent sending data too frequently and flooding the connection.

### OnPostTick

**Name:** `TimeManager.OnPostTick`
**Namespace:** `FishNet.Managing.Timing`

This event is called just after a network tick occurs; physics would have already been simulated if using `PhysicsMode.TimeManager`.
