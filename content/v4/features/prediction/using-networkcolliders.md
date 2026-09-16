---
title: "Using NetworkColliders"
---
Using each NetworkCollider component is the same, and can be used very similar to Unity callbacks.

When using client-side prediction the `NetworkCollider` components are designed to accurately dispatch Enter, Stay, and Exit callbacks for collisions and triggers.

All events have the same name across each component: `NetworkCollider`, `NetworkCollider2D`, `NetworkTrigger`, and `NetworkTrigger2D`. What is returned in each event naturally will vary, depending on which component you use. For example, the `NetworkCollision` component will return `Collider` for what was intersected, while `NetworkCollision2D` will return `Collider2D`.

> Our `OnStay` callback does not return `Collision` as you would expect with the Unity version. Due to Unity limitations we are unable to provide a `Collision` callback without hotpath allocations.
>
> If you require `Collision` to be returned please use the Unity `OnStay` callback instead; this will function properly with prediction.

## Callbacks

`OnEnter` is invoked when this collider has entered the bounds of another collider.

`OnStay` is invoked when this collider remains in contact with another.

`OnExit` is invoked when this collider has exited the bounds of another collider.

> Keep in mind each callback description varies if you are using Collision, Trigger, or their 2D counterparts. None-the-less, they behave just like Unity callbacks.

## Usage

This example script is placed on the player object. Our script demonstrates subscribing to all three events and using the `OnEnter` event to play a sound, as well applying forces to 'this' player.

```csharp
// We are assuming this script inherits NetworkBehaviour.
[SerializeField]
private AudioSource _hitSound;

private NetworkCollision _networkCollision;

private void Awake()
{
    // Get the NetworkCollision component placed on this object.
    // You can place the component anywhere you would normally
    // use Unity collider callbacks!
    _networkCollision = GetComponent<NetworkCollision>();

    // Subscribe to the desired collision event
    _networkCollision.OnEnter += NetworkCollisionEnter;
    _networkCollision.OnStay += NetworkCollisionStay;
    _networkCollision.OnExit += NetworkCollisionExit;
}

private void OnDestroy()
{
    // Since the NetworkCollider is placed on the same object as
    // this script we do not need to unsubscribe; the callbacks
    // will be destroyed with the object.
    // But if your NetworkCollider resides on another object you
    // likely will want to unsubscribe to your events as well as shown.
    if (_networkCollision != null)
    {
        _networkCollision.OnEnter -= NetworkCollisionEnter;
        _networkCollision.OnStay -= NetworkCollisionStay;
        _networkCollision.OnExit -= NetworkCollisionExit;
    }
}

private void NetworkCollisionEnter(Collider other)
{
    // Only play the sound effect when not currently reconciling.
    // If you were to play the sound also during reconciliations
    // the audio would execute each reconcile, each tick, until the
    // player was no longer reconciling into the collider.
    if (!base.PredictionManager.IsReconciling)
        _hitSound.Play();

    // Always apply velocity to this player on enter, even if reconciling.
    PlayerMover pm = GetComponent<PlayerMover>();
    // For this example we are pushing away from the other object.
    Vector3 dir = (transform.position - other.gameObject.transform).normalized;
    pm.PredictionRigidbody.AddForce(dir * 50f, ForceMode.Impulse);
}

private void NetworkCollisionStay(Collider other)
{
    // Handle collision stay logic
}

private void NetworkCollisionExit(Collider other)
{
    // Handle collision exit logic (e.g., deactivate visual effects)
}
```

You may be wondering what is `PredictionRigidbody` and why did we apply forces to that instead of the `Rigidbody` directly. `PredictionRigidbody` (and 2D) is a mandatory but still simple way to apply forces to predicted rigidbodies. You can learn more about its usage here.
