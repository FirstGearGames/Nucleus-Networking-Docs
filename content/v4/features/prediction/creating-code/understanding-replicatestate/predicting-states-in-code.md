---
title: "Predicting States in Code"
description: "Due to the unpredictability of the Internet, inputs may drop or arrive late. Predicting states is a simple way to compensate for these events."
---

If your game is fast-paced and reaction based, even if not using physics, predicting states can be useful to _predict_ the next inputs you'll get from the server before you actually get them.

> [!INFO]
> Both the server and client can predict inputs.
>
> The server may predict inputs to accommodate for clients with unreliable connections.
>
> Clients would predict inputs on objects they do not own, or as we often call them "spectated objects".

By predicting inputs you can place objects in the future of where you know them to be, and even make them entirely real-time with the client. Keep in mind however, when predicting the future, if you guess wrong there will be a de-synchronization which may be seen as jitter when it's corrected in a reconcile.

Below is an example of a simple replicate method.

```csharp
// What data does is irrelevant in this example.
// We're only interested in how to predict a future state.
[Replicate]
private void RunInputs(ReplicateData data, ReplicateState state = ReplicateState.Invalid, Channel channel = Channel.Unreliable)
{
    float delta = (float)base.TimeManager.TickDelta;
    transform.position += new Vector3(data.Horizontal, 0f, data.Vertical) * _moveRate * delta;
}
```

Before we go any further you must first understand what each ReplicateState is. These change based on if input is known, replaying inputs or not, and more. You can check out the [ReplicateState API](https://fish-networking.com/FishNet/api/api/FishNet.Object.ReplicateState.html) which will explain thoroughly. You can also find this information right in the source of FishNet.

If you've read through ReplicateState and do not fully understand them please continue reading as they become more clear as this guide progresses. You can also visit us on Discord for questions!

Covered in the ReplicateStates API: `CurrentCreated` will only be seen on clients if they own the object. When inputs are received on spectated objects clients run them in the reconcile, which will have the state `ReplayedCreated`. Clients will also see `ReplayedFuture` and `CurrentFuture` on spectated objects.

A state ending in `Future` essentially means input has not been received yet, and these are the states you could predict.

Let's assume your game has a likeliness that players will move in the same direction regularly enough. If a player was holding forward for three ticks the input would look like this:

```csharp
(data.Vertical == 1)
(data.Vertical == 1)
(data.Vertical == 1)
```

But what if one of the inputs didn't arrive, or arrived late? The chances of inputs not arriving at all are pretty slim, but arriving late due to network variance is extremely common. If perhaps an input did arrive late the values may appear as something of this sort:

```csharp
(data.Vertical == 1)
(data.Vertical == 1)
(data.Vertical == 0) // Didn't arrive here, but will arrive late next tick.
(data.Vertical == 1) // This was meant to arrive the tick before, but arrived late.
```

Because of this interruption the player may seem to move forward twice, pause, then forward again. Realistically to help cover this up you will have interpolation on your graphical object as shown under the prediction settings for NetworkObject. The PredictionManager also offers QueuedInputs which can give you even more of a buffer. For the sake of this guide though we're going to pretend both of those didn't get the job done, and you need to account for the late input.

Below is a simple way to track and use known inputs to create predicted ones.

```csharp
private ReplicateData _lastCreatedInput = default;

[Replicate]
private void RunInputs(ReplicateData data, ReplicateState state = ReplicateState.Invalid, Channel channel = Channel.Unreliable)
{
    // If inputs are not known, you could predict all the way into CurrentFuture,
    // which would be real-time with the client. Though the more you predict
    // in the future the more you are likely to miss predict.
    if (state.IsFuture())
    {
        uint lastCreatedTick = _lastCreatedInput.GetTick();
        // If it's only been 2 ticks since the last created input then run the
        // logic below. This essentially means if the last created tick was 100,
        // this logic would run if the future tick was 102 or less.
        uint thisTick = data.GetTick();
        if ((data.GetTick() - lastCreatedTick) <= 2)
        {
            // We do not necessarily want to predict all states.
            // For example, it probably wouldn't make sense to predict
            // multiple jumps in a row. In this example only the movement
            // inputs are predicted.
            data.Vertical = _lastCreatedInput.Vertical;
        }
    }
    // If created data then set as lastCreatedInput.
    else if (state == ReplicateState.ReplayedCreated)
    {
        // If ReplicateData contains fields which could generate garbage you
        // probably want to dispose of the lastCreatedInput before replacing it.
        _lastCreatedInput.Dispose();
        // Assign newest value as last.
        _lastCreatedInput = data;
    }

    float delta = (float)base.TimeManager.TickDelta;
    transform.position += new Vector3(data.Horizontal, 0f, data.Vertical) * _moveRate * delta;
}
```

> [!WARNING]
> If your ReplicateData allocates, do not forget to dispose of the lastCreatedInput when the network is stopped.
