---
title: "NetworkStateMachine"
---

`NetworkStateMachine` puts a networked state machine on a GameObject. Its states are `MachineStateBehaviour` components, one active at a time, and only a change is sent. See [State machines](../../core-api/state/state-machines.md) for how states, requests and timing work.

## Add a machine

1. Add a component deriving from `MachineStateBehaviour` for each state.
2. Add `NetworkStateMachine` to the same GameObject. It requires a `NetworkSystemObject` at or above it.
3. List the states in **States**. The first is the default.
4. Press Play. The inspector shows the active state and how many ticks it has been active.

| Field | Default | Effect |
|---|---|---|
| Prediction | Predicted | **Predicted**: the client controlling the object predicts the machine and the server's state corrects it. **Replicated**: the server runs it alone, and clients show its state and may ask for a change. |
| Placement | Object System | **Object System**: the machine uses the component listed in a system another script on the object declares. **Own System**: the machine declares a system of its own. |
| States | empty | The states, in order. Every peer must list the same states. |
| Request Access | Server | Replicated only. Who besides the server may ask for a state: nobody, the controlling client, or any observing client. |
| Client Force Enabled | off | Replicated only. Lets a client's forced request skip the states' guards. |

With **Object System**, add `PredictedStateMachineComponent` or `ReplicatedStateMachineComponent` to your own script's system:

```csharp
public class Player : NucleusBehaviour<NetworkSystem, PlayerInputComponent, PredictedStateMachineComponent>
{
}
```

A predicted machine belongs in the system that carries the input driving it. **Own System** adds a system for the machine alone; for a predicted machine that system costs bandwidth every tick, so prefer **Object System**. A replicated machine with **Own System** and **Any Client** access opens its system to observers' calls itself; with **Object System**, the system's owner must call `TrySetRpcAccess(RpcSendAccess.AnyClient)`.

## Write a state

```csharp
public class StunnedState : MachineStateBehaviour
{
    [SerializeField] private ParticleSystem _stars;

    public override bool CanEnter(StateMachine stateMachine, byte previousStateIndex) => true;

    public override void OnEnterRender(StateMachine stateMachine) => _stars.Play();

    public override void OnExitRender(StateMachine stateMachine) => _stars.Stop();
}
```

Every `MachineStateBehaviour` has **Tick Limit**, which ends the state after that many ticks, and **Expired State**, the state it moves to then (empty for the default). Logic callbacks run inside the tick; render callbacks run once a frame and never during a replay. The machine only calls render callbacks when one of its states overrides one.

## Ask for a state

Once the object's system has linked, `StateMachine` is set:

```csharp
networkStateMachine.StateMachine.TryRequestState(1);
```

Ask a predicted machine from a fixed update, such as `OnEarlyFixedUpdate` on a `NucleusBehaviour`. A replicated machine can be asked from anywhere; on a client, the request goes to the server and the change shows when the server's state arrives.

The MatchFlow demo has a replicated match machine and a predicted ability machine side by side.
