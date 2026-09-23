---
title: "Typed Messages in Unity"
---

> **Driving the core API directly?** See [Typed Messages](../../core-api/messaging/typed-messages.md).

## The manager

`UnityCoreManager.EnsureManagers` adds a `UnityMessageManager` to the CoreManager's GameObject alongside the rest of the Unity managers, so it is already present whenever a `UnityCoreManager` bootstraps a session. It exposes one thing, `NucleusMessageManager`, which is the core `MessageManager` this component drives. `UnityMessageManager` carries no inspector settings — its own summary says as much — so there is nothing to configure on it.

## Resolving the manager

From a script sitting on the manager GameObject (or a child of it), get the component directly:

```csharp
UnityMessageManager unityMessageManager = GetComponent<UnityMessageManager>();
MessageManager messageManager = unityMessageManager.NucleusMessageManager;
```

From anywhere else, go through the bound CoreManager instead:

```csharp
MessageManager messageManager = NucleusUnity.BoundCoreManager.MessageManager;
```

`NucleusUnity.BoundCoreManager` is the CoreManager the Unity integration bound at startup; it is set once `UnityCoreManager.Awake` calls `NucleusUnity.Initialize` and cleared on teardown.

## Registering and unregistering a handler

`MessageManager.RegisterMessageHandler<T0>` and `UnregisterMessageHandler<T0>` take a `MessageReceivedHandler<T0>` delegate. Registration is not scoped to any GameObject or component — nothing despawns it, nothing tears it down when the object that registered it goes away. Pair the two calls by hand:

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

A handler left registered after its component is destroyed keeps firing against a `this` Unity has already torn down. The `MessageManager` reference is cached in `Start` rather than resolved fresh in `OnDestroy`, since destruction order across objects is not guaranteed and `NucleusUnity.BoundCoreManager` may already be null by then.

## Getting a Connection to send to

`SendMessage<T0>` is a member of `Connection`, so sending needs a `Connection` to call it on. From a client script, the connection to the server comes from `TransportManager.TryGetServerConnection`:

```csharp
if (NucleusUnity.BoundCoreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
    serverConnection.SendMessage(Channel.Reliable, new DamageAlertMessage());
```

On the server side, sending to one or many clients uses the server-side connection helpers covered in [Sending a Message to Many Peers](../../core-api/messaging/server-message-fanout.md).

## The generator prerequisite

A struct used as an `IMessage` payload needs the Nucleus source generator to see it, the same requirement as any call payload. In a Unity project this means `Nucleus.CodeAnalysis.SourceGenerators.dll` must be marked as a Roslyn analyzer (the `RoslynAnalyzer` label on its `.meta`) in every assembly that declares or sends the message type. Without it, the project still compiles, but the generated wire code for that type is never produced, and the message silently never sends.
