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
| `NetworkSceneManifest` (asset) | Maps scene identifiers to the scenes this peer loads and the content bundle each ships in. |

## Physics

| Component | Description |
| --- | --- |
| `PhysicsSimulationDriver` | Aligns one scene's physics world with the network tick instead of Unity's own FixedUpdate. |
| `NetworkRigidbody` | Declares a rigidbody's replicated physics component and drives its sync, adopting, interpolating, or converging as needed. |
| `ReplayHeldBody` | Holds a `Rigidbody` or `Rigidbody2D` kinematic while a reconcile replays, for a body the replay does not rewind. |

## Prediction

| Component | Description |
| --- | --- |
| `ValidatedTransform` | Keeps a transform's pose, scale, active state and layer in predicted members the server checks. |
| `ValidatedRigidbody`, `ValidatedRigidbody2D` | Keeps a body's pose, velocities and sleep state in predicted members, so its controlling client predicts it and a correction replays physics. |
| `ValidatedRigidbodyAdvanced`, `ValidatedRigidbody2DAdvanced` | Adds the body's kinematic flag, collision detection, constraints and center of mass. |
| `ValidatedCharacterController` | Keeps a `CharacterController`'s pose and enabled state in predicted members. |
| `ValidatedCharacterControllerAdvanced` | Adds the controller's height, center and radius. |
| `ValidatedConstantForce`, `ValidatedConstantForce2D` | Keeps a `ConstantForce`'s forces and torques in predicted members. |
| `ReconciledAnimator` | A `NetworkAnimator` for a predicted object, which also puts the parameters back before a replay. |
| `ValidatedAnimator` | Keeps an `Animator`'s parameters, layer weights and speed in predicted members the server checks, for parameters that decide gameplay. |
| `ValidatedAnimatorRootMotion` | Keeps the base layer's playback in predicted members, for root motion that decides where a character goes. |
| `GraphicalSmoother` | Glides a child graphic across each tick and each correction while the object stays at its true pose. |

## Lag compensation

| Component | Description |
| --- | --- |
| `UnityLagCompensationManager` | Inspector-side seat for lag compensation (Pro): the rewind window, whether 2D queries reach 3D hitboxes, whether queries start in hitboxes, and the spawn compensation cap. |
| `NetworkHitboxRoot` | Gathers every `NetworkHitbox` on a networked object and registers them with the server, so shots can be judged against where they were; disabling it makes the object unhittable. |
| `NetworkHitbox` | One lag-compensated volume, a sphere, box or capsule or a 2D circle, box or capsule, copied from a collider beside it or typed in. |

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
| `NetworkBundleManifest` (asset) | Maps bundle identifiers to the asset bundle files this client loads them from. |

## Systems and spawning

| Component | Description |
| --- | --- |
| `NetworkSystemObject` | Marks the root of a networked prefab or scene object; the single link between the GameObject and its NetworkSystem. |
| `NetworkPrefabCollection` (asset) | A serialized, enumerable container of networked prefabs shipped with a content unit. |
| `NetworkPlayerSpawner` | Spawns one prefab per authenticated client and hands that client control of it. |
| `NetworkInterestObject` | Authors an object's interest rules once, for every NetworkSystem it carries. |
| `NetworkHostVisibility` | Hides an object's renderers on a host while its own client half would not have been holding the object. |
| `NucleusBehaviour<TComponent0>` | Base for a script whose lifetime is one networked system; exposes the typed component it carries and this peer's role and control. |

## Developer tools

| Component | Description |
| --- | --- |
| `NetworkCorrectionVisualizer` | Flashes a line from where a predicted position was shown to where a reconcile corrected it, on the client that predicts the object. |
| `NetworkInterestOverlay` | While selected on a server or host, draws a line to every networked object, colored by what the object's controller holds of it. |
