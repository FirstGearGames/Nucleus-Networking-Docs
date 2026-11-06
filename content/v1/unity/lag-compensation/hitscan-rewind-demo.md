---
title: "Worked example: the HitscanRewind demo"
---

The `LagCompensation/HitscanRewind` demo shows the server judging a client's shot against the targets where that client saw them, not where they are when the shot arrives. The demo folder's `README.html` covers it step by step; this page reads its code as a template for your own game.

## Run the demo

1. Open `Scenes/HitscanRewindDemo.unity` in two editors. A ParrelSync clone becomes the client.
2. Press Play in the main editor first, then in the client.
3. Click a moving target in the client's Game view.

Three blue targets, each a capsule body with a sphere head, sweep across the view fast enough that what the client sees is well behind where they really are. The transport adds 75 milliseconds to every packet each way, so two editors on one machine still see the effect. There are no walls, so every miss is a miss in time, not behind cover.

## The targets copy their hitboxes from colliders

Each target prefab carries a `NetworkSystemObject` and a `NetworkHitboxRoot`. Its body and head each carry a `NetworkHitbox` left on `Automatic`, which copies the shape from the capsule and sphere colliders beside it. Nothing else is needed for the server to record them.

The colliders stay on the targets because the client raycasts them to find its own hit for the on-screen comparison. The server never touches them.

## The message carries the shot whole

`HitscanShotMessage` carries the shot as a `LagCompensatedShot`, so its ray arrives exactly as captured. The other fields are demo-only, for the comparison:

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

## The client captures and sends

`HitscanShooter.Fire` runs on the frame the click happens. It captures the shot and sends it:

```csharp
LagCompensatedShot lagCompensatedShot = _coreManager.LagCompensationManager.CaptureShot(ray.origin.ToNative(), ray.direction.ToNative());
```

```csharp
serverConnection.SendMessage(Channel.Reliable, hitscanShotMessage);
```

On a server, the same method skips the message and judges the shot at once with a `null` shooter, against the present.

## The server makes one query

`HitscanShooter.Judge` is the whole server side:

```csharp
LagCompensationManager lagCompensationManager = _coreManager.LagCompensationManager;
LagCompensatedShot lagCompensatedShot = hitscanShotMessage.Shot;
uint layerMask = (uint)_hitboxLayers.value;

bool isRewoundHit = lagCompensationManager.TryRaycast(shooterConnection, lagCompensatedShot.View, lagCompensatedShot.Origin, lagCompensatedShot.Direction, _range, layerMask, out LagCompensatedHit lagCompensatedHit);
bool isPresentHit = lagCompensationManager.TryRaycast(shooterConnection, default, lagCompensatedShot.Origin, lagCompensatedShot.Direction, _range, layerMask, out _);
```

The first call is the one a game needs. It returns the nearest hit against the hitboxes where the shooter saw them, with its system, hitbox index, point and normal. The second passes an empty view, `default`, which means the present, only so the readout can count **Hits that only rewinding made**. A real game makes only the first call.

The hit's `SystemId` leads to the target, and the verdict goes back to the shooter in a reliable message.

## Every hit shows how close the rebuild landed

Every hit leaves a grey copy of the target where the client saw it, a cyan sphere where the client's own raycast hit, and a yellow sphere where the server's rewound raycast hit. When both hit the same target, the server answers with the distance between the two points, usually a few hundredths of a metre.

## The orbiting spheres show what a hitbox needs from replication

Two spheres between the first and second targets orbit and swap between a close and a far orbit together. The left one carries its own `NetworkTransform`. The right one is posed by a `NetworkAnimator` with **Precise Playback** on, so the client poses its animator at the playback position the server sent. Both land within 0.001 metres of where the server had them, so shots at either are judged against what the client saw.

With **Precise Playback** off, the client runs its own copy of the animation and lands a few hundredths of a metre from the server's pose: fine for looks, not for hitboxes. A hitbox is only as accurate as the replication that places what the player aims at.

## Add these in a real game

- **Walls.** Clip the shot first with [`LagCompensationWalls.GetDistance`](./clipping-shots-at-walls.md) and pass the result as the query's range.
- **Immediate feedback.** The demo's marker waits a round trip for the verdict. Play your own effect at once and let the verdict confirm the damage.
- **Per-region damage.** Read a component on the hit hitbox's GameObject through `NetworkHitboxRoot.TryGetHitbox`; see [Making an object hittable](./making-an-object-hittable.md#layers-and-per-region-rules).
- **A rewind window that fits.** The demo keeps the default 500 milliseconds; see [UnityLagCompensationManager](./unity-lag-compensation-manager.md).
