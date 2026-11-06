---
title: "Sending a Remote Call From a Component"
---

> **Driving the core API directly?** See [System RPCs](../../core-api/messaging/system-rpcs.md).

## Send from the component's system

`TrySendRpc` is a method on `NetworkSystem`. A script deriving from `NucleusBehaviour<TComponent0>` has a `NetworkSystem` property, set while its required system is linked:

```csharp
public class DemoScoreRpcSender : NucleusBehaviour<DemoScoreComponent>
{
    private void SendScoreRpc()
    {
        bool sent = NetworkSystem.TrySendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
    }
}
```

`Component`, the typed `NetworkComponent`, is for reading replicated values, not for sending calls.

Any other script gets a system from the object's `NetworkSystemObject`. `TryGetFirstSystem` returns the first-linked system, the one to send from when several systems share the object:

```csharp
if (networkSystemObject.TryGetFirstSystem(out NetworkSystem networkSystem))
    networkSystem.TrySendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
```

`TrySendRpc` returns `true` when the call was queued or invoked locally, not when it was delivered. `false` means nothing was sent, most often because this client lacks the access the target requires. Call it wherever the game decides to act: input handling, a UI callback, or an animation event.

The payload is a `[NetworkType]` struct implementing `IRpc`:

```csharp
[NetworkType]
public struct AddScoreRpc : IRpc
{
    public int Amount;
}
```

If `Nucleus.CodeAnalysis.SourceGenerators.dll` is missing from `Assets/Nucleus` or has lost its `RoslynAnalyzer` label, the struct still builds but the call never sends. See [Code Generation in Unity](../wire/code-generation-in-unity.md).

## Guard the send

Use the `NucleusBehaviour` helpers instead of comparing connections or transport state yourself. Both return `false` before a system is linked, so they need no null check on `NetworkSystem`.

`IsController(ControllerType)` reports whether this peer controls the linked system. Input reaches every copy of an object, so `false` on the peers that do not control it is normal and logs nothing:

```csharp
private void OnFireButton()
{
    if (!IsController(ControllerType.Client))
        return;

    NetworkSystem.TrySendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
}
```

`IsStarted(Invoker)` reports whether a role is running, for code that cares about the role rather than control:

```csharp
if (IsStarted(Invoker.Client))
    NetworkSystem.TrySendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
```

## Reach the RPC manager

There is no RPC manager component, and no call setting appears in an inspector. Targets, self-delivery and access are all set in C# on `RpcManager` or the system. Reach `RpcManager` as `CoreManager.RpcManager` inside a `NucleusBehaviour`, or `NucleusUnity.BoundCoreManager.RpcManager` anywhere else.
