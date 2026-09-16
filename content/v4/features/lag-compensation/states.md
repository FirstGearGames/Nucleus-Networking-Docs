---
title: "States"
---
Sometimes need to be synchronized between clients and server to prevent desynchronization. This is generally only true when using client-side prediction. However, it is possible this guide could be used outside prediction so please keep that in mind when reading.

Ideally when using prediction the client should run all states locally as they would normally occur, just like the server. For example, if you were to drive a ship into the wall and want to apply a slow, the client and server would apply the state immediately when hitting the wall. In such a scenario the states would most likely exist in the replicate and reconcile data. However, there are cases when only a server is aware of a state, and if the server applies the state before the client does a desynchronization will occur. If this is the design you are intending, consider reworking your logic so clients and server run the same simulation instead; otherwise, continue reading!

A common state that requires synchronizing as example given is something that would impact movement. In this guide I'll be demonstrating on how to apply an EMP.

Since only the server is aware when the state is applied we will perform a check on the server, using the `base.IsServer` check. When the condition is satisfied as by our pretend `ApplyEmp()` method a RPC is sent.

```csharp
private void TimeManager_OnTick()
{
    /* We're going to pretend there is
     * some logic here which happens only on the
     * server resulting in applying a EMP.
     *
     * The EMP is set to apply 50ms in the future.
     * However many ticks used are up to you. The goal is
     * to give clients a chance to get the emp tick
     * before that tick actually runs on their end.
     * This will have clients all run the EMP at roughly
     * the same time, keeping in mind there is sometimes a
     * small margin of error of 1 tick. */
    if (base.IsServer && ApplyEMP())
    {
        uint futureTicks = base.TimeManager.TimeToTicks(0.05f, TickRounding.RoundUp);
        ObserversSetEMPTick(base.TimeManager.LocalTick + futureTicks);
    }
}

// RunLocally is used to the server also sets the emp tick.
[ObserversRpc(RunLocally = true)]
private void ObserversSetEMPTick(uint serverTick)
{
    // Converts the server EMP tick to local tick for this client.
    _empStartTick = base.TimeManager.TickToLocalTick(serverTick);
    // Set end tick. In our example the EMP will last 1 second.
    _empEndTick = _empStartTick + base.TimeManager.TimeToTicks(1f, TickRounding.RoundUp);
}
```

When the RPC is received two fields are set, a tick when to start the EMP and when to end it.

Next in our replicate method if the clients or servers `LocalTick` is within that EMP duration we prevent any further motor movement. As mentioned this example uses prediction but you could apply this to an `Update` loop as well if not using prediction.

```csharp
// Tick when to start emp.
private uint _empStartTick = uint.MaxValue;
// Tick when to end emp.
private uint _empEndTick = uint.MaxValue;

/* This is an example of a replicate data excluding the extra
 * parameters, given they have no context in this example. */
[Replicate]
private void Replicate(MotorData md)
{
    uint localTick = base.TimeManager.LocalTick;
    /* If localTick is between EMP range then return.
     * It's important to not reset the emp values because
     * we want these to be the same during replays. If you reset
     * values soon as the condition of exiting emp was satisfied
     * then emp would not be properly set during a replay.
     *
     * Note that this logic runs on the server and owner,
     * and if using prediction v2 can run on other clients
     * as well. */
    if (localTick >= _empStartTick && localTick <= _empEndTick)
    {
        /* Since under emp exit method early
         * to not process MotorData. In this example
         * we are using an EMP state, therefor the motor
         * will not work. You'll adjust this to whatever
         * your game needs. */
        return;
    }

    // Normal motor logic here.
}
```

Just like that the client is set to apply the EMP marginally in the future, and as will the server. Yes, this does create a very small delay on when the EMP or state begins but this is often considered acceptable to maintain a reliable simulation. In addition, also as said before, ideally the client will be running the same simulation as the server at all times which would let you avoid this sort of setup.
