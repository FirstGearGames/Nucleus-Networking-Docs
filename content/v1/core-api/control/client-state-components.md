---
title: "Client state"
---

> **Using Unity?** See [Sending client state from Unity](../../unity/control/writing-a-client-state-component-unity.md).

## Client state is the per-tick values a simulation reads

Client state is what the controlling client sends the server every tick so the server can simulate the object: a move direction, a jump press, an aim angle. The server runs the same step the client does, from those values, and replicates the result. Sending client state rather than result state means the server only ever trusts what the player asked for, never where the player says it ended up.

Client state is ordinary `NetworkMember<T0>` fields constructed with `role: MemberRole.Predict`, declared in the system's own `NetworkComponent` beside the state the simulation computes from them. There is no separate client state class to write and nothing to register or attach: a member travels as client state because of its role.

## Declaring client state

```csharp
using System.Numerics;
using Nucleus.Components;
using Nucleus.Connections;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;

public partial class MoverComponent : NetworkComponent, IStateWriteValidator<Vector2>
{
    // Client state: written by the controller on its live tick, sent upstream every tick.
    public readonly NetworkMember<Vector2> MoveDirection = new(role: MemberRole.Predict);
    // A press that must not repeat when a missing tick is carried forward.
    public readonly NetworkMember<bool> JumpPressed = new(role: MemberRole.Predict, isCarriedForward: false);
    // State the server computes from the client state.
    public readonly NetworkMember<Vector3> Position = new();

    // Set by the game from the device on the controlling client.
    public Vector2 IntendedDirection;

    private const float Speed = 5f;

    // Server: once per Predict member per client tick taken. Write the member and decline to keep your own value.
    public StateWriteAction ValidateStateWrite(NetworkMember<Vector2> networkMember, Vector2 proposedValue, Connection writingClientConnection)
    {
        if (proposedValue.LengthSquared() <= 1f)
            return StateWriteAction.Accept;

        MoveDirection.Value = Vector2.Normalize(proposedValue);

        return StateWriteAction.Decline;
    }

    protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
    {
        // A client watching a system it does not control: nothing to simulate.
        if (simulationContext.Type is SimulationType.None)
            return;

        // The controlling client's live tick: this becomes the tick's client state.
        if (simulationContext.Type is SimulationType.Forward && NetworkSystem.IsController(ControllerType.Client))
            MoveDirection.Value = IntendedDirection;

        // The server's step for a tick whose client state did not arrive: carry the last one forward, leaving the press at its default.
        if (stepDelta.IsClientStateMissing)
            TryGetLastState(isEveryMemberCarried: false);

        if (!CoreManager.TransportManager.IsServerStarted)
            return;

        Position.Value += new Vector3(MoveDirection.Value.X, 0f, MoveDirection.Value.Y) * (Speed / CoreManager.NetworkLoopManager.TickRate);
    }
}
```

`Position` here is ordinary state the server computes, so the controller sees its own movement a round trip late. To have the controller move at once and be corrected only when it is wrong, make the result `MemberRole.Validate` and let both peers run the step; see [Predicted members and prediction history](./prediction-history-and-predicted-members.md).

## Who writes it, and when

Whoever controls the system writes its Predict members: the controlling client on its live tick (`SimulationType.Forward`), or the server for a system it controls. Write them inside the fixed update, from values the game gathered between ticks, so every pass of a tick reads the same numbers. A replay never writes them: it reads each past tick's value from the member's history.

A pure client sends its systems' Predict members to the server every tick, stamped with its tick. Each entry names, with one changed bit per member, only the members that differ from the newest of its ticks the server reported having decoded, so a value held still costs a bit. Both sides keep recent ticks as baselines, so a lost entry never breaks the chain; with no usable baseline every value is sent.

A host playing its own object writes the members in the same process, so nothing travels upstream. Each tick it still puts their values to the same validator a remote controller faces, and a declined value is reported to it as a correction.

## Validating client state on the server

Implement `IStateWriteValidator<T0>` on the component, once per member type, and the server calls it once per Predict member for each client tick it takes:

```csharp
StateWriteAction ValidateStateWrite(NetworkMember<T0> networkMember, T0 proposedValue, Connection writingClientConnection);
```

- `StateWriteAction.Accept` takes the client's value.
- `StateWriteAction.Decline` keeps what the member already holds.
- To clamp rather than refuse, write the member inside the call and decline: the server keeps your value, simulates with it and forwards it.
- A validator that throws declines.

The same interface judges a client's writes to ordinary state members; see [Validating client writes](../state/validating-client-writes.md). Several members of one type share one implementation, so compare the `networkMember` argument against your fields when they need different rules.

