---
title: "Firing and judging a shot"
---

> **Driving the core API directly?** See [Capturing a shot](../../core-api/lag-compensation/capturing-a-shot.md) and [Judging a shot with rewound queries](../../core-api/lag-compensation/rewound-queries.md).

## The whole flow in one script

A shot has two halves. The client captures it on the frame it fires and sends it; the server clips it at walls, judges it against the past, and applies the result. One script can hold both, because only the server ever runs the second half:

```csharp
using Nucleus.Connections;
using Nucleus.Integrations.Unity;
using Nucleus.Integrations.Unity.LagCompensation;
using Nucleus.Integrations.Unity.Serializers;
using Nucleus.Managers.Core;
using Nucleus.Managers.LagCompensation;
using Nucleus.Managers.Messages;
using Nucleus.Serializers;
using Nucleus.Systems;
using Nucleus.Transports;
using UnityEngine;

[NetworkType]
public struct ShotMessage : IMessage
{
    public LagCompensatedShot Shot;
}

public class Shooter : MonoBehaviour
{
    [SerializeField]
    private float _range = 100f;
    [SerializeField]
    private LayerMask _hitboxLayers = ~0;
    [SerializeField]
    private LayerMask _wallLayers = ~0;

    private CoreManager _coreManager;
    // Set by your own player code when this peer's avatar spawns, so a host's own shots skip it.
    private NetworkSystem _ownAvatarSystem;

    private void Start()
    {
        _coreManager = NucleusUnity.BoundCoreManager;
        _coreManager.MessageManager.RegisterMessageHandler<ShotMessage>(OnShotReceived);
    }

    private void OnDestroy()
    {
        _coreManager?.MessageManager.UnregisterMessageHandler<ShotMessage>(OnShotReceived);
    }

    // Call from your input code on the frame the player fires.
    public void Fire(Ray ray)
    {
        LagCompensatedShot shot = _coreManager.LagCompensationManager.CaptureShot(ray.origin.ToNative(), ray.direction.ToNative());

        // A host judges its own shot at once. Its view is the present, and a null shooter skips nothing, so it names its avatar.
        if (_coreManager.TransportManager.IsServerStarted)
        {
            Judge(shooterConnection: null, _ownAvatarSystem, shot);
            return;
        }

        if (_coreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
            serverConnection.SendMessage(Channel.Reliable, new ShotMessage { Shot = shot });
    }

    private void OnShotReceived(in MessageContext messageContext, ShotMessage shotMessage)
    {
        if (_coreManager.TransportManager.IsServerStarted)
            Judge(messageContext.SenderConnection, ignoredNetworkSystem: null, shotMessage.Shot);
    }

    private void Judge(Connection shooterConnection, NetworkSystem ignoredNetworkSystem, LagCompensatedShot shot)
    {
        // Walls are not in the history, so clip the shot against the present scene first.
        float range = LagCompensationWalls.GetDistance(shot.Origin.ToUnity(), shot.Direction.ToUnity(), _range, _wallLayers);

        if (!_coreManager.LagCompensationManager.TryRaycast(shooterConnection, ignoredNetworkSystem, shot.View, shot.Origin, shot.Direction, range, (uint)_hitboxLayers.value, out LagCompensatedHit lagCompensatedHit))
            return;

        if (NetworkHitboxRoot.TryGetHitbox(lagCompensatedHit, out NetworkHitbox networkHitbox))
            Debug.Log($"Hit [{networkHitbox.name}] at [{lagCompensatedHit.Point.ToUnity()}].");
    }
}
```

The rest of this page takes each step in turn.

## Capture on the click's own frame

`CaptureShot(origin, direction)` takes `System.Numerics` vectors, so convert with `ToNative()` from `Nucleus.Integrations.Unity.Serializers`. It returns a `LagCompensatedShot` carrying the ray unchanged and the view on screen right now, taken in the same call so the two can never come from different frames. The direction does not need to be of unit length.

Call it from the frame the click happens, never from code that builds the next tick's client state. A tick spans several rendered frames, each drawing a different blend between two server ticks, and the view records which blend was on screen.

## Send the shot whole

Put the `LagCompensatedShot` itself in the message, as above, or in a remote call argument or a client state member. Never copy its origin and direction into plain `Vector3` fields: a message rounds each component to a thousandth, which can turn a long shot by about 9 cm at 100 m and lose a headshot with no error. A `LagCompensatedShot` sends each component as its raw 32 bits; an infinity or NaN arrives as zero.

