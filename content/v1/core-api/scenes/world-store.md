---
title: "Writing a world store"
---

## The seam

A saved world has no file, no format and no address defined by the engine, only a shape. `IWorldStore` is that seam: implement it to persist a world somewhere other than a file, a database row, a save-service blob, cloud storage, whatever the game already uses. `JsonWorldStore` ships as the default implementation, both as a working store and as the reference to read alongside your own.

Almost every file behind this feature is Pro-only (`.Pro.cs`): `IWorldStore`, `IWorldDocument`, `WorldSystemIdentity`, `WorldLoadFailureAction`, `JsonWorldStore` and `WorldDocument`. The two exceptions are `IWorldStateWriter` and `IWorldStateReader`, which ship in both editions.

Register a store through `WorldPersistenceManager.SetWorldStore`. The engine consults exactly one store at a time.

```csharp
CoreManager.WorldPersistenceManager.SetWorldStore(new JsonWorldStore(CoreManager, filePath));
```

## IWorldStore

```csharp
public interface IWorldStore
{
    Task<bool> SaveAsync(IWorldDocument worldDocument);
    IWorldDocument BeginSave();
    Task<IWorldDocument> LoadAsync();
    WorldLoadFailureAction OnSceneUnavailable(ushort sceneId, uint sceneHandle);
}
```

- `BeginSave` returns an empty document for the engine to write the whole world into. It is separate from `SaveAsync` so nothing is committed until the write is complete; a failed save leaves the previous one intact.
- `SaveAsync(IWorldDocument)` keeps the document the engine just finished writing. Return `true` once it is safely stored.
- `LoadAsync` returns the document to read a saved world out of, or `null` when there is nothing to load.
- `OnSceneUnavailable(ushort sceneId, uint sceneHandle)` is asked once per scene instance the save names that this build cannot open, before any object from it has been built. Answer with a `WorldLoadFailureAction`.

The work is genuinely asynchronous. The engine does not block on it and does not care which thread it completes on; completion is marshalled back onto the network loop before anything is built.

## IWorldDocument

A document is streamed, not handed over whole, so neither saving nor loading builds a second copy of the world in memory. Scenes are written and read before objects, because an object names the scene it lives in.

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

Writing direction:

- `WriteScene` records one open scene instance.
- `BeginSystem(systemId, in worldSystemIdentity)` opens one object and returns the `IWorldStateWriter` its components are written through.
- `EndSystem` closes the object opened by `BeginSystem`.

Reading direction:

- `TryReadScene` returns the next saved scene, or `false` once they are exhausted.
- `TryReadSystem` returns the next saved object, its `WorldSystemIdentity`, and the `IWorldStateReader` to read its components through. The returned reader is valid until the next `TryReadSystem` call, so apply state before asking for the next object.

## IWorldStateWriter and IWorldStateReader

These write and read one object's component state, keyed by component type name and member name rather than by position. Names are what let a save survive a component gaining or losing a member.

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

Generated code calls these, not game code: each `NetworkComponent` emits a `WriteWorldState` that names its own type and then each member in declaration order. `Write` hands a member over whole rather than as a value, so an implementation asks the member to write itself and stores the resulting bytes under its name; it never grows a case per type.

On the read side, a member the save does not carry is never assigned and keeps its constructed default. A name the save carries that the component no longer has is never asked for and is skipped. There is no version number or schema check. What this does not cover is a member whose type changed under a name that stayed the same; that reads back silently wrong. Rename the member when its meaning changes.

## WorldSystemIdentity

A readonly struct recording everything a save needs beyond member values: what type to build, what it was built from, where it lives, and what it belongs to.

| Field | Meaning |
|---|---|
| `SystemTypeName` | Full name of the `NetworkSystem` type to build, resolved through the type registry on load. Carried by name because the wire's numeric type identity shifts whenever a networked type is added, removed or renamed, and nothing detects that shift at runtime. |
| `PlatformId` | The prefab or scene-object identifier the object was started with. |
| `PrefabBundleId` | The content bundle the prefab was registered from, or the base build for an object that ships inside it. |
| `IsSceneObject` | Whether the object is a scene object; a load binds it to an object the scene already placed instead of constructing one. |
| `SceneHandle` | The scene instance the object lives in. |
| `GroupId` | The group the object belongs to. |
| `ParentId` | The object this one is parented to. |
| `ComponentTypeNames` | Full names of the `NetworkComponent` types the object carried, in order. A constructed system starts with no components, so a save needs this list to know what to add before it has values to put in them. A scene object ignores it for rebuilding, since its components were placed by the scene; it is recorded only to describe what was there. |

## WorldLoadFailureAction

```csharp
public enum WorldLoadFailureAction : byte
{
    Skip,
    Fail
}
```

Returned from `OnSceneUnavailable` when a saved scene cannot be opened in this build. `Skip` drops that scene instance and every object saved inside it, then loads the rest of the world; it is the default and the safer answer when scenes are independent of each other. `Fail` abandons the load and `LoadAsync` returns `false`, but it does not bring back the world that was standing: a load despawns every object and closes every open scene before it reads the saved scenes, so by the time this is asked the old world is already gone. No saved object is built until every saved scene has been answered for, so `Fail` leaves an empty world rather than a half-built one. Saved scenes that reopened before the one that failed stay open, with nothing built in them.

## JsonWorldStore as a reference

`JsonWorldStore` is the shipped `IWorldStore`. It writes a real JSON structure (scenes, objects, components and member names all read as text), with each member's packed value carried as base64 under its name, so a saved world diffs object by object and member by member.

```csharp
public sealed class JsonWorldStore : IWorldStore
{
    public string FilePath { get; }
    public WorldLoadFailureAction MissingSceneAction { get; set; } = WorldLoadFailureAction.Skip;

    public JsonWorldStore(CoreManager coreManager, string filePath) { ... }
}
```

`FilePath` is the file saved worlds are written to and read from. `MissingSceneAction` is settable rather than fixed, so a game can pick `Skip` or `Fail` without implementing the interface itself; it defaults to `Skip`. `OnSceneUnavailable` just returns `MissingSceneAction`.

The file is written to a temporary path beside the target and moved over it only once the write completes, so a save interrupted partway leaves the previous world in place rather than a truncated one.

Use `WorldDocument` (the `IWorldStore`-agnostic `IWorldDocument`/`IWorldStateWriter`/`IWorldStateReader` implementation `JsonWorldStore` builds through `BeginSave`) as a second reference if your own store needs an in-memory document to write into before serializing it to your target.
