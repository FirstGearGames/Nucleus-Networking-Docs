---
title: "Using prediction, from start to finish"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md) and [Reconciliation and replay](../../core-api/control/reconciliation.md).

This guide builds a predicted player from nothing: a character that walks and jumps the instant its player presses a key, while the server stays in charge of what really happens. Each step adds one piece and says why it is there.

This guide is a recreation of the `ValidatedJump` demo under `Demos/Prediction`. Open the demo beside this page to see the finished code running.

> **The demo, and the player this guide builds, cause desyncs on purpose.** Only the server changes the jumper's health, and the client cannot see it fall in time, so a jump pressed as health drops past the threshold is shown on the client and refused by the server. That gap exists to show prediction validation catching a wrong result and correcting the client. A real game would usually predict a drain the client can work out for itself.

The other pages in this category describe each piece in full. This one shows how they fit together.

## Prediction hides the round trip from the player who is driving.

Without prediction, a client presses a key, sends it to the server, and only sees its character move once the server's answer comes back. At 100 ms of round trip that delay is easy to feel.

With prediction, the client runs the same movement code itself the moment the key is pressed, so the character moves at once. The server runs that code too, with the same input, and checks the client's answer against its own. When they agree, nothing else happens. When they differ, the server sends its values, and the client rewinds to the tick that went wrong and replays every tick since then with the server's numbers. Nucleus does that rewind and replay for you.

Prediction only helps the player who controls the object. Everyone else sees the object the usual way, from the server's values. Read [When prediction is worth its cost](./when-prediction-is-worth-it.md) before predicting anything other than a player's own character.

## Every predicted member has one of three roles.

Prediction is chosen per `NetworkMember<T0>`, with the `role` constructor argument:

| Role | What it holds | Who writes it |
| --- | --- | --- |
| `MemberRole.Predict` | What the player asked for this tick, such as a walk direction or a jump press. This is called client state. | The controlling client, on its live tick. The server receives it every tick. |
| `MemberRole.Validate` | What the movement code works out from the client state, such as a position or a vertical speed. | Every peer that runs the movement code. The client's value is checked by the server and never trusted. |
| `MemberRole.Replicate` (the default) | Anything only the server decides, such as health. | The server. |

The usual predicted object uses all three. Keep that split in mind; nearly every prediction bug comes from a value sitting in the wrong role.

## Step 1: Declare the client state and the results in one component.

Put the members and the movement code in a `NetworkComponent`. A component runs on every peer whether or not a scene object is linked to it, which is what you want for code the client and the server must both run.

```csharp
using CodeBoost.Types;
using Nucleus.Components;
using NumericsVector3 = System.Numerics.Vector3;

namespace MyGame
{
    public partial class JumperComponent : NetworkComponent
    {
        // Client state: what the player asked for this tick.
        // The walk direction: x in X, z in Y.
        public readonly NetworkMember<Vector2Int> MoveDirection = new(role: MemberRole.Predict);
        public readonly NetworkMember<bool> IsJumpPressed = new(role: MemberRole.Predict, isCarriedForward: false);

        // Results: what the movement code works out from the client state.
        public readonly NetworkMember<NumericsVector3> Position = new(role: MemberRole.Validate, accuracy: ValueAccuracy);
        public readonly NetworkMember<float> VerticalSpeed = new(role: MemberRole.Validate, accuracy: ValueAccuracy);
        public readonly NetworkMember<bool> IsGrounded = new(role: MemberRole.Validate);

        // Only the server changes health, so it keeps the default role. This causes desyncs intentionally, to show prediction validation.
        public readonly NetworkMember<ushort> Health = new();

        public const float ValueAccuracy = 0.01f;
    }
}
```

Three choices in this declaration matter more than they look:

- **The walk direction is whole numbers.** It is a `CodeBoost.Types.Vector2Int`, not Unity's `Vector2Int`, whose axes are each -1, 0 or 1. A normalized float direction would be rounded on its way to the server, so the server would walk a hair differently from the client and report a mismatch on every tick. Send client state in a form that arrives exactly as it was written.
- **The jump press is never carried forward.** `IsJumpPressed` is true only on the tick jump was pressed, and `isCarriedForward: false` keeps it false on a tick whose client state was lost, so the server never jumps twice for one press. A press lost with its packet is simply lost: the client showed a jump the server never made, and the server corrects it like any other desync.
- **Each float result has an accuracy.** A `Validate` member is rounded to its `accuracy` on every write, on the client and on the server alike, so both peers carry on from the same numbers. Choose an accuracy your movement can tolerate being rounded to. 0.01 is a centimetre for a position.

