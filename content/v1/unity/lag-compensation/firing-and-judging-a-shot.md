---
title: "Firing and judging a shot"
---

> **Driving the core API directly?** See [Capturing a shot](../../core-api/lag-compensation/capturing-a-shot.md) and [Judging a shot with rewound queries](../../core-api/lag-compensation/rewound-queries.md).

## Fire and judge from one script

The client captures a shot on the frame it fires and sends it. The server clips it at walls, judges it against the past, and applies the result. One script can hold both halves, because only the server runs the second:

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

## Capture on the frame the player fires

`CaptureShot(origin, direction)` takes `System.Numerics` vectors, so convert with `ToNative()` from `Nucleus.Integrations.Unity.Serializers`. It returns a `LagCompensatedShot` holding the ray unchanged and the view on screen, taken in the same call so the two always come from the same frame. The direction does not need to be of unit length.

Call it from the frame the click happens, never from code that builds the next tick's client state. Each rendered frame within a tick draws a different blend, and the view records which one was on screen.

## Send the shot whole

Put the `LagCompensatedShot` itself in a message, as above, a remote call argument or a client state member. Never copy its origin and direction into plain `Vector3` fields: a `Vector3` is sent with less precision, which can turn a long shot enough to lose a headshot with no error. A `LagCompensatedShot` arrives exactly as captured; an infinity or NaN arrives as zero.

For a shot that is not a ray, such as a melee swing whose volume the server builds itself, send just the view: `CaptureView()` returns the `LagCompensationView` on screen, and the server passes it to an overlap query.

## Judge on the server

Pass the shot's `View`, `Origin` and `Direction` straight into a query. Pass the sender's `Connection` as the shooter: its own objects are skipped, and its view is checked against what the server could have shown it. Pass `null` for a shot the server fires itself.

The 3D queries are:

- `TryRaycast` and `RaycastAll` for rays.
- `TrySphereCast` and `SphereCastAll` for a thick shot swept along a ray.
- `OverlapSphere`, `OverlapCapsule` and `OverlapBox` for explosions, melee swings and area attacks.

The `All` forms and the overlaps fill a `List<LagCompensatedHit>` you pass in, nearest first. Reuse one list so nothing is allocated. The [core API page](../../core-api/lag-compensation/rewound-queries.md) describes each query and what its hit's `Distance`, `Point` and `Normal` mean.

A query's layer mask is a `uint` with one bit per layer; cast a `LayerMask`'s `value` to `uint`.

With **Queries Start In Hitboxes** on, the default, a ray or cast that starts inside or touching a hitbox hits it at distance zero, with its own origin as the point, which is right for a point-blank shot. To let the shot carry on instead, turn it off on the [lag compensation manager](./unity-lag-compensation-manager.md).

## Ignore an object

Every query has an overload taking a `NetworkSystem ignoredNetworkSystem` straight after the shooter, whose hitboxes it skips. Pass `null` to ignore nothing.

- Pass the root of the object to ignore, normally the shooter's own root object.
- A host firing for its own avatar judges with a `null` shooter, so it passes its avatar. A turret or NPC the server fires for passes itself.
- Everything under the named object is skipped too. Naming any member of a grouped object skips the whole object, and every object parented under it with `SystemManager.EnsureSetSystemParent`, such as a carried weapon or shield, is skipped at any depth. Naming a nested object skips only it and what is under it.

## Read the hit

`LagCompensatedHit` carries the target's `NetworkSystem` (`null` when it has stopped since the judged tick), its `SystemId`, the `HitboxIndex` within its root, the hitbox's `Layer`, and the first contact's `Distance`, `Point` and `Normal`. `NetworkHitboxRoot.TryGetHitbox(lagCompensatedHit, out NetworkHitbox networkHitbox)` leads back to the hitbox's GameObject, where per-region data such as a headshot multiplier can live; see [Making an object hittable](./making-an-object-hittable.md#layers-and-per-region-rules).

## Use the 2D queries in a 2D game

Capture with a Z of zero, and judge with the 2D queries, which take `System.Numerics.Vector2` and run in the plane Z = 0:

```csharp
LagCompensatedShot shot = _coreManager.LagCompensationManager.CaptureShot(new(origin.ToNative(), 0f), new(direction.ToNative(), 0f));
```

```csharp
float range = LagCompensationWalls.GetDistance2D(shot.Origin2D.ToUnity(), shot.Direction2D.ToUnity(), _range, _wallLayers);

bool isHit = _coreManager.LagCompensationManager.TryRaycast2D(shooterConnection, ignoredNetworkSystem, shot.View, shot.Origin2D, shot.Direction2D, range, (uint)_hitboxLayers.value, out LagCompensatedHit lagCompensatedHit);
```

- `TryRaycast2D` and `RaycastAll2D` mirror the 3D raycasts.
- `TryCircleCast2D` and `CircleCastAll2D` mirror the sphere casts, with their arguments in `Physics2D.CircleCast`'s order.
- `OverlapCircle`, `OverlapCapsule2D` and `OverlapBox2D` mirror the overlaps. `OverlapBox2D` takes its angle in radians, so multiply a Unity angle by `Mathf.Deg2Rad`.

A hit on a 2D hitbox has a `Point` and `Normal` with a Z of zero. A 3D query never touches a 2D hitbox, so `TryRaycast` in a 2D game finds nothing. A 2D query touches only 2D hitboxes unless **2D Queries Hit 3D Hitboxes** is ticked.
