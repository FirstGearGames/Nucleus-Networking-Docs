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

All five derive from `NetworkCollectionMemberBase<TChange>`, which owns the change-log and snapshot-ring bookkeeping shared across the family; each family only supplies its own storage, mutation surface, and wire shape. As with scalar members, the element type (and, for the dictionary, the key type) must be a value type or `string` — codegen rejects any other reference type so values cannot change without going through the public mutation API.

```csharp
public class NetworkListMember<T0> : NetworkCollectionMemberBase<NetworkListChange<T0>>
public class NetworkArrayMember<T0> : NetworkCollectionMemberBase<NetworkArrayChange<T0>>
public class NetworkDictionaryMember<T0, T1> : NetworkCollectionMemberBase<NetworkDictionaryChange<T0, T1>>
public class NetworkHashSetMember<T0> : NetworkCollectionMemberBase<NetworkHashSetChange<T0>>
public class NetworkQueueMember<T0> : NetworkCollectionMemberBase<NetworkQueueChange<T0>>
```

## Mutating a collection

Each member exposes ordinary collection APIs on the surface — `Add`, `Insert`, `RemoveAt`, `Clear`, the indexer for a list, array or dictionary, `Enqueue`/`Dequeue` for a queue, `Add`/`Remove` for a hash set. Underneath, every mutation appends a coalesced entry to a per-tick change log rather than marking the whole member dirty:

```csharp
public void Add(T0 item)
{
    EnsureHeadForCurrentTick();

    List<T0> values = _ringValues[HeadIndex];
    int index = values.Count;
    values.Add(item);

    AppendChange(NetworkListOperation.Add, index, item);
    NotifyChanged();
}
```

A repeated `Set`/indexer write to the same slot within a tick overwrites the pending log entry in place instead of appending a second one — a list's `AppendSetOperation` folds a `Set`, `Add` or `Insert` at the same index together rather than logging both.

## What travels on the wire

The log is what the delta carries. `WriteDelta` writes the tick's coalesced operations, not a snapshot of the collection:

```csharp
public override void WriteDelta(Writer writer, DeltaCheckMode deltaCheckMode)
{
    if (writer.IsEveryDeltaMemberAbsolute)
    {
        Write(writer);

        return;
    }

    WriteOperations(writer);
}
```

On the receiving side, `ReadDelta` applies those operations in order, appending each one to the same `Changes` log the local mutator would have populated. An operation the local contents can no longer take — an index a lost delta would have made room for — is skipped rather than thrown on, but its bits are still consumed so the rest of the tick stays aligned; recovery repairs the divergence with a full, absolute serve.

A full `Write`/`Read` always carries the whole collection, states what it *is* rather than what moved, and leaves the change log empty.

## The change gate, not the encoding

The wire format is the operation log, but whether anything is sent at all is decided separately, by a gate that runs before `WriteDelta` is ever reached. `TryFlagAsChanged` only flags a member once its log is non-empty *and* its contents differ observably from the previous ring snapshot:

```csharp
internal override bool TryFlagAsChanged(uint tick)
{
    if (ChangeLog.Count == 0)
        return false;

    if (!HasObservableChange())
    {
        ChangeLog.Clear();

        return false;
    }

    NetworkMemberBase networkMember = this;
    NetworkComponent.OnMemberChanged(networkMember);

    return true;
}
```

This is why a mutator that ran and then refilled a collection back to its previous contents costs nothing on the wire: the log is non-empty, but `HasObservableChange` compares the live contents against the previous ring snapshot and finds no difference, so the log is cleared and nothing is flagged. A non-empty log says a mutator ran, not that the collection now holds anything different — polling external state into a collection every tick would otherwise spend framing on every tick whether or not the value actually moved. This mirrors the scalar `NetworkMember<T0>` comparison, including tolerance: elements compare through `NetworkTypeToleranceComparer<T0>`, so a floating element resting within the member's own accuracy compares equal exactly as a scalar does.

## The upstream-write exception

Operations are an encoding against what the receiver already holds, so they only work where the sender knows what that receiver's previous state was. A client's upstream write breaks that assumption — nothing downstream serves recovery for an upstream delta — so a client writing a collection member, and the authority relaying that write for the tick, both carry the whole collection as an absolute rather than as operations. The encoding rides as the delta's subpacket kind rather than a bit in the body, so the receiver always knows which shape to expect before decoding.

## Reading the previous state

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

`Changes` holds the current tick's operations on both sides — the ones this peer applied locally, or the ones a delta just landed — and is cleared at the end of the tick. Because of that, code that needs to inspect it must do so synchronously inside `OnMembersChanged`: the write-direction raise runs before the tick serializes anything, and the read-direction raise runs after the inbound apply has landed. A full `Read` leaves `Changes` empty, since it states what the collection is rather than what moved.

## Collections cannot be multi-writer

A collection member closes off `StateWriteAccess.AnyClient` by construction, not just by convention. `NetworkSystem.SetWriteAccess` refuses to widen a system's access beyond `StateWriteAccess.Controller` when that system holds any collection member:

```csharp
if (stateWriteAccess is not StateWriteAccess.Controller && HasCollectionMember())
{
    Logger<NetworkSystem>.LogError($"NetworkSystem [{AsStringInternal()}] holds a collection NetworkMember, so its write access cannot be widened beyond [{nameof(StateWriteAccess.Controller)}].");

    return false;
}
```

The collection families take wire-supplied counts and read through their own paths, which never reach the scalar guard stack that keeps `AnyClient` safe for a plain `NetworkMember<T0>`. Rather than guard every one of those read paths individually, multi-writer access is refused for the whole system up front.
