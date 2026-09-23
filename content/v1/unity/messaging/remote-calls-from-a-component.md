---
title: "Sending a Remote Call From a Component"
---

> **Driving the core API directly?** See [System RPCs](../../core-api/messaging/system-rpcs.md).

## Resolving the system to send from

`SendRpc` is a method on `NetworkSystem`, so a `MonoBehaviour` needs that system before it can call it. A script derived from `NucleusBehaviour<TComponent0>` already has one: `NetworkSystem`, inherited from `NucleusBehaviourBase`, is set once the script's required system links, and stays set until it unlinks. `NucleusBehaviour<TComponent0>` separately exposes `Component`, the typed `NetworkComponent` the system carries; that property is for reading replicated values, not for sending calls.

```csharp
public class DemoScoreRpcSender : NucleusBehaviour<DemoScoreComponent>
{
    private void SendScoreRpc()
    {
        bool sent = NetworkSystem.SendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
    }
}
```

A script that is not built around one required component instead resolves a `NetworkSystemObject` on the object and asks it for a system:

```csharp
if (networkSystemObject.TryGetFirstSystem(out NetworkSystem networkSystem))
    networkSystem.SendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
```

`TryGetFirstSystem` returns the object's first-linked system, the correct one to address a call from when several systems share the object.

## Declaring the payload

A call is a plain struct that implements `IRpc` and carries `[NetworkType]`:

```csharp
[NetworkType]
public struct AddScoreRpc : IRpc
{
    public int Amount;
}
```

`[NetworkType]` is what the Nucleus source generator uses to produce the struct's serialization; without the generator having run over it, the struct compiles but never replicates. In a Unity project that generator ships as `Nucleus.CodeAnalysis.SourceGenerators.dll` under `Assets/Nucleus`, and it must keep its `RoslynAnalyzer` asset label for Unity to run it at compile time. A struct declared with the label stripped, or with the DLL missing, still builds, still passes type-checking, and still sends nothing.

## Sending the call

`NetworkSystem.SendRpc<T0>` queues the call to the peers a target names, and returns a `bool`:

```csharp
bool sent = NetworkSystem.SendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
```

The return value reports only what this peer can see. `true` means the call was queued, or was invoked locally; it does not mean the call was delivered, and a client routing a call through the server has no way to know that it arrived. `false` means nothing was sent, most often because the local client does not hold the access this call's target requires. Call `SendRpc` from wherever the game decides to act: input handling, a UI callback, or a script method fired by an animation event.

## Guarding the send

Address checks and role checks belong to `NucleusBehaviourBase`, not to hand-written comparisons against connections or transport state. `EnsureIsController(ControllerType)` reports whether this peer controls the linked system, and logs a warning naming the caller the first time it fails from that calling member:

```csharp
private void OnFireButton()
{
    if (!EnsureIsController(ControllerType.Client))
        return;

    NetworkSystem.SendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
}
```

`IsStarted(Invoker)` answers whether a role is up for a behaviour whose system is linked, for code that needs to know the role rather than control:

```csharp
if (IsStarted(Invoker.Client))
    NetworkSystem.SendRpc(RpcTarget.Server, Channel.Reliable, new AddScoreRpc { Amount = 1 });
```

Both read `false` before a system is linked, so a script can call them without a separate null check on `NetworkSystem`.

## Reaching the RPC manager

There is no Unity component for the RPC manager, and nothing about a call's targets, self-delivery, or access appears in the inspector. `RpcManager` lives on `CoreManager`, reached as `NucleusUnity.BoundCoreManager.RpcManager` from outside a `NucleusBehaviourBase`, or as `CoreManager.RpcManager` from inside one:

```csharp
RpcManager rpcManager = CoreManager.RpcManager;
```

Every setting on that subject is a plain C# assignment against the manager or the system, not a field a script exposes to the inspector.

## Targets, self-delivery, and access

For `RpcTarget`, `RpcSelfDelivery`, and `RpcSendAccess`, see [System RPCs](../../core-api/messaging/system-rpcs.md).
