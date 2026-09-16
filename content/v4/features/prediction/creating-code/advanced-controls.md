---
title: "Advanced Controls"
---
This guide supplements the basic prediction guide by showing how to introduce more complexities to your controls.

> Be sure to review the previous guides in this section before reviewing this page.

## Guide goal

Implementing additional features into your prediction is much like you would code in a single player game, only remembering to reconcile anything that could de-synchronize the prediction.

In this guide a pseudo ground check before a jump will be added, as well as a sprint function.

## Sprinting and ground checks

First the `ReplicateData` needs to be updated to contain our sprint action, which will rely on a stamina mechanic. Not much changed other than we added the `Sprint` boolean and set it using the constructor.

```csharp
public struct ReplicateData : IReplicateData
{
    public bool Jump;
    public bool Sprint;
    public float Horizontal;
    public float Vertical;

    public ReplicateData(bool jump, bool sprint, float horizontal, float vertical) : this()
    {
        Jump = jump;
        Sprint = sprint;
        Horizontal = horizontal;
        Vertical = vertical;
    }

    private uint _tick;
    public void Dispose() { }
    public uint GetTick() => _tick;
    public void SetTick(uint value) => _tick = value;
}
```

After updating the `ReplicateData` we need to poll for the sprint key when creating the data, like you would in most games.

We are re-using methods from our previous guides so much of this should be familiar.

```csharp
private ReplicateData CreateReplicateData()
{
    if (!base.IsOwner)
        return default;

    // Build the replicate data with all inputs which affect the prediction.
    float horizontal = Input.GetAxisRaw("Horizontal");
    float vertical = Input.GetAxisRaw("Vertical");
    /* Sprint if left shift is held.
     * You do not necessarily have to perform security checks here.
     * For example, it was mentioned sprint will rely on stamina, we
     * are not checking the stamina requirement here. You certainly could
     * as a precaution but this is only building the replicate data, not where
     * the data is actually executed, which is where we want
     * the check. */
    bool sprint = Input.GetKeyDown(KeyCode.LeftShift);
    ReplicateData md = new ReplicateData(_jump, sprint, horizontal, vertical);
    _jump = false;

    return md;
}
```

Declare a stamina float in your class.

```csharp
// Current stamina for the player.
private float _stamina;
```

Now use our new `Sprint` bool and stamina field to apply sprinting within the replicate method.

```csharp
[Replicate]
private void RunInputs(ReplicateData data, ReplicateState state = ReplicateState.Invalid, Channel channel = Channel.Unreliable)
{
    float delta = (float)base.TimeManager.TickDelta;

    // Regenerate stamina at 3f per second.
    _stamina += (3f * delta);

    // How much it cost to use sprint per delta.
    // This causes sprint to use stamina twice as fast
    // as the stamina recharges.
    float sprintCost = (6f * delta);

    Vector3 forces = new Vector3(data.Horizontal, 0f, data.Vertical) * _moveRate;

    // If sprint is held and enough stamina exist then multiple forces.
    if (data.Sprint && _stamina >= sprintCost)
    {
        // Reduce stamina by cost.
        _stamina -= sprintCost;
        // Increase forces by 30%.
        forces *= 1.3f;
    }

    /* You should check for any changes in replicate like we do
     * with stamina. Recall how it was said checking stamina when
     * gathering the inputs is not so important, but doing so in the replicate
     * is what grants server authority, as well makes prediction function
     * properly with corrections and rollbacks. */

    /* Now check if to jump. IsGrounded() does not exist, we're going to
     * pretend it uses a raycast or overlap to check. */
    if (data.Jump && IsGrounded())
    {
        Vector3 jmpFrc = (Vector3.up * _jumpForce);
        PredictionRigidbody.AddForce(jmpFrc, ForceMode.Impulse);
    }

    // Rest of the code remains the same.
}
```

> **Warning:** If a value can affect your prediction do not store it outside the replicate method, unless you are also reconciling the value. An exception applies if you are setting the value inside your replicate method.
>
> This is a very important detail to remember, and is discussed further below.

Reconciling only a rigidbody state is very simple.

```csharp
[Reconcile]
private void ReconcileState(ReconcileData data, Channel channel = Channel.Unreliable)
{
    // Call reconcile on your PredictionRigidbody field passing in
    // values from data.
    PredictionRigidbody.Reconcile(data.PredictionRigidbody);
}
```

> If you are using multiple rigidbodies you at the very least need to reconcile their states as well. You can do so quickly by adding a `RigidbodyState` for each rigidbody to your reconcile.
>
> If you are also applying forces to these rigidbodies be sure to use `PredictionRigidbody` with them, and reconcile the `PredictionRigidbody` instead of `RigidbodyState`.

## Changes to reconcile

Because objects can reconcile to previous states it's fundamental to also reconcile any values stored outside the replicate method. Imagine if you had 10f stamina, enough to sprint, and did so successfully on the server and owner. After your sprint you only had 1f stamina, not enough to sprint further.

If you were to reconcile without resetting stamina to its previous values then you would still be at 1f stamina after reconciling. Your replayed inputs, which previously allowed the sprint, would not sprint because you now lacked the needed stamina. In result of this, you would have a de-synchronization which would most likely be seen as jitter.

Including more variables in your prediction is fortunately easy enough. All you have to do is update your reconcile to include states or your new values or variables.

Added to our `ReconcileData` structure is a `Stamina` float.

```csharp
public struct ReconcileData : IReconcileData
{
    public PredictionRigidbody PredictionRigidbody;
    public float Stamina;

    public ReconcileData(PredictionRigidbody pr, float stamina) : this()
    {
        PredictionRigidbody = pr;
        Stamina = stamina;
    }

    private uint _tick;
    public void Dispose() { }
    public uint GetTick() => _tick;
    public void SetTick(uint value) => _tick = value;
}
```

Then of course we must include the current value of stamina within our created reconcile data.

```csharp
public override void CreateReconcile()
{
    ReconcileData rd = new ReconcileData(PredictionRigidbody, _stamina);
    ReconcileState(rd);
}
```

Very last you must utilize the new reconcile data to reset the stamina state.

```csharp
[Reconcile]
private void ReconcileState(ReconcileData data, Channel channel = Channel.Unreliable)
{
    PredictionRigidbody.Reconcile(data.PredictionRigidbody);
    _stamina = data.Stamina;
}
```

With minor additions to the code you now have an authoritative ground check as well as a stamina driven sprint.
