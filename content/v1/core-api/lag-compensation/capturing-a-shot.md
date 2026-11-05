---
title: "Capturing a shot"
---

> **Using Unity?** See [Firing and judging a shot](../../unity/lag-compensation/firing-and-judging-a-shot.md).

## Capture on the frame the shot is fired

```csharp
LagCompensatedShot lagCompensatedShot = coreManager.LagCompensationManager.CaptureShot(origin, direction);
```

`CaptureShot(Vector3 origin, Vector3 direction)` returns a `LagCompensatedShot` with the origin and direction unchanged and the view that `CaptureView()` returns at that moment. The direction does not need to be of unit length.

Call it on the frame the player fires, not when the next tick's client state is built. Each rendered frame within a tick shows a different moment, so a view taken a frame later is not what the player aimed at.

## Send the shot whole

Put the `LagCompensatedShot` itself in a message, a remote call argument or a client state member:

```csharp
using Nucleus.Managers.LagCompensation;
using Nucleus.Managers.Messages;
using Nucleus.Serializers;

[NetworkType]
public struct ShotMessage : IMessage
{
    public LagCompensatedShot Shot;
}
```

```csharp
if (coreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
    serverConnection.SendMessage(Channel.Reliable, new ShotMessage { Shot = lagCompensatedShot });
```

Do not copy the origin and direction into plain `Vector3` fields. A plain `Vector3` is sent at lower precision, which can turn the direction enough to miss a headshot at range: roughly 0.04 metres off at 50 metres and 0.09 metres at 100 metres. A `LagCompensatedShot` keeps full precision. An infinity or NaN in either vector arrives as zero.

`LagCompensatedShot` is compared bit for bit, view included, so a member holding one sees each new shot as a change.

## Pass the shot to a query on the server

The shot's `View`, `Origin` and `Direction` are the query's arguments:

```csharp
LagCompensatedShot shot = shotMessage.Shot;

bool isHit = coreManager.LagCompensationManager.TryRaycast(messageContext.SenderConnection, shot.View, shot.Origin, shot.Direction, maximumDistance, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

See [Judging a shot with rewound queries](./rewound-queries.md) for every query.

## A 2D shot captures with a Z of zero

Capture with a Z of zero, then read the shot back through `Origin2D` and `Direction2D` for the 2D queries:

```csharp
LagCompensatedShot lagCompensatedShot = coreManager.LagCompensationManager.CaptureShot(new Vector3(origin2D, 0f), new Vector3(direction2D, 0f));
```

```csharp
bool isHit = coreManager.LagCompensationManager.TryRaycast2D(messageContext.SenderConnection, shot.View, shot.Origin2D, shot.Direction2D, maximumDistance, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

## Capture a view alone

A shot that is not a ray, such as a melee swing whose volume the server builds, only needs the view. `CaptureView()` returns the `LagCompensationView` on screen now, and the server passes it to an overlap query. A `LagCompensationView` is a `[NetworkType]`, so it can ride a message, a remote call or a client state member directly. In client state it changes only on ticks that fire.

## A server or host captures the present

On a server or host, `CaptureView` returns the newest recorded tick with a fraction of zero, so a host's own shots are judged against the present, which is what its player saw.

An empty view, `default`, has a `Tick` of `NetworkLoopManager.UnsetTick` and is judged as the present. A client captures an empty view before any state has arrived, and a free build always does.