## What the server does with each tick

The server takes one of the controller's ticks per server tick, released through the State Interpolation like any other state, so a burst that arrives together is spread over the ticks that follow. For each tick it takes it runs the validator, then steps the system with its Predict members holding that tick's values.

A tick it cannot take in time is dropped, and one that arrives after its tick was simulated is late. Both are counted on the controller's `Connection`:

```csharp
public uint ClientStateDroppedCount { get; }
public uint ClientStateLateCount { get; }
public uint ClientStateReanchorCount { get; }
```

A client that stalls and resumes is re-anchored: when its client state arrives further behind the ticks the server already simulated for it than the State Interpolation, the server re-bases onto the client's ticks, sends a reconcile for each system the client controls, and counts it in `ClientStateReanchorCount`.

The server's step is stamped with the server's own tick in `StepDelta.Tick`. The controller's tick it simulates is in `SimulationContext.RemoteTick`, for pairing and logging only: a client chooses its own tick numbers, so never time a cooldown or anything else by it. See [The simulation context](./reconciliation.md#the-simulation-context).

## Ticks whose client state did not arrive

A system a remote client drives is simulated on every server tick whether or not that tick's client state arrived: before the first one, and while the client's packets are lost. That is what lets the server act on the object in its own world, a collision for instance. On such a step `StepDelta.IsClientStateMissing` is true, `SimulationContext.IsRemoteTickEstimated` is true, and every Predict member reads its default. To carry the previous tick's client state forward instead, call the component's:

```csharp
public bool TryGetLastState(bool isEveryMemberCarried)
```

The Predict members then read their values as they stood at the end of the previous tick, for the rest of the step: the client's own when that tick's arrived, and whatever the server's step left in the members otherwise, so a value the server writes into a member is what the next tick carries. Pass `false` to keep the members constructed with `isCarriedForward: false` at their defaults, so a jump press never fires twice; or send a press count, which repeats nothing when carried, and pass `true`. It returns `false`, leaving the defaults, before any client state has arrived. Nothing is carried unless you call it, so a game that does not carry is reconciled back to what the server simulated.

To know which tick you are carrying, use the overload that also reports the simulation context of that client state:

```csharp
public bool TryGetLastState(bool isEveryMemberCarried, out SimulationContext lastStateSimulationContext)
```

On a missing step, `lastStateSimulationContext` is the context of the newest step this component's client state arrived for. On the server its `RemoteTick` is the controller's tick that state was written on and `IsRemoteTickEstimated` is false, so the missing step's own `RemoteTick` minus it is how many ticks you are carrying it over. That is useful for giving up on a carry that has gone on too long:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    if (stepDelta.IsClientStateMissing && TryGetLastState(isEveryMemberCarried: false, out SimulationContext lastStateSimulationContext))
    {
        // Stop walking once the client has been silent for more than five of its ticks.
        if (simulationContext.RemoteTick - lastStateSimulationContext.RemoteTick > 5)
            MoveDirection.Value = Vector2.Zero;
    }

    // Simulate from MoveDirection as usual.
}
```

On a step that is not missing it is the context of the step running now. Before any client state has arrived, or on a component with no Predict member, it is the default, whose `RemoteTick` is unset. As with the step's own context, compare these ticks but never time anything on the server by them.

A tick runs missing only once the State Interpolation says it should have arrived. Just after a stall drained the buffer, or with a client clock running slower than the server's, the next client tick runs when it arrives instead, so those are the server ticks that pass the object by.

## Forwarded to every observer

The server forwards the Predict values it kept, after validation and its own writes, to every observer of the system, the controller included. Observers can drive presentation (footsteps, animation) from what the controlling player is doing, and an observer that predicts the system simulates from them (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).

On the controller a server value for a past tick lands in that tick's history when it differs from its own, so a later replay of that tick reads what the server simulated. A value the server writes from its own step reaches the controller the same way.

## Reporting changes

`OnMembersChanged` reports Predict members as it reports every member, on change rather than every tick:

- `MemberChangeDirection.Read` on the server when a client's value that differs is taken (`TryGetWritingClient` names the sender), and on an observer receiving a changed value.
- `MemberChangeDirection.Correction` on the controller when the server's value for one of its past ticks differs from its own. The server's value is already in the member's history at that tick when the callback runs.

The simulation reads the members every tick in its fixed update anyway; use the callback for presentation, or to react to a correction.

## Controller-only, regardless of state write access

Client state is controller-only no matter what a system's state write access allows. Client state from any connection other than the controller is refused: its bits are still consumed off the wire so stream alignment is not broken, but an `UnauthorizedMemberChangeViolation` is raised instead of the client state being applied.
