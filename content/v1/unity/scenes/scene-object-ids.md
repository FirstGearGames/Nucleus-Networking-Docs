---
title: "Objects authored into a scene"
---

## What a scene object is

A scene object is a `NetworkSystemObject` placed directly in a scene asset rather than instantiated from a prefab at runtime. It already exists on every peer that has the scene loaded, so spawning it is a matter of agreeing which local instance a given network system binds to, not creating a new GameObject.

That agreement runs on identity. `NetworkSystemObject.SceneObjectId` names the object within its scene, and `IsSceneObject` reports `true` whenever that id is non-zero. On the system side, `NetworkSystem.IsSceneObject` and `NetworkSystem.PlatformId` report the same facts: a scene object's `PlatformId` is its scene identifier, and `IsSceneObject` tells the receiver to bind to an object it already has instead of instantiating one.

## Stamping the id

`SceneObjectId` is not something you type in. Saving a scene assigns it automatically: every `NetworkSystemObject` in the scene being saved is checked, ids already in use are kept, and any object with an unset or duplicated id gets the next free value. This is why the field is hidden in the inspector; it is assigned on save, not authored by hand.

Duplicates are the normal case that makes this necessary. Copying an already-stamped object copies its serialized id along with it, so the copy and the original briefly share one `SceneObjectId`. On the next scene save, the stamper keeps the id on whichever object it saw first and reassigns the other to a fresh, unused value.

## Why the id only has to be unique per scene

An authored object's identity is the pair of scene handle and scene object id, `SceneObjectKey(SceneHandle, SceneObjectId)`. Neither half identifies an object on its own: `SceneObjectId` is stamped per scene file and is only unique within it, so two different scenes — or two live instances of the same scene loaded side by side — can both contain an object stamped with id `1`. `SceneHandle` supplies the other half, naming which live scene instance the object belongs to. A receiver holding several scenes, or several stacked copies of one scene, binds each incoming spawn to the right instance by matching both halves together.

This also means a scene stacked twice never collides. Each load gets its own `SceneHandle`, so the two copies of an authored object are distinguished by handle even though they carry the identical `SceneObjectId`.

## How this differs from a spawned prefab

A dynamically spawned prefab's `NetworkSystem.PlatformId` names a prefab to instantiate, and `IsSceneObject` is `false`. For a scene object, `IsSceneObject` is `true` and `PlatformId` holds the scene identifier instead. The receiver acts on that difference: a spawned system is constructed and instantiated fresh, while a scene object's system is bound onto the GameObject that is already sitting in the loaded scene.

## When a copied object binds to the wrong thing

If you duplicate a stamped `NetworkSystemObject` and the scene is not saved afterward, both copies still carry the same `SceneObjectId` in memory. A receiver resolving a spawn against that id can bind to the wrong instance, since nothing on disk yet distinguishes the two.

The fix is to save the scene. Saving reassigns the duplicate's id to a free value and writes it into the scene asset. Because the field is hidden in the inspector, there is no manual value to correct — re-saving is the only way to resolve it.
