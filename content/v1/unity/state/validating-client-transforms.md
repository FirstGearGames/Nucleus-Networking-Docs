---
title: "Validating a client-authoritative NetworkTransform"
---

A client that controls a `NetworkTransform` moves its own object, and the server takes each position it sends. To stop a modified client teleporting or moving faster than your game allows, have the server judge every position against your own game state and decline the ones that cheat. The rules every validator follows are on [Judging and arbitrating client writes](../../core-api/state/validating-client-writes.md).

## Judge each position on the server

1. Write the rule in a script on the player prefab. Implement `IMemberWriteValidator<System.Numerics.Vector3>`, and compare the position the server holds, `networkMember.Value`, with the one the client sent. Read only state your server code decides, never a value the client wrote.

    ```csharp
    using Nucleus.Components;
    using Nucleus.Connections;
    using Nucleus.Integrations.Unity.Systems;
    using NumericsVector3 = System.Numerics.Vector3;

    public class PlayerMovementRules : NucleusBehaviour, IMemberWriteValidator<NumericsVector3>
    {
        public float WalkSpeed = 4f;
        public float BoostedSpeed = 10f;

        // Set by your server code, for example while the server sees the player on a speed pad.
        public bool IsBoosted;

        public MemberWriteAction ValidateMemberWrite(NetworkMember<NumericsVector3> networkMember, NumericsVector3 proposedValue, Connection writingClientConnection)
        {
            // Two ticks of movement per write, so a write that arrives a tick late is not refused.
            float maximumStep = (IsBoosted ? BoostedSpeed : WalkSpeed) * 2f / CoreManager.NetworkLoopManager.TickRate;

            return NumericsVector3.Distance(networkMember.Value, proposedValue) <= maximumStep ? MemberWriteAction.Accept : MemberWriteAction.Decline;
        }
    }
    ```

2. Subclass `NetworkTransform` and put your script in the position's `WriteValidator` field from `OnServerStarted`. It runs every time the server sets the object up, so the field is filled again after a pooled object is reused, which empties it.

    ```csharp
    using Nucleus.Integrations.Unity.Components;

    public class PlayerTransform : NetworkTransform
    {
        protected override void OnServerStarted()
        {
            if (NetworkSystem.TryGetComponent(out UnityTransformComponentBase transformComponent))
                transformComponent.Position.WriteValidator = GetComponent<PlayerMovementRules>();
        }
    }
    ```

    Do not declare `Awake`, `OnEnable` or `OnDisable` in the subclass. Unity would call yours in place of the `NetworkTransform`'s own, and the object would never replicate.

3. On the player prefab, replace `NetworkTransform` with your subclass and give it the same settings.

4. Play a host and a client. On the client, move your player 5 m in one frame.

The host's copy of the player stays where it was, and nothing reaches other players. Rotation and scale can be judged the same way through `Rotation` and `Scale`. When the `NetworkTransform` lists several transforms, reach entry *i* with `NetworkSystem.TryGetComponent((byte)i, out UnityTransformComponentBase transformComponent)`.

The position is measured in the transform's **Transform Space**. For a player with no parent, that is the world position.

## The client is put back after a decline

When the server declines a position, the `NetworkTransform` moves the client's player back to the position the server kept, and the client carries on moving from there. You write nothing for this.

## Leave room for honest movement

- Allow more than one tick of movement per write. A write can arrive a tick late, and a frame can straddle a tick.
- Cap the frame time your movement code uses at one tick, so a long frame cannot carry several ticks of walking into one write.
- Keep allowing a faster speed for a moment after it ends. The client learns that a boost ended a little after the server ends it.
- Expect a host's own player never to be judged. Its writes are the server's own.

## See it in the ValidatedMovement demo

The Unity integration's MemberWriteAccess/ValidatedMovement demo does all of this. Each player walks at 4 m/s, a speed pad the server checks allows 10 m/s for 3 seconds, T teleports 5 m, and holding H moves at four times the allowed speed. Open `ValidatedMovementDemo.unity`, press play in the main editor, then play a ParrelSync clone or a Multiplayer Play Mode player as the client and cheat from it. The demo's README.html walks through what to watch.