## Step 2: Write the movement code once, in OnEarlyFixedUpdate.

`OnEarlyFixedUpdate` runs once per simulated tick. The engine calls it for the client's live tick, for the server's copy of that tick, and again for every tick a correction replays. Write the movement there and every one of those passes runs the same lines.

```csharp
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;

public partial class JumperComponent
{
    public const float MoveSpeed = 5f;
    public const float JumpSpeed = 7f;
    public const float Gravity = 20f;
    public const ushort JumpMinimumHealth = 50;

    protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
    {
        // A client watching someone else's jumper has nothing to simulate.
        if (simulationContext.Type is SimulationType.None)
            return;

        // The server's step for a tick whose client state never arrived: keep walking with the last tick's input, but never repeat a press.
        if (stepDelta.IsClientStateMissing)
            TryGetLastState(isEveryMemberCarried: false);

        if (IsJumpPressed.Value && IsGrounded.Value && Health.Value >= JumpMinimumHealth)
            VerticalSpeed.Value = JumpSpeed;

        Move(1f / CoreManager.NetworkLoopManager.TickRate);
    }

    private void Move(float deltaSeconds)
    {
        Vector2Int moveDirection = MoveDirection.Value;
        NumericsVector3 position = Position.Value;
        float diagonal = moveDirection.X != 0 && moveDirection.Y != 0 ? 1.41421354f : 1f;

        position.X += moveDirection.X / diagonal * MoveSpeed * deltaSeconds;
        position.Z += moveDirection.Y / diagonal * MoveSpeed * deltaSeconds;

        float verticalSpeed = VerticalSpeed.Value - Gravity * deltaSeconds;
        position.Y += verticalSpeed * deltaSeconds;

        bool isGrounded = position.Y <= 0f;

        if (isGrounded)
        {
            position.Y = 0f;
            verticalSpeed = 0f;
        }

        Position.Value = position;
        VerticalSpeed.Value = verticalSpeed;
        IsGrounded.Value = isGrounded;
    }
}
```

Follow these rules inside the movement code, or the client and the server will disagree:

- **Step by the tick, never by the frame.** Use `1f / CoreManager.NetworkLoopManager.TickRate`. `Time.deltaTime` is different on every machine and on every replayed tick.
- **Read only members and constants.** Everything the step reads must be the same on both peers for that tick. A value read from the scene, a static, `Random` or the current time is not, unless you make it so.
- **Keep the results in members.** The engine rewinds members, not your private fields. A field the step changes is not rewound, so the replay starts from the wrong value.
- **Use plain arithmetic, a `CharacterController` or a validated behaviour.** A replay steps the whole physics world once for each replayed tick, so a `Rigidbody` can be predicted too. Add a `ValidatedRigidbody` to the body and apply its forces in `OnEarlyFixedUpdate`; see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md).

## Step 3: Read the keys in Update and write them on the live tick.

A key press belongs to a rendered frame, so read the device in `Update`. Hand it to the component, and write it into the `Predict` members only on the live tick of the peer that controls the object. That tick has `SimulationType.Forward`. A replayed tick reads the client state recorded for it and must never overwrite it.

Add this to the component:

```csharp
public Vector2Int IntendedMoveDirection;

private bool _isJumpPressPending;

public void PressJump() => _isJumpPressPending = true;

private void WriteClientState()
{
    MoveDirection.Value = IntendedMoveDirection;

    IsJumpPressed.Value = _isJumpPressPending;
    _isJumpPressPending = false;
}

public override void OnReturn()
{
    base.OnReturn();

    IntendedMoveDirection = default;
    _isJumpPressPending = false;
}
```

Call it near the top of `OnEarlyFixedUpdate`, after the missing-state check:

```csharp
bool isLiveController = simulationContext.Type is SimulationType.Forward && NetworkSystem.IsController(ControllerType.AnyController);

if (isLiveController)
    WriteClientState();
```

Then feed the keys from a `NucleusBehaviour` on the prefab:

```csharp
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Systems;
using UnityEngine;

namespace MyGame
{
    public class Jumper : NucleusBehaviour<JumperComponent>
    {
        private void Update()
        {
            if (Component is null || !IsController(ControllerType.AnyController))
                return;

            // Replace with your project's input system.
            Component.IntendedMoveDirection = new(Mathf.RoundToInt(Input.GetAxisRaw("Horizontal")), Mathf.RoundToInt(Input.GetAxisRaw("Vertical")));

            if (Input.GetKeyDown(KeyCode.Space))
                Component.PressJump();
        }
    }
}
```

