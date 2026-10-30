---
title: "Networked collections"
---

## The family

Nucleus replicates five collection shapes, each a `NetworkComponent` member type built on the same base:

- `NetworkListMember<T0>` — an ordered, resizable list
- `NetworkArrayMember<T0>` — a fixed-capacity array with an explicit `Length`/`Resize`
- `NetworkDictionaryMember<T0, T1>` — a key/value map
- `NetworkHashSetMember<T0>` — an unordered set of unique elements
- `NetworkQueueMember<T0>` — a FIFO queue

All five derive from `NetworkCollectionMemberBase<TChange>`, which supplies the change tracking shared across the family. As with scalar members, keep the element type (and, for the dictionary, the key type) to a value type or `string`. Codegen does not enforce this, but an element held by reference can be changed without going through the public mutation API, and the collection never sees that change.

```csharp
public class NetworkListMember<T0> : NetworkCollectionMemberBase<NetworkListChange<T0>>
public class NetworkArrayMember<T0> : NetworkCollectionMemberBase<NetworkArrayChange<T0>>
public class NetworkDictionaryMember<T0, T1> : NetworkCollectionMemberBase<NetworkDictionaryChange<T0, T1>>
public class NetworkHashSetMember<T0> : NetworkCollectionMemberBase<NetworkHashSetChange<T0>>
public class NetworkQueueMember<T0> : NetworkCollectionMemberBase<NetworkQueueChange<T0>>
```

## Mutating a collection

Each member exposes ordinary collection APIs on the surface — `Add`, `Insert`, `RemoveAt`, `Clear`, the indexer for a list, array or dictionary, `Enqueue`/`Dequeue` for a queue, `Add`/`Remove` for a hash set. Every mutation is recorded as an operation in that tick's `Changes`.

A repeated `Set` or indexer write to the same slot within a tick replaces the pending operation instead of adding a second one. On a list, a `Set` at the index of the tick's most recent `Set`, `Add` or `Insert` folds into that operation rather than logging both.

## Unchanged contents are not sent

A collection is only sent when its contents actually differ from the previous tick. A mutator that runs and then refills a collection back to its previous contents costs nothing, so polling external state into a collection every tick only sends when the value actually moved. Elements compare the same way a scalar `NetworkMember<T0>` does, including tolerance: they compare through `NetworkTypeToleranceComparer<T0>`, so a floating element resting within the member's own accuracy compares equal.

## The upstream-write exception

When a client writes a collection member, the server and the other observers receive the whole collection rather than the individual operations, so on those peers `Changes` is empty for that write; read `Values` instead.

## Reading the previous values

Every member exposes:

- `Values` — the live contents (`IReadOnlyList<T0>` for a list, `ReadOnlySpan<T0>` for an array, `IReadOnlyDictionary<T0, T1>` for a dictionary, `IReadOnlyCollection<T0>` for a hash set or queue)
- `PreviousValues` — the contents as of the most recent tick the collection actually changed, prior to the current head
- `Count` — the current element count (the array also exposes `Length`, identical to `Count`)

Every constructor takes a `ringDepth` argument, defaulting to `2`:

```csharp
public NetworkListMember(int ringDepth = 2) : base(ringDepth)
```

Two is the minimum that exposes a previous-tick view at all — a depth below it is raised back to two. A deeper ring covers more ticks of history, at the cost of holding that many copies of the collection; the ring is sparse, consuming a slot only on ticks where the collection actually mutated, so a shallow ring can still cover many quiescent ticks between changes.

## Reacting to a change

`NetworkComponent.OnMembersChanged` names which members changed on a tick; a collection member's own `Changes` property says what happened inside it for that tick:

```csharp
public virtual void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection) { }
```

```csharp
public IReadOnlyList<TChange> Changes => ChangeLog;
```

`Changes` holds the current tick's operations on both sides (the ones this peer applied locally, or the ones just received) and is cleared at the end of the tick. Because of that, code that needs to inspect it must do so synchronously inside `OnMembersChanged`: the write-direction raise runs before the tick sends anything, and the read-direction raise runs after everything received this tick has been applied. When the whole collection is received at once, such as on a spawn, a recovery, or a client's write, `Changes` is empty, since the collection is stated as a whole rather than as what moved; read `Values` instead.

## Collections cannot be multi-writer

A collection member closes off `MemberWriteAccess.AnyClient` by construction, not just by convention. `NetworkSystem.TrySetWriteAccess` refuses to widen a system's access beyond `MemberWriteAccess.Controller` when that system holds any collection member. It returns `false` and logs an error saying the system holds a collection NetworkMember, so its write access cannot be widened beyond `Controller`.
