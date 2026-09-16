---
title: "PredictionRigidbody"
---
This class provides accurate simulations and re-simulations when applying outside forces, most commonly through collisions.

Using `PredictionRigidbody` is very straight forward. In short, you move from applying force changes to the rigidbody onto the `PredictionRigidbody` instance instead.

View the Creating Code guide for using `PredictionRigidbody` in your replicate and reconcile methods.

## Using outside the script

As mentioned above you should always apply forces to the `PredictionRigidbody` rather than the `Rigidbody` directly. Our first guides demonstrate how to do this within the replicate method, as well how to reconcile using the `PredictionRigidbody`, but do not show how to add forces from outside scripts, such as a bumper in your game.

There is virtually no complexity to adding outside forces other than remembering to add them again, to the `PredictionRigidbody` and not the `Rigidbody`.

The example below is what it might look like if using a trigger on a world object to repel the player.

> **Important:** For triggers and collisions to work properly with prediction you must use our `NetworkTrigger`/`NetworkCollision` components. Otherwise, due to a Unity limitation, such interactions would not work. You can learn more about those components here.

> Fun fact: Fish-Networking is the only framework that has the ability to simulate Enter/Exit events with prediction; not even Fusion does this!

```csharp
private void NetworkTrigger_OnEnter(Collider other)
{
    // Add upward impulse when hitting this trigger.
    if (other.TryGetComponent<RigidbodyPlayer>(out rbPlayer))
        rbPlayer.PredictionRigidbody.AddForce(Vector3.up, ForceMode.Impulse);

    // Do not call Simulate on the PredictionRigidbody here. That should only be done
    // within the replicate method.
}
```

There is a fair chance a number of controllers will want to set velocities directly as well. `PredictionRigidbody` does support this. We encourage you to review the `PredictionRigidbody` API for all available functionality.

Our last example demonstrates setting velocities directly.

> You would still call `PredictionRigidbody.Simulate()` regardless of how velocities are set.

```csharp
float horizontal = data.Horizontal;
Vector3 velocity = new Vector3(data.Horizontal, 0f, 0f) * _moveRate;
PredictionRigidbody.Velocity(velocity);
```
