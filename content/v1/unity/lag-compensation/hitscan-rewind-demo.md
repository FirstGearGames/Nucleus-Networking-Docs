---
title: "Worked example: the HitscanRewind demo"
---

## What the demo shows

The `LagCompensation/HitscanRewind` demo is one idea: the server judges a client's shot against the targets where that client saw them, not where they are by the time the shot arrives. Open `Scenes/HitscanRewindDemo.unity` in two editors (a ParrelSync clone or an MPPM virtual player becomes the client), play the main editor first, then click a moving target in the client's Game view. The demo folder's `README.html` walks through every step; this page reads the code as a template for your own game.

Three blue targets, each a capsule body with a sphere head, sweep side to side across the camera's view, fast enough mid-swing that the delay between server and client puts what you see well behind where they really are. The transport adds 75 milliseconds to every packet each way, so even two editors on one machine see the effect. There are no walls, so every miss is a miss in time rather than a miss behind cover.

## The targets: hitboxes copied from colliders

Each target prefab carries a `NetworkSystemObject` and a `NetworkHitboxRoot`, and its body and head each carry a `NetworkHitbox` left on `Automatic`, which copies the shape from the capsule and sphere colliders beside it. Nothing else is needed for the server to record them. Select a part while playing and the hitbox draws the exact shape the server records, in orange, over the collider's own outline.

The colliders stay on the targets. The client raycasts them to find its own hit for the on-screen comparison; the server never touches them, and tests its recorded hitboxes instead.

## The message: the shot travels whole

`HitscanShotMessage` carries the shot as a `LagCompensatedShot`, so its ray crosses the wire exactly, plus a few demo-only fields the comparison uses:

```csharp
[NetworkType]
public struct HitscanShotMessage : IMessage
{
    public bool IsAuthenticationRequired => true;

    public LagCompensatedShot Shot;
    public uint ShotNumber;
    public bool IsClientHit;
    public uint ClientTargetSystemId;
    public HitscanExactVector3 ClientHitPoint;
}
```

## The client half: two lines

`HitscanShooter.Fire` runs on the frame the click happens. It captures the shot and sends it:

```csharp
LagCompensatedShot lagCompensatedShot = _coreManager.LagCompensationManager.CaptureShot(ray.origin.ToNative(), ray.direction.ToNative());
```

```csharp
serverConnection.SendMessage(Channel.Reliable, hitscanShotMessage);
```

On a server, the same method skips the message and judges the shot at once with a `null` shooter. A server sees the world as it is, so its own shots are judged against the present.

## The server half: one query

`HitscanShooter.Judge` is the whole server side:

```csharp
LagCompensationManager lagCompensationManager = _coreManager.LagCompensationManager;
LagCompensatedShot lagCompensatedShot = hitscanShotMessage.Shot;
uint layerMask = (uint)_hitboxLayers.value;

bool isRewoundHit = lagCompensationManager.TryRaycast(shooterConnection, lagCompensatedShot.View, lagCompensatedShot.Origin, lagCompensatedShot.Direction, _range, layerMask, out LagCompensatedHit lagCompensatedHit);
bool isPresentHit = lagCompensationManager.TryRaycast(shooterConnection, default, lagCompensatedShot.Origin, lagCompensatedShot.Direction, _range, layerMask, out _);
```

The first call is the one a game needs: it rebuilds every hitbox where the shooter saw it and returns the nearest hit, with its system, hitbox index, point and normal. The second call passes an empty view, `default`, which means the present, only so the readout can count **Hits that only rewinding made**: shots that hit the rewound target but would have missed the present one. A real game makes only the first call.

The hit's `SystemId` leads to the target that records it, and the verdict goes back to the shooter in a reliable message.

## The comparison: how close the rebuild lands

Every hit leaves a grey copy of the target where the client saw it, with a cyan sphere where the client's own raycast hit and a yellow sphere where the server's rewound raycast hit. The client sends its own hit point with the shot, and when both hit the same target the server answers with the difference between the two points. They usually land within a few hundredths of a metre: the server has rebuilt the target where the client's screen showed it.

## The orbiting spheres: what a hitbox needs from replication

Between the first and second targets, two spheres orbit and swap between a close and a far orbit together. The left one carries its own `NetworkTransform`; the right one is posed by a `NetworkAnimator` with **Precise Playback** on, so the client poses its animator at the playback position the server sent. Both land where the server had them, to within a millimetre, so shots at either are judged against what the client saw. With Precise Playback off, the client runs its own copy of the animation from replicated parameters, a few centimetres from the server's pose: fine for looks, not for hitboxes. A hitbox is only as accurate as the replication that places the thing the player aims at.

## What to add in a real game

- **Walls.** The demo has none. A game with cover clips the shot first with [`LagCompensationWalls.GetDistance`](./clipping-shots-at-walls.md) and passes the result as the query's range.
- **Immediate feedback.** The demo's marker waits for the verdict, a round trip away. A game plays its own effect at once and lets the verdict confirm the damage.
- **Per-region damage.** Read a component on the hit hitbox's GameObject through `NetworkHitboxRoot.TryGetHitbox`; see [Making an object hittable](./making-an-object-hittable.md#layers-and-per-region-rules).
- **A rewind window that fits.** The demo keeps the default 500 milliseconds; see [UnityLagCompensationManager](./unity-lag-compensation-manager.md).
