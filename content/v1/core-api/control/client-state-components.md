---
title: "Client state"
---

> **Using Unity?** See [Sending client state from Unity](../../unity/control/writing-a-client-state-component-unity.md).

Client state is what the controlling client sends the server every tick so the server can simulate the object: a move direction, a jump press, an aim angle. The server runs the same step from those values and replicates the result, so it only trusts what the player asked for, never where the player says it ended up.

## Declare client state as Predict members

Client state is ordinary `NetworkMember<T0>` fields constructed with `role: MemberRole.Predict`, declared in the system's own `NetworkComponent` beside the members the simulation computes from them. There is no separate class to write and nothing to register.

```csharp
using System.Numerics;
using Nucleus.Components;
using Nucleus.Connections;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;

public partial class MoverComponent : NetworkComponent, IMemberWriteValidator<Vector2>
{
    // Client state: written by the controller on its live tick, sent upstream every tick.
    public readonly NetworkMember<Vector2> MoveDirection = new(role: MemberRole.Predict);
    // A press that must not repeat when a missing tick is carried forward.
    public readonly NetworkMember<bool> JumpPressed = new(role: MemberRole.Predict, isCarriedForward: false);
    // A member the server computes from the client state.
    public readonly NetworkMember<Vector3> Position = new();

    // Set by the game from the device on the controlling client.
    public Vector2 IntendedDirection;

    private const float Speed = 5f;

    // Server: once per Predict member per client tick taken. Write the member and decline to keep your own value.
    public MemberWriteAction ValidateMemberWrite(NetworkMember<Vector2> networkMember, Vector2 proposedValue, Connection writingClientConnection)
    {
        if (proposedValue.LengthSquared() <= 1f)
            return MemberWriteAction.Accept;

        MoveDirection.Value = Vector2.Normalize(proposedValue);

        return MemberWriteAction.Decline;
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

`Position` here is an ordinary member the server computes, so the controller sees its own movement a round trip late. To have the controller move at once and be corrected only when it is wrong, make the result `MemberRole.Validate` and let both peers run the step; see [Predicted members and prediction history](./prediction-history-and-predicted-members.md).

## Write it in the fixed update on the controller's live tick

- Whoever controls the system writes its Predict members: the controlling client on its live tick (`SimulationType.Forward`), or the server for a system it controls.
- Write them inside the fixed update, from values the game gathered between ticks, so every pass of a tick reads the same numbers.
- A replay never writes them. It reads each past tick's value from the member's history.

A pure client sends its Predict members to the server every tick, stamped with its tick. A lost tick of client state never breaks the ticks after it.

A host playing its own object writes the members in the same process, so nothing travels upstream. Each tick it still puts their values to the same validator a remote controller faces, and a declined value is reported to it as a correction.

## Validate client state on the server

Implement `IMemberWriteValidator<T0>` on the component, once per member type. The server calls it once per Predict member for each client tick it takes:

```csharp
MemberWriteAction ValidateMemberWrite(NetworkMember<T0> networkMember, T0 proposedValue, Connection writingClientConnection);
```

- `MemberWriteAction.Accept` takes the client's value.
- `MemberWriteAction.Decline` keeps what the member already holds.
- To clamp rather than refuse, write the member inside the call and decline. The server keeps your value, simulates with it and forwards it.
- A validator that throws declines.

Several members of one type share one implementation, so compare the `networkMember` argument against your fields when they need different rules. The same interface judges a client's writes to ordinary members; see [Validating client writes](../state/validating-client-writes.md).

## The server takes one tick of client state per server tick

The server takes one of the controller's ticks per server tick, released through the State Interpolation like any other state, so a burst that arrives together is spread over the ticks that follow. For each tick it runs the validator, then steps the system with its Predict members holding that tick's values.

The controller's `Connection` counts the ticks that went wrong:

```csharp
public uint ClientStateDroppedCount { get; }
public uint ClientStateLateCount { get; }
public uint ClientStateReanchorCount { get; }
```

- **Dropped**: a tick the server could not take in time.
- **Late**: a tick that arrived after its tick was simulated.
- **Re-anchored**: a client that stalled and resumed, whose client state arrived further behind the ticks the server already simulated for it than the State Interpolation. The server re-bases onto the client's ticks and sends a reconcile for each system the client controls.

The server's step is stamped with the server's own tick in `StepDelta.Tick`. The controller's tick it simulates is in `SimulationContext.RemoteTick`, for pairing and logging only. A client chooses its own tick numbers, so never time a cooldown or anything else by it. See [The simulation context](./reconciliation.md#the-simulation-context).

## Carry client state over ticks that did not arrive

A system a remote client drives is simulated on every server tick, whether or not that tick's client state arrived: before the first one, and while the client's packets are lost. That lets the server act on the object in its own world, for a collision for instance. On such a step `StepDelta.IsClientStateMissing` and `SimulationContext.IsRemoteTickEstimated` are true, and every Predict member reads its default. To carry the previous tick's client state forward instead, call the component's:

```csharp
public bool TryGetLastState(bool isEveryMemberCarried)
```

- For the rest of the step, the Predict members read their values as they stood at the end of the previous tick: the client's own when that tick's arrived, and otherwise whatever the server's step left in them. A value the server writes into a member is what the next tick carries.
- Pass `false` to keep members constructed with `isCarriedForward: false` at their defaults, so a jump press never fires twice. A press lost with its packet is lost, and the server corrects the jump the client showed.
- It returns `false`, leaving the defaults, before any client state has arrived.
- Nothing is carried unless you call it, so a game that does not carry is reconciled back to what the server simulated.

A tick runs as missing only once the State Interpolation says it should have arrived. Just after the client's states stall, or with a client clock running slower than the server's, the next client tick runs when it arrives instead, so those server ticks pass the object by.

### Stop a carry that has gone on too long

This overload also reports the simulation context of the client state you are carrying:

```csharp
public bool TryGetLastState(bool isEveryMemberCarried, out SimulationContext lastStateSimulationContext)
```

On a missing step, `lastStateSimulationContext` is the context of the newest step this component's client state arrived for. On the server its `RemoteTick` is the controller's tick that state was written on and `IsRemoteTickEstimated` is false, so the missing step's own `RemoteTick` minus it is how many ticks you are carrying it over:

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

On a step that is not missing, it is the context of the step running now. Before any client state has arrived, or on a component with no Predict member, it is the default, whose `RemoteTick` is unset. Compare these ticks, but never time anything on the server by them.

## Every observer receives the client state

The server forwards the Predict values it kept, after validation and its own writes, to every observer of the system, the controller included. Observers can drive presentation (footsteps, animation) from them, and an observer that predicts the system simulates from them (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).

On the controller, a server value for a past tick that differs from its own lands in that tick's history, so a later replay of that tick reads what the server simulated. This includes values the server writes from its own step.

## React to changes with OnMembersChanged

`OnMembersChanged` reports Predict members on change, not every tick:

- `MemberChangeDirection.Read` on the server when it takes a client value that differs (`TryGetWritingClient` names the sender), and on an observer receiving a changed value.
- `MemberChangeDirection.Correction` on the controller when the server's value for one of its past ticks differs from its own. The server's value is already in the member's history at that tick when the callback runs.

The simulation reads the members every tick in its fixed update anyway, so use the callback for presentation or to react to a correction.

## Only the controller may send client state

Client state is controller-only, whatever the system's write access allows. Client state from any other connection is refused and raises an `UnauthorizedMemberChangeViolation`.
