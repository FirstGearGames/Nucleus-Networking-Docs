---
title: "Typed Messages in Unity"
---

> **Driving the core API directly?** See [Typed Messages](../../core-api/messaging/typed-messages.md).

## Reach the message manager

`UnityMessageManager` has no inspector settings. Its `NucleusMessageManager` property is the core `MessageManager`. From any script, reach it through the bound session:

```csharp
MessageManager messageManager = NucleusUnity.BoundCoreManager.MessageManager;
```

From a script on the manager's GameObject or a child of it, you can also get the component:

```csharp
MessageManager messageManager = GetComponent<UnityMessageManager>().NucleusMessageManager;
```

## Register and unregister a handler

A message handler is not tied to any GameObject. Nothing removes it when the object that registered it is destroyed, and a handler left registered keeps firing against a destroyed component. Pair `RegisterMessageHandler<T0>` with `UnregisterMessageHandler<T0>` yourself:

```csharp
public class DamageAlertListener : MonoBehaviour
{
    private MessageManager _messageManager;

    private void Start()
    {
        _messageManager = NucleusUnity.BoundCoreManager.MessageManager;
        _messageManager.RegisterMessageHandler<DamageAlertMessage>(OnDamageAlert);
    }

    private void OnDestroy()
    {
        _messageManager?.UnregisterMessageHandler<DamageAlertMessage>(OnDamageAlert);
    }

    private void OnDamageAlert(in MessageContext messageContext, DamageAlertMessage message)
    {
        // Handle the message.
    }
}
```

Cache the `MessageManager` in `Start` rather than resolving it in `OnDestroy`, because `NucleusUnity.BoundCoreManager` may already be null by then.

## Send to the server from a client

`SendMessage<T0>` is a method on `Connection`. From a client, get the server connection with `TransportManager.TryGetServerConnection`:

```csharp
if (NucleusUnity.BoundCoreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
    serverConnection.SendMessage(Channel.Reliable, new DamageAlertMessage());
```

To send from the server to one or many clients, see [Sending a Message to Many Peers](../../core-api/messaging/server-message-fanout.md).

## Keep the source generator running

A message type needs the Nucleus source generator to run over every assembly that declares or sends it, like any call payload. If `Nucleus.CodeAnalysis.SourceGenerators.dll` loses its `RoslynAnalyzer` label, the project still compiles but the message never sends. See [Code Generation in Unity](../wire/code-generation-in-unity.md).
