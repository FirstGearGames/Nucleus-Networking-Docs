---
title: "Networked collections"
---

## Nucleus replicates five collection types

Each is a member type you declare on a `NetworkComponent`:

- `NetworkListMember<T0>`: an ordered, resizable list.
- `NetworkArrayMember<T0>`: a fixed-length array with `Length` and `Resize`.
- `NetworkDictionaryMember<T0, T1>`: a key/value map.
- `NetworkHashSetMember<T0>`: an unordered set of unique elements.
- `NetworkQueueMember<T0>`: a first-in-first-out queue.

Every method is listed in the [Collection member reference](./collection-member-reference.md).

Use a value type or `string` for elements and dictionary keys. Nothing enforces this, but an element held by reference can be changed without going through the collection, and the collection never sees that change.

## Change a collection through its methods

Each collection has the usual methods: `Add`, `Insert`, `RemoveAt`, `Clear`, an indexer for a list, array or dictionary, `Enqueue` and `Dequeue` for a queue, `Add` and `Remove` for a hash set. Each change is recorded as an operation in that tick's `Changes`.

Writing the same slot twice in one tick, with `Set` or the indexer, replaces the pending operation instead of adding a second one. On a list, a `Set` at the index of the tick's most recent `Set`, `Add` or `Insert` folds into that operation.

## Unchanged contents are not sent

A collection is sent only when its contents differ from the previous tick. Refilling a collection with the same contents every tick costs nothing. Elements compare like a scalar `NetworkMember<T0>`, so a floating-point element within the member's accuracy compares equal.

## Read what changed with Changes

`OnMembersChanged` tells you which members changed this tick. A collection's `Changes` (`IReadOnlyList<TChange>`) tells you what happened inside it. It holds this tick's operations, whether applied locally or just received, and is cleared at the end of the tick. Read it inside `OnMembersChanged`.

When a whole collection is received at once, `Changes` is empty: read `Values` instead. That happens on a spawn, a recovery, and when a client writes a collection, in which case the server and other observers receive the whole collection.

## Read previous contents

`PreviousValues` holds the contents from the most recent tick, before the current one, on which the collection changed. Every constructor takes `ringDepth`, the number of snapshots kept:

```csharp
public NetworkListMember(int ringDepth = 2) : base(ringDepth)
```

`2` (the default) is the minimum that gives a previous view; lower values are raised to `2`. A deeper ring covers more history but keeps that many copies of the collection.

## Collections allow only the controller to write

`NetworkSystem.TrySetWriteAccess` refuses to widen a system's access past `MemberWriteAccess.Controller` when the system holds any collection member. It returns `false` and logs an error saying the system holds a collection NetworkMember, so its write access cannot be widened beyond `Controller`.