A shot that is not a ray, such as a melee swing whose volume the server builds itself, sends just a view: `CaptureView()` returns the `LagCompensationView` on screen, and the server passes it to an overlap query.

## Judge on the server

The server passes the shot's `View`, `Origin` and `Direction` straight into a query. Pass the sender's `Connection` as the shooter: its own objects are skipped, so a shot never hits its shooter, and its view is checked against what the server could have shown it. Pass `null` for a shot the server fires itself.

The 3D queries are `TryRaycast` and `RaycastAll` for rays, `TrySphereCast` and `SphereCastAll` for a thick shot swept along a ray, and `OverlapSphere`, `OverlapCapsule` and `OverlapBox` for explosions, melee swings and area attacks. The `All` forms and the overlaps fill a `List<LagCompensatedHit>` you pass in, nearest first; keep one list and reuse it so nothing is allocated. Every test is exact. The [core API page](../../core-api/lag-compensation/rewound-queries.md) lists each one and what its hit's `Distance`, `Point` and `Normal` mean.

A query's layer mask is a `uint`, one bit per layer; a `LayerMask`'s `value` cast to `uint` is exactly that.

## Ignoring an object

Every query has an overload taking a `NetworkSystem ignoredNetworkSystem` straight after the shooter, whose hitboxes it skips. Pass the object to ignore, normally the shooter's own root object, or `null` to ignore nothing. A host firing for its own avatar, which judges with a `null` shooter, passes its avatar, and a turret or NPC the server fires for passes itself. Naming any member of a grouped object skips the whole object.

## Reading the hit

`LagCompensatedHit` carries the target's `NetworkSystem` (`null` when it has stopped since the judged tick), its `SystemId`, the `HitboxIndex` within its root, the hitbox's `Layer`, and the first contact's `Distance`, `Point` and `Normal`. `NetworkHitboxRoot.TryGetHitbox(lagCompensatedHit, out NetworkHitbox networkHitbox)` leads back to the hitbox's GameObject, where per-region data such as a headshot multiplier can live; see [Making an object hittable](./making-an-object-hittable.md#layers-and-per-region-rules).

## A shot that starts inside a hitbox

With **Queries Start In Hitboxes** on, the default, a ray whose origin lies inside a hitbox, or a sphere or circle cast that starts touching one, hits it at distance zero with its own origin as the point. That is the right answer for a shot fired point-blank. Turn it off on the [lag compensation manager](./unity-lag-compensation-manager.md) when a muzzle can sit inside some other hitbox and the shot should carry on to what lies beyond. Overlaps are not affected.

## 2D games

A 2D game captures with a Z of zero and judges with the 2D queries, which take `System.Numerics.Vector2` and run in the plane Z = 0:

```csharp
LagCompensatedShot shot = _coreManager.LagCompensationManager.CaptureShot(new(origin.ToNative(), 0f), new(direction.ToNative(), 0f));
```

```csharp
float range = LagCompensationWalls.GetDistance2D(shot.Origin2D.ToUnity(), shot.Direction2D.ToUnity(), _range, _wallLayers);

bool isHit = _coreManager.LagCompensationManager.TryRaycast2D(shooterConnection, ignoredNetworkSystem, shot.View, shot.Origin2D, shot.Direction2D, range, (uint)_hitboxLayers.value, out LagCompensatedHit lagCompensatedHit);
```

`TryRaycast2D` and `RaycastAll2D` mirror the 3D raycasts. `TryCircleCast2D` and `CircleCastAll2D` mirror the sphere casts, with their arguments in `Physics2D.CircleCast`'s order. `OverlapCircle`, `OverlapCapsule2D` and `OverlapBox2D` mirror the overlaps; `OverlapBox2D` turns its rectangle by an angle in radians, so multiply a Unity angle by `Mathf.Deg2Rad`. A hit on a 2D hitbox has a `Point` and `Normal` with a Z of zero.

A 3D query never touches a 2D hitbox, so `TryRaycast` in a 2D game finds nothing. A 2D query touches only 2D hitboxes unless **2D Queries Hit 3D Hitboxes** is ticked.

## Common mistakes

- **Judging on the client.** The client fires and sends; only the server decides.
- **Expecting `Physics.Raycast` to hit rewound targets.** Nothing moves; only the lag-compensated queries see the past.
- **Clipping at walls with a plain `Physics.Raycast`.** It stops on the target's present-time collider and on the shooter's own controller. Use [`LagCompensationWalls`](./clipping-shots-at-walls.md).
- **Capturing the view and the ray separately.** They can land on different frames. `CaptureShot` takes both in one call.
