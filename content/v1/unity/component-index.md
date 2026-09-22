---
title: "Component Index"
---

## Core managers

| Component | Description |
| --- | --- |
| `UnityCoreManager` | Owns the process's single CoreManager and bootstraps every other `UnityManager` on its GameObject. |
| `UnityClientManager` | Inspector-side driver for the core client manager. |
| `UnityServerManager` | Inspector-side driver for the core server manager. |
| `UnityTransportManager` | Adds and configures the CoreManager's transport, and chooses whether the peer starts as a server, client, or neither. |
| `UnityNetworkLoopManager` | Carries the authored tick rate and gives the default physics world its driver. |
| `UnityPacketManager` | Inspector-side driver for the core packet manager. |
| `UnityMessageManager` | Inspector-side driver for the core message manager. |
| `UnitySystemManager` | Exposes the system manager's runtime knobs as serialized fields. |
| `UnityInterestManager` | Carries the world-wide interest rules, re-resolve interval, and per-tick spawn cap. |
| `UnityPhysicsManager` | Inspector-side seat for the process-global physics execution mode and fixed-step alignment. |
| `UnitySceneManager` | Exposes the scene manager's placement policy and supplies a scene loader if none is placed. |

## State

| Component | Description |
| --- | --- |
| `NetworkTransform` | Replicates a GameObject's position, rotation, and scale, in local or world space. |
| `NetworkAnimator` | Replicates an `Animator`'s parameters, layer weights, and speed. |
| `NetworkNavMeshAgent` | Replicates a `NavMeshAgent` as the path leg it is walking rather than as its raw pose. |

## Scenes

| Component | Description |
| --- | --- |
| `NetworkSceneLoader` | Base behaviour for loading networked scenes; registers itself as the peer's scene loader. |
| `UnitySceneLoader` | Loads networked scenes additively through Unity's own scene loading. |
| `NetworkSceneManifest` (asset) | Maps the scene identifiers named on the wire to the scenes this peer loads and the content bundle each ships in. |

## Physics

| Component | Description |
| --- | --- |
| `PhysicsSimulationDriver` | Aligns one scene's physics world with the network tick instead of Unity's own FixedUpdate. |
| `ProjectedRigidbody` | Declares a rigidbody's replicated physics component and drives its sync, adopting, interpolating, or converging as needed. |

## Transports

| Component | Description |
| --- | --- |
| `NetworkTransport` | Base for an Inspector-configurable transport component. |
| `SynapseTransport` | Inspector-configurable component for the Synapse UDP transport: port, remote host, and timeouts. |
| `BlitzRelayTransport` | Inspector-configurable component for the Blitz Relay transport, which carries a session through a relay. |

## Bundles

| Component | Description |
| --- | --- |
| `NetworkBundleLoader` | Base behaviour for loading content bundles; registers itself as the peer's bundle loader. |
| `UnityAssetBundleLoader` | Loads content bundles as Unity asset bundles and registers the prefabs they ship. |
| `NetworkBundleManifest` (asset) | Maps the bundle identifiers named on the wire to the asset bundle files this client loads them from. |

## Systems and spawning

| Component | Description |
| --- | --- |
| `NetworkSystemObject` | Marks the root of a networked prefab or scene object; the single link between the GameObject and its NetworkSystem. |
| `NetworkPrefabCollection` (asset) | A serialized, enumerable container of networked prefabs shipped with a content unit. |
| `NetworkPlayerSpawner` | Spawns one prefab per authenticated client and hands that client control of it. |
| `NetworkInterestObject` | Authors an object's interest rules once, for every NetworkSystem it carries. |
| `NetworkHostVisibility` | Hides an object's renderers on a host while its own client half would not have been holding the object. |
| `NucleusBehaviour<TComponent0>` | Base for a script whose lifetime is one networked system; exposes the typed component it carries and this peer's role and control. |
