---
title: "Communicating"
---

There are a variety of ways to send communications between server and clients. Below are several terms you will become familiar with when wanting to send data.

## SyncTypes

SyncTypes reside on objects and are data-driven variables or collections. SyncTypes send at adjustable intervals. When a SyncType is modified on an object the changes are automatically sent from the server to clients. Clients will receive the changes locally on the same object. A great example is a health variable — you may update the health variable as a player takes damage, and the new values will be sent to clients.

This basic example shows a simple integer variable that will automatically be synchronized to all clients whenever the server changes it.

```csharp
using FishNet.Object;
using FishNet.Object.Synchronizing;

public class Player : NetworkBehaviour
{
    private readonly SyncVar<int> _health = new SyncVar<int>(100);

    public void StepOnLego()
    {
        if (!IsServerInitialized) return;
        _health.Value -= 10;
    }
}
```

## Remote Procedure Calls

Remote Procedure Calls are another object-bound communication type. While SyncTypes are used to synchronize variables, RPCs allow you to run logic on server and clients. RPCs are not limited to an interval like states — RPCs can be sent immediately on the next network tick or as soon as possible. They are required to be within a `NetworkBehaviour` class.

This is a simple example that shows a Server Remote Procedure Call. The method should be called from a client and the body will not execute locally — instead, the arguments will be sent across the network and the method body with those arguments will run remotely on the server.

```csharp
using FishNet.Object;

public class Player : NetworkBehaviour
{
    [ServerRpc]
    private void UpdatePlayerName(string newName)
    {
        print($"Player {OwnerId} has updated their name to {newName}");
    }
}
```

## Broadcasts

Unlike SyncTypes, broadcasts are not object-bound. Broadcasts can be used for any number of tasks but are more commonly preferred for communicating data groups between server and clients. Broadcasts can be received and sent from anywhere in your code and do not need to be within a `NetworkBehaviour` class as RPCs do.

This example shows how a client could send a broadcast to the server.

```csharp
using FishNet;
using UnityEngine;

public class ChatSystem : MonoBehaviour
{
    public void SendChatMessage(string text)
    {
        ChatBroadcast msg = new ChatBroadcast()
        {
            Message = text,
            FontColor = Color.white
        };
        InstanceFinder.ClientManager.Broadcast(msg);
    }
}
```

> ℹ️ For all of the above communication methods, two channels are supported: **Reliable** and **Unreliable**. Data sent reliably is guaranteed to arrive and be processed in the order it was sent. Data sent unreliably uses less bandwidth, but can occasionally arrive out of order, or not at all.

> ℹ️ Some features of Fish-Networking internally use eventual consistency — an example of this are unreliable SyncVars or the NetworkTransform component. These features use the unreliable channel to send data to consume less bandwidth and provide better performance, but you can still use them knowing that even if data is dropped or arrives out of order the features will eventually resolve the desynchronizations automatically.
