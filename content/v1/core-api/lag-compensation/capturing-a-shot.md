---
title: "Capturing a shot"
---

> **Using Unity?** See [Firing and judging a shot](../../unity/lag-compensation/firing-and-judging-a-shot.md).

## Capture on the frame the shot is fired

The shooter's half of lag compensation is one call. On the frame the player fires, capture the shot:

```csharp
LagCompensatedShot lagCompensatedShot = coreManager.LagCompensationManager.CaptureShot(origin, direction);
```

`CaptureShot(Vector3 origin, Vector3 direction)` returns a `LagCompensatedShot` carrying the origin and direction unchanged and the view `CaptureView()` returns at that moment. The direction does not need to be of unit length. Taking the ray and the view in the same call means they can never come from different frames.

Capture on the firing frame, not when the next tick's client state is built. A tick spans several rendered frames, each drawing a different blend between two server ticks, and the view records which blend was on screen. A view taken a frame later names a different moment from the one the player aimed at.

## Send the shot whole

Put the `LagCompensatedShot` itself in a message, a remote call argument or a client state member, and send it to the server:

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

Do not copy the origin and direction into plain `Vector3` fields. A plain `Vector3` in a message is rounded to a thousandth per component, which can turn a unit direction by about 0.9 milliradians: roughly 4 cm at 50 m and 9 cm at 100 m, enough to lose a headshot at range with nothing to show why. A `LagCompensatedShot` is written through hand-written serializers, `LagCompensatedShotSerializers`, which the generator adopts for every field and argument of the type in every assembly, and which send each component of the origin and direction as its raw 32 bits. A whole shot costs 24 bytes for the ray plus a few for the view. An infinity or NaN in either vector arrives as zero, as every raw float the engine reads does, so no peer can put one into the server's queries.

`LagCompensatedShot` is compared bit for bit, view included, so a member holding one sees a new shot as a change.

## On the server, the shot feeds a query directly

The shot's three fields, `View`, `Origin` and `Direction`, are the arguments a query takes:

```csharp
LagCompensatedShot shot = shotMessage.Shot;

bool isHit = coreManager.LagCompensationManager.TryRaycast(messageContext.SenderConnection, shot.View, shot.Origin, shot.Direction, maximumDistance, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

See [Judging a shot with rewound queries](./rewound-queries.md) for every query and what a hit reports.

## A 2D shot captures with a Z of zero

A 2D game captures with a Z of zero and reads the shot back through its 2D properties, `Origin2D` and `Direction2D`, which the 2D queries take:

```csharp
LagCompensatedShot lagCompensatedShot = coreManager.LagCompensationManager.CaptureShot(new Vector3(origin2D, 0f), new Vector3(direction2D, 0f));
```

```csharp
bool isHit = coreManager.LagCompensationManager.TryRaycast2D(messageContext.SenderConnection, shot.View, shot.Origin2D, shot.Direction2D, maximumDistance, hitboxLayerMask, out LagCompensatedHit lagCompensatedHit);
```

## Capturing a view alone

A shot that is not a ray, such as a melee swing whose volume the server builds itself, only needs the view. `CaptureView()` returns the `LagCompensationView` on screen right now, and the server passes it to an overlap query. A `LagCompensationView` is a `[NetworkType]`, so it can ride a message, a remote call or a client state member directly; inside client state it changes only on ticks that fire, so delta compression makes it nearly free on every other tick. Its fraction is quantized to a byte, a resolution of 1/255 of a tick.

## What a server or host captures

On a server or host, `CaptureView` returns the newest recorded tick with a fraction of zero, because a server's screen shows the present. A host's own shots are therefore judged against the present, which is what its player saw.

An empty view, `default`, has a `Tick` of `NetworkLoopManager.UnsetTick` and is judged as the present. A client captures an empty view before any state has arrived, and a free build always does.
