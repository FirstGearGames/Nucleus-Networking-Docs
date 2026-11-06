---
title: "Objects authored into a scene"
---

A scene object is a `NetworkSystemObject` placed in a scene asset instead of spawned from a prefab. It already exists on every peer that has the scene loaded, so spawning it binds the network system to that GameObject instead of creating one.

## Saving the scene stamps its id

`NetworkSystemObject.SceneObjectId` names the object within its scene, and `IsSceneObject` is `true` whenever that id is non-zero. You never set the id: saving a scene keeps every id already in use and gives any unset or duplicated id the next free value. The field is hidden in the inspector.

The id only has to be unique within one scene file. Peers identify an authored object by `SceneObjectKey(SceneHandle, SceneObjectId)`, and each loaded instance of a scene has its own `SceneHandle`. Two different scenes, or two stacked copies of one scene, can both hold an object with id `1` without colliding.

## A scene object is bound, not instantiated

| | Spawned prefab | Scene object |
|---|---|---|
| `NetworkSystem.IsSceneObject` | `false` | `true` |
| `NetworkSystem.PlatformId` | The prefab to instantiate | The scene identifier |
| On the receiver | Instantiated fresh | Bound to the GameObject already in the loaded scene |

## Save the scene after duplicating a scene object

Copying a stamped object copies its `SceneObjectId`. Until the scene is saved, both copies share the id, and a spawn can bind to the wrong one. Save the scene: the object seen first keeps the id and the other gets a free value. Because the field is hidden, saving is the only way to fix it.
