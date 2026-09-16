---
title: "Non-Controlled Object"
---
Many games will require physics bodies to be networked, even if not controlled by players or the server. These objects can also work along-side the new state system by adding a basic prediction script on them.

It's worth noting that you can also 'control' non-owned objects on the server by using `base.HasAuthority`. This was discussed previously here.

## Sample script

Below is a full example script to synchronize a non-controlled rigidbody. Since the rigidbody is only reactive, input polling is not needed. Otherwise you'll find the data structures are near identical to the ones where we took input.

> It is strongly recommended to review the controlling objects guide for additional notes in understanding the code below.

```csharp
public class RigidbodySync : NetworkBehaviour
{
    // Replicate structure.
    public struct ReplicateData : IReplicateData
    {
        // The uint isn't used but Unity C# version does not
        // allow parameter-less constructors we something
        // must be set as a parameter.
        public ReplicateData(uint unused) : this() {}

        private uint _tick;
        public void Dispose() { }
        public uint GetTick() => _tick;
        public void SetTick(uint value) => _tick = value;
    }

    // Reconcile structure.
    public struct ReconcileData : IReconcileData
    {
        public PredictionRigidbody PredictionRigidbody;

        public ReconcileData(PredictionRigidbody pr) : this()
        {
            PredictionRigidbody = pr;
        }

        private uint _tick;
        public void Dispose() { }
        public uint GetTick() => _tick;
        public void SetTick(uint value) => _tick = value;
    }

    // Forces are not applied in this example but you
    // could definitely still apply forces to the PredictionRigidbody
    // even with no controller, such as if you wanted to bump it
    // with a player.
    private PredictionRigidbody PredictionRigidbody;

    private void Awake()
    {
        PredictionRigidbody = ResettableObjectCaches<PredictionRigidbody>.Retrieve();
        PredictionRigidbody.Initialize(GetComponent<Rigidbody>());
    }

    private void OnDestroy()
    {
        ResettableObjectCaches<PredictionRigidbody>.StoreAndDefault(ref PredictionRigidbody);
    }

    // In this example we do not need to use OnTick, only OnPostTick.
    // Because input is not processed on this object you only
    // need to pass in default for RunInputs, which can safely
    // be done in OnPostTick.
    public override void OnStartNetwork()
    {
        base.TimeManager.OnPostTick += TimeManager_OnPostTick;
    }

    public override void OnStopNetwork()
    {
        base.TimeManager.OnPostTick -= TimeManager_OnPostTick;
    }

    private void TimeManager_OnPostTick()
    {
        RunInputs(default);
        CreateReconcile();
    }

    [Replicate]
    private void RunInputs(ReplicateData md, ReplicateState state = ReplicateState.Invalid, Channel channel = Channel.Unreliable)
    {
        // If this object is free-moving and uncontrolled then there is no logic.
        // Just let physics do it's thing.
    }

    // Create the reconcile data here and call your reconcile method.
    public override void CreateReconcile()
    {
        ReconcileData rd = new ReconcileData(PredictionRigidbody);
        ReconcileState(rd);
    }

    [Reconcile]
    private void ReconcileState(ReconcileData data, Channel channel = Channel.Unreliable)
    {
        // Call reconcile on your PredictionRigidbody field passing in
        // values from data.
        PredictionRigidbody.Reconcile(data.PredictionRigidbody);
    }
}
```
