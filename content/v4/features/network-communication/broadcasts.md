Allow you to send messages to one or more objects without them requiring a `NetworkObject` component. This could be useful for communicating between objects which are not necessarily networked, such as a chat system.

Like Remote Procedure Calls, broadcasts may be sent reliably or unreliably. Data using broadcasts can be sent either from the client to the server, or server to client(s). Serializers are automatically generated for Broadcasts as well.

Broadcasts must be structures, and implement `IBroadcast`. Below demonstrates what values a chat broadcast may possibly contain.

```csharp
public struct ChatBroadcast : IBroadcast
{
    public string Username;
    public string Message;
    public Color FontColor;
}
```

Since broadcasts are not linked to objects, they must be sent using the `ServerManager`, or `ClientManager`. When sending to the server you will send using `ClientManager`, and when sending to clients, use `ServerManager`.

> **Tip:** The following examples use `InstanceFinder` to get a reference to the `ClientManager` and `ServerManager`, but you can store a reference yourself, use the `NetworkManager`'s public references, or a `NetworkBehaviour`'s.

Here is an example of sending a chat message from a client to the server.

```csharp
public void OnKeyDown_Enter(string text)
{
    // Client won't send their username, server will already know it.
    ChatBroadcast msg = new ChatBroadcast()
    {
        Message = text,
        FontColor = Color.white
    };
    InstanceFinder.ClientManager.Broadcast(msg);
}
```

Sending from the server to client(s) is done very much the same, but you are presented with more options. Here is an example of sending a broadcast to all clients which have visibility of a specific client. This establishes the idea that clientA sends a chat message to the server, and the server relays it to other clients which can see clientA. In this example clientA would also get the broadcast.

```csharp
// When receiving a broadcast on the server, which connection
// sent the broadcast will always be available.
public void OnChatBroadcast(NetworkConnection conn, ChatBroadcast msg, Channel channel)
{
    // For the sake of simplicity we are using observers
    // on conn's first object.
    NetworkObject nob = conn.FirstObject;

    // The FirstObject can be null if the client
    // does not have any objects spawned.
    if (nob == null)
        return;

    // Populate the username field in the received msg.
    // Let us assume GetClientUsername actually does something.
    msg.Username = GetClientUsername(conn);

    // This will send the message to all Observers on nob,
    // and require those observers to be authenticated with the server.
    InstanceFinder.ServerManager.Broadcast(nob, msg, true);
}
```

Given broadcasts are not automatically received on the object they are sent from, you must specify what scripts or objects can receive a broadcast. As mentioned previously, this allows you to receive a broadcast on non-networked objects, but also enables you to receive the same broadcast on multiple objects.

While our example only utilizes one object, this feature could be useful for changing a large number of conditions in your game at once, such as turning off or on lights without having to make them each a networked object.

Listening for a broadcast is much like using events. Below demonstrates how the client will listen for data from the server.

```csharp
private void OnEnable()
{
    // Begins listening for any ChatBroadcast from the server.
    // When one is received the OnChatBroadcast method will be
    // called with the broadcast data.
    InstanceFinder.ClientManager.RegisterBroadcast<ChatBroadcast>(OnChatBroadcast);
}

// When receiving on clients, broadcast callbacks will only have
// the message and channel.
private void OnChatBroadcast(ChatBroadcast msg, Channel channel)
{
    // Pretend to print to a chat window.
    Chat.Print(msg.Username, msg.Message, msg.FontColor);
}

private void OnDisable()
{
    // Like with events it is VERY important to unregister broadcasts
    // when the object is being destroyed (in this case disabled), or when
    // you no longer wish to receive the broadcasts on that object.
    InstanceFinder.ClientManager.UnregisterBroadcast<ChatBroadcast>(OnChatBroadcast);
}
```

As a reminder, a receiving method on the server was demonstrated above. The method signature looked like this:

```csharp
public void OnChatBroadcast(NetworkConnection conn, ChatBroadcast msg)
```

With that in mind, let's see how the server can listen for broadcasts from clients.

```csharp
private void OnEnable()
{
    // Registering for the server is exactly the same as for clients.
    // Note there is an optional parameter not shown, requireAuthentication.
    // The value of requireAuthentication defaults to true.
    // Should a client send this broadcast without being authenticated
    // the server would kick them.
    InstanceFinder.ServerManager.RegisterBroadcast<ChatBroadcast>(OnChatBroadcast);
}

private void OnDisable()
{
    // There are no differences in unregistering.
    InstanceFinder.ServerManager.UnregisterBroadcast<ChatBroadcast>(OnChatBroadcast);
}
```

If you would like to view a working example of using Broadcast, view the `PasswordAuthenticator.cs` file within the `Demos/Authenticator/Scripts` folder.