`ControllerType.AnyController` is true on the client that controls the object and on a host playing its own object, so the same script works in both. A host is the server, so its own object is never corrected.

## Step 4: Let the server set up the object and check the input.

Give the object its starting values on the server when it links:

```csharp
protected override void OnSystemLinked()
{
    if (IsStarted(Invoker.Server))
    {
        Component.Position.Value = new(transform.position.x, 0f, transform.position.z);
        Component.Health.Value = 100;
    }
}
```

Client state comes from a player's machine, so treat it as untrusted. Implement `IMemberWriteValidator<T0>` on the component to check each value on the server before the step reads it. This one stops a modified client from walking faster than a whole step per axis:

```csharp
public partial class JumperComponent : NetworkComponent, IMemberWriteValidator<Vector2Int>
{
    public MemberWriteAction ValidateMemberWrite(NetworkMember<Vector2Int> networkMember, Vector2Int proposedValue, Connection writingClientConnection)
    {
        Vector2Int clampedValue = new(System.Math.Clamp(proposedValue.X, -1, 1), System.Math.Clamp(proposedValue.Y, -1, 1));

        if (clampedValue.X == proposedValue.X && clampedValue.Y == proposedValue.Y)
            return MemberWriteAction.Accept;

        networkMember.Value = clampedValue;

        return MemberWriteAction.Decline;
    }
}
```

Writing the member and returning `Decline` keeps your corrected value. The server then simulates with it, its result differs from the client's, and the client is corrected onto the server's outcome. You do not need to validate `Validate` members at all: the server never uses the client's results, it works them out itself.

Finally, make health change on the server only. In the demo the server drains health while the jumper stands in a red zone:

```csharp
if (CoreManager.TransportManager.IsServerStarted)
    DrainOrRecoverHealth();
```

This causes desyncs intentionally, to show prediction validation. The client cannot see its own health fall in time, so it sometimes shows a jump the server refuses. The server catches it because it holds both the client state and the health, and orders a correction.

## Step 5: Draw the object every frame, and smooth the corrections.

The members change once per tick, but the screen draws many frames per tick. There are two ways to draw smoothly between ticks.

The first is to place the object on each tick and let a `GraphicalSmoother` glide a child graphic between those places. This is what the demo does. Put the collider and the root on the object, put the mesh on a child, add a `GraphicalSmoother`, and place the root in the behaviour's own `OnEarlyFixedUpdate`:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    System.Numerics.Vector3 position = Component.Position.Value;
    transform.position = new(position.X, position.Y, position.Z);
}
```

The component's step has already run for that tick, because a system runs its components before its behaviours. The smoother also glides across a correction, so a taken-back jump drops smoothly instead of snapping. See [Smoothing a predicted object with GraphicalSmoother](./graphical-smoother.md) for its settings.

The second is to render `InterpolatedValue` from `Update` and construct the member with `correctionSmoothingTicks`:

```csharp
public readonly NetworkMember<NumericsVector3> Position = new(role: MemberRole.Validate, accuracy: ValueAccuracy, correctionSmoothingTicks: 6);
```

```csharp
private void Update() => transform.position = Component.Position.InterpolatedValue.ToUnity();
```

`Value` is corrected at once, so the simulation is always right, while `InterpolatedValue` eases from what was on screen over six ticks.

## Step 6: Play effects once, on the live tick.

A replay runs your step again for every tick since the one that went wrong. Anything the step does that is not a member write happens again each time. Play sounds, particles and animation triggers only on the live tick:

```csharp
if (IsJumpPressed.Value && IsGrounded.Value && Health.Value >= JumpMinimumHealth)
{
    VerticalSpeed.Value = JumpSpeed;

    if (isLiveController)
        PlayJumpSound();
}
```

The engine already refuses the worst repeats during a replayed tick: remote calls, messages, predicted spawns, collection and reference writes and `NetworkAnimator` triggers do nothing, and each logs once. It cannot know about your own side effects, such as adding score or writing a static, so gate them yourself. `IsPredicting` and `SimulationType` on the behaviour tell code outside the fixed updates whether it is in a replay.

## Step 7: Undo what the player saw when the server disagreed.

A jump the client played and the server refused has already been seen. When you want to react, for example to cancel a jump sound or show a hit marker as missed, listen for the correction. `OnMembersChanged` on the component reports `MemberChangeDirection.Correction` for the members a correction changed, and `TryGetPreRewindValue` gives the value that was on screen before it:

```csharp
public readonly NetworkMember<ushort> JumpCount = new(role: MemberRole.Validate);

