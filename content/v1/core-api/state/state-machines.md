---
title: "State machines"
---

A `StateMachine` holds a list of states, one active at a time, and changes state inside the tick. Use one for anything that is in exactly one mode at a time: an ability that is ready, active or cooling down, a match that is waiting, counting down, playing or showing results, a door that is open, closing or locked.

Only a change is sent, so an idle machine costs nothing.

## Choose predicted or replicated

Add one of two components to a system. Each exposes its machine as `StateMachine`.

| Component | Who runs it | Use it for |
|---|---|---|
| `PredictedStateMachineComponent` | The client controlling the system, predicting what the server runs. A change the server disagrees with is reconciled. When the server controls the system, it runs the machine alone. | State the player drives and must see at once, such as an ability. |
| `ReplicatedStateMachineComponent` | The server alone. Clients show its state and may ask for a change. | State no client should decide, such as a match's flow or a door's lock. |

Add a `PredictedStateMachineComponent` to the system that holds the client state driving it, so its changes are checked with that client state. See [The control model](../control/the-control-model.md).

## Give the machine its states

Implement `IMachineState`, or derive from `MachineState` and override what you need. Give the machine its states with `TrySetStates` each time the component is bound, the same states in the same order on every peer. State 0 is the default the machine starts in, and a machine holds at most 255 states.

```csharp
public sealed class Stunned : MachineState
{
    public Stunned()
    {
        TickLimit = 30;
        ExpiredStateIndex = 0;
    }

    public override bool CanEnter(StateMachine stateMachine, byte previousStateIndex) => previousStateIndex != 2;

    public override void OnEnterRender(StateMachine stateMachine) => PlayStunEffect();
}

stateMachine.TrySetStates(new IMachineState[] { new Idle(), new Stunned(), new Dead() });
```

A state has two kinds of callback:

- **Logic**: `OnEnter`, `OnExit`, `OnEarlyFixedUpdate`, `OnLateFixedUpdate`, `TrySelectTransition`, `CanEnter` and `CanExit`. They run inside the tick on every peer that runs the machine, again on a replayed tick for a predicted machine. Change networked members here and nothing else.
- **Render**: `OnEnterRender`, `OnExitRender` and `OnRender`. They run from `StateMachine.Render(deltaTime)`, once a frame on every peer, and never during a replay. Play effects here. A predicted change the server takes back shows as entered and then left.

The default state's `OnEnter` does not run when the machine starts; its `OnEnterRender` does, on the first frame.

`MachineState.TickLimit` ends a state after that many ticks by moving to `ExpiredStateIndex`. Any other rule goes in `TrySelectTransition`.

## Ask for a state

```csharp
stateMachine.TryRequestState(1);
stateMachine.TryRequestState(2, priority: 5);
stateMachine.TryForceState(0);
```

A request does not change the state at once. The machine changes state once per tick, in its late fixed update:

- A request made in an early fixed update takes effect that tick.
- A request made in a late fixed update takes effect the next tick.
- On the server, a request made outside a fixed update takes effect at the next one.

When several requests take effect on the same tick, a forced request wins over an ordinary one, and a higher priority over a lower one. The active state's `TrySelectTransition` takes part as a request. Unless the request is forced, the active state's `CanExit` and the new state's `CanEnter` must both allow it.

On a client, a predicted machine takes requests only from a fixed update the client simulates. Anywhere else the request is refused and a warning is logged once.

## Read the state

- `ActiveStateIndex` and `ActiveState`: the active state. Read them in an early fixed update, where they hold still for the whole tick.
- `TicksInState`: ticks since the active state was entered. The server and the predicting client count to the same tick. Every other peer counts from its estimate of the server's tick, close enough to display a countdown. It reads 0 until the machine first changes state.
- `TryGetStateIndex(state, out index)`: the index of a state the machine holds.

## Let clients ask a replicated machine

Set `RequestAccess` on the server:

| `StateRequestAccess` | Who may ask besides the server |
|---|---|
| `Server` (default) | Nobody. |
| `Controller` | The client controlling the system. |
| `AnyClient` | Any client observing the system. Also call `TrySetRpcAccess(RpcSendAccess.AnyClient)` on the system, which lets observers send every remote call on it. |

A client's request goes to the server and is settled there with the same guards as the server's own. Nothing changes on the client until the server's state arrives. A request from a client the access does not admit is dropped. `ClientForceEnabled` lets a client's `TryForceState` skip the guards; off, a client's forced request arrives as an ordinary one.

A client naming a state the machine does not hold raises `InvalidStateRequestViolation`. See [Violations](../../reference/violations.md).

## Keep in mind

- One machine per system. Put several on one object by giving each its own system.
- A client's request to a replicated machine shows a round trip later. Use a predicted machine for a change that must show at once.
