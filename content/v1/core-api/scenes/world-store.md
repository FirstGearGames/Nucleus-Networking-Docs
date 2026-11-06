---
title: "Writing a world store"
---

`IWorldStore` decides where a saved world lives: a file, a database row, a save service or cloud storage. `JsonWorldStore` ships as the default and as a reference to read alongside your own.

Pro only: `IWorldStore`, `IWorldDocument`, `WorldSystemIdentity`, `WorldLoadFailureAction`, `JsonWorldStore` and `WorldDocument`. `IWorldStateWriter` and `IWorldStateReader` ship in both editions.

## Register a store

The engine uses one store at a time:

```csharp
CoreManager.WorldPersistenceManager.SetWorldStore(new JsonWorldStore(CoreManager, filePath));
```

## Implement IWorldStore

```csharp
public interface IWorldStore
{
    Task<bool> SaveAsync(IWorldDocument worldDocument);
    IWorldDocument BeginSave();
    Task<IWorldDocument> LoadAsync();
    WorldLoadFailureAction OnSceneUnavailable(ushort sceneId, uint sceneHandle);
}
```

- `BeginSave`: return an empty document for the engine to write the world into. Nothing is committed until the write completes, so a failed save leaves the previous one intact.
- `SaveAsync(IWorldDocument)`: keep the finished document. Return `true` once it is safely stored.
- `LoadAsync`: return the document to read, or `null` when there is nothing to load.
- `OnSceneUnavailable(ushort sceneId, uint sceneHandle)`: called once for each saved scene instance this build cannot open, before any object from it is built. Return a `WorldLoadFailureAction`.

The async methods may complete on any thread. The engine does not block on them.

## Implement IWorldDocument

A document is streamed, so neither saving nor loading holds a second copy of the world in memory. Scenes are written and read before objects, because an object names its scene.

```csharp
public interface IWorldDocument
{
    void WriteScene(uint sceneHandle, ushort sceneId, SceneScope sceneScope);
    IWorldStateWriter BeginSystem(uint systemId, in WorldSystemIdentity worldSystemIdentity);
    void EndSystem();
    bool TryReadScene(out uint sceneHandle, out ushort sceneId, out SceneScope sceneScope);
    bool TryReadSystem(out uint systemId, out WorldSystemIdentity worldSystemIdentity, out IWorldStateReader worldStateReader);
}
```

Writing:

- `WriteScene` records one open scene instance.
- `BeginSystem` opens one object and returns the `IWorldStateWriter` its components are written through.
- `EndSystem` closes that object.

Reading:

- `TryReadScene` returns the next saved scene, or `false` when there are no more.
- `TryReadSystem` returns the next saved object, its `WorldSystemIdentity`, and the `IWorldStateReader` for its components. The reader only needs to stay valid until the next `TryReadSystem` call.

## Store members by name

`IWorldStateWriter` and `IWorldStateReader` handle one object's component state, keyed by component type name and member name rather than position, so a save survives a component gaining or losing a member.

```csharp
public interface IWorldStateWriter
{
    void BeginComponent(string componentTypeName);
    void Write(string memberName, NetworkMemberBase networkMember);
    void EndComponent();
}

public interface IWorldStateReader
{
    bool TryBeginComponent(string componentTypeName);
    bool TryRead(string memberName, NetworkMemberBase networkMember);
    void EndComponent();
}
```

Nucleus calls these, not your game code. Each `NetworkComponent` names its type, then writes each member in declaration order. `Write` passes the member itself: ask the member to write itself and store the result under its name, with no per-type cases.

On load, a member the save does not contain keeps its constructed default, and a saved name the component no longer has is skipped. There is no version or schema check. A member whose type changed but whose name stayed the same reads back silently wrong, so rename a member when its meaning changes.

## WorldSystemIdentity describes each saved object

A readonly struct holding what a save needs beyond member values:

| Field | Meaning |
|---|---|
| `SystemTypeName` | Full name of the `NetworkSystem` type to build, resolved through the type registry on load. |
| `PlatformId` | The prefab or scene-object identifier the object was started with. |
| `PrefabBundleId` | The content bundle the prefab was registered from, or the base build. |
| `IsSceneObject` | Whether the object is a scene object. A load binds it to the object the scene already placed instead of constructing one. |
| `SceneHandle` | The scene instance the object lives in. |
| `GroupId` | The group the object belongs to. |
| `ParentId` | The object this one is parented to. |
| `ComponentTypeNames` | Full names of the object's `NetworkComponent` types, in order, so a load knows which components to add. A scene object's components come from the scene, so for it this list is descriptive only. |

## Choose what a missing scene does

```csharp
public enum WorldLoadFailureAction : byte
{
    Skip,
    Fail
}
```

Return one from `OnSceneUnavailable` when a saved scene cannot be opened in this build:

- `Skip` (default): drop that scene instance and every object saved in it, then load the rest. The safer answer when scenes are independent.
- `Fail`: abandon the load, and `LoadAsync` returns `false`. The old world does not come back: a load despawns every object and closes every scene before reading saved scenes. No saved object is built until every saved scene has been answered for, so the result is an empty world, not a half-built one. Saved scenes that reopened before the failure stay open and empty.

## Start from JsonWorldStore

`JsonWorldStore` writes readable JSON (scenes, objects, components and member names as text), so saved worlds diff object by object and member by member.

```csharp
public sealed class JsonWorldStore : IWorldStore
{
    public string FilePath { get; }
    public WorldLoadFailureAction MissingSceneAction { get; set; } = WorldLoadFailureAction.Skip;

    public JsonWorldStore(CoreManager coreManager, string filePath) { ... }
}
```

- `FilePath`: the file saved worlds are written to and read from.
- `MissingSceneAction` (default `Skip`): what `OnSceneUnavailable` returns, so you can choose `Skip` or `Fail` without writing your own store.

A save writes to a temporary file beside the target and moves it over only when complete, so an interrupted save leaves the previous world in place.

If your store needs an in-memory document to write into before sending it to your target, use `WorldDocument`, the `IWorldDocument`, `IWorldStateWriter` and `IWorldStateReader` implementation that `JsonWorldStore` returns from `BeginSave`.