public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    if (memberChangeDirection is not MemberChangeDirection.Correction || (memberFlags & (ulong)JumperComponentFlags.JumpCount) == 0)
        return;

    if (JumpCount.TryGetPreRewindValue(out ushort shownJumpCount) && JumpCount.Value < shownJumpCount)
        CancelJumpEffects(shownJumpCount - JumpCount.Value);
}
```

`JumperComponentFlags` is generated for you from the component's members.

For a report of the whole correction, override `OnReplayCompleted` on the behaviour. `replayReport.StartTick` is the tick the replay started from, `replayReport.Mismatches` lists the members that were wrong there with a `MismatchCause`, and `replayReport.Corrections` lists the members whose present value the replay moved. See [Replaying a correction in Unity](./reconcile-in-unity.md).

## Step 8: Make the scene ready for prediction.

A few settings outside the code decide whether prediction works:

- **Test with a dedicated server and a separate client.** A host never predicts its own object, because it is already the server. Run the server in one editor and the client in a second editor or a clone, or you will never see a correction.
- **Give the client control of its object.** Prediction runs only on the controller. `NetworkPlayerSpawner` hands each joining client its player; to do it yourself, see [Giving a client control of an object](./transferring-control-in-unity.md).
- **Do not add a `NetworkTransform`.** The position is a `Validate` member that this code replicates itself. A `NetworkTransform` on the same object would fight it.
- **Check Prediction History Ticks on the system manager.** The default keeps 64 ticks, about a second at 60 ticks per second, which covers most games. A game played at very high latency needs more; see [Prediction settings on the Unity manager](./prediction-settings-in-unity.md).
- **Turn off Send Result Values for a release build.** While it is on, the client sends its result values beside the check every tick, so the server can name exactly what differed. That is useful while you develop and costs bandwidth in a shipped game.

## A healthy predicted object is corrected rarely.

Run the demo or your own scene with some latency and watch the counters:

- `NetworkSystem.ReconcileCount` on the client counts the corrections it applied.
- `Connection.ResultMismatchCount` and `Connection.ReconcileSentCount` on the server count the results it found different and the corrections it ordered for that client.
- `NetworkSystem.ResultMismatched` on the server reports which members differed and both values, while **Send Result Values** is on.

With no packet loss and no server-only changes, the count should stay at zero while you walk and jump. A count that climbs every tick means the client and the server are not running the same code on the same numbers. Look for these causes, most likely first:

1. **The step reads something that is not a member.** A Transform, a static, `Time.deltaTime`, `Random`, or a field that is not rewound.
2. **Client state is rounded on the wire.** A float input with no fixed step, so the server reads a slightly different value from the one the client wrote.
3. **A result has no accuracy, or one too fine for the step.** Give each float `Validate` member an accuracy.
4. **Client state is written on a replayed tick.** Only the `Forward` tick of the controller may write it.
5. **The prediction history is too short.** The log warns once per object that the server's value was older than the history holds, and the mismatch cause reads `MismatchCause.HistoryMissing`.

For a wider checklist, see [Diagnosing desync](../diagnostics/diagnosing-desync.md).

## Prediction goes further than one player.

When the basics work, these pages cover the next steps:

- **Predict other players' objects too.** Tick **Predicted By Observers** on a `NetworkSystemObject` so that observing clients predict it as its controller does, which matters for players who collide or push each other. See [Prediction settings on the Unity manager](./prediction-settings-in-unity.md).
- **Hold only the nearby crowd during a replay.** Set **Replay Hold Radius** on the system manager so a replay holds only the objects near the ones it restores.
- **Spawn objects before the server answers.** A projectile can appear the instant it is fired and be confirmed or refused later. Predicted spawning is a Pro feature; see [Client-predicted spawning in Unity](../systems/predicted-spawning.md) and the two `PredictedProjectile` demos under `Demos/Prediction`.
- **Predict a physics body.** Add a `ValidatedRigidbody` and push the body from `OnEarlyFixedUpdate`; see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md). For a body the server simulates while a client steers it, see [Driving a predicted body](../physics/driving-a-predicted-body.md).
- **Keep client state flowing through loss.** `TryGetLastState`, carried members, and the late and dropped counts on `Connection` are covered in [Sending client state from Unity](./writing-a-client-state-component-unity.md).
