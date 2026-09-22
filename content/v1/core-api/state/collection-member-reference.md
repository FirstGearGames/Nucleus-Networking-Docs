---
title: "Collection member reference"
---

## Common to every collection member

All five collection members derive from the same base and share this surface:

- `Values` — the live collection.
- `PreviousValues` — a snapshot from the most recent tick before the current head on which the collection actually changed.
- `Count` — the number of items currently held.
- `Changes` — an `IReadOnlyList<TChange>` of this tick's operations, appended to as mutations land or a received operation log is applied.
- A constructor taking `int ringDepth = 2`, the number of distinct snapshots retained in the ring. Two is the minimum that exposes a previous-tick view.
- Protected virtual hooks: `GetRingDepth()`, which returns the ring depth the member was constructed with, and `GetCurrentTick()`, which returns the tick from the network loop (or an unset value when none is running). Override either only to change how a subclass sources those values.

## NetworkListMember\<T0>

An ordered, index-addressable collection.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `void Add(T0 item)` | Appends to the end. |
| `AddRange` | `void AddRange(IReadOnlyList<T0> items)` | Appends each item in order. |
| `Insert` | `void Insert(int index, T0 item)` | Inserts at the given index. |
| `Remove` | `bool Remove(T0 item)` | Removes the first occurrence; returns whether one was found. |
| `RemoveAt` | `void RemoveAt(int index)` | Removes the item at the given index. |
| `Clear` | `void Clear()` | Empties the list. |
| `Contains` | `bool Contains(T0 item)` | |
| `IndexOf` | `int IndexOf(T0 item)` | Returns `-1` when not found. |
| indexer | `T0 this[int index] { get; set; }` | The setter records a `Set` operation; a write of the value the element already holds is discarded before anything is recorded. |
| `GetEnumerator` | `List<T0>.Enumerator GetEnumerator()` | Struct enumerator over the live list. |

```csharp
NetworkListMember<int> scores = new();
scores.Add(10);
scores.AddRange(new List<int> { 20, 30 });
scores[0] = 15;
scores.RemoveAt(1);
```

`Changes` is an `IReadOnlyList<NetworkListChange<T0>>`. Each `NetworkListChange<T0>` carries `Operation` (a `NetworkListOperation`), `Index`, and `Item`. `NetworkListOperation` is `Add`, `Insert`, `RemoveAt`, `Set`, or `Clear`; `Index` is undefined for `Clear`, and `Item` is the default of `T0` for `RemoveAt` and `Clear`.

## NetworkArrayMember\<T0>

A fixed-length, index-addressable collection with per-element interpolation.

| Member | Signature | Notes |
|---|---|---|
| `Set` | `void Set(int index, T0 item)` | Replaces one element. A write of the value already held is discarded before anything is recorded. |
| `Fill` | `void Fill(T0 item)` | Sets every element to the same value; length is unchanged. |
| `Resize` | `void Resize(int newLength)` | Grows or shrinks the array. New slots from a grow are default-filled; truncated slots are dropped. |
| `Clear` | `void Clear()` | Sets every element to the default of `T0`; length is unchanged. |
| `IndexOf` | `int IndexOf(T0 item)` | Returns `-1` when not found. |
| `Count` / `Length` | `int Count { get; }` / `int Length { get; }` | Equivalent; `Length` is provided for the array idiom. |
| `Values` | `ReadOnlySpan<T0> Values { get; }` | The live contents as a span. Aliases rented backing storage and is valid only until the next mutation. |
| `GetInterpolated` | `T0 GetInterpolated(int index)` | The one collection member with per-element interpolation: animates the value at `index` from what it held on the previous change toward its current value, for a peer rendering between ticks. Reads as the current value when the element type has no registered interpolator, or when the index is beyond what the previous snapshot held. |
| `GetEnumerator` | `Enumerator GetEnumerator()` | Struct enumerator over the live contents, truncated to the logical length. |

```csharp
NetworkArrayMember<float> healthByRegion = new(ringDepth: 2);
healthByRegion.Resize(4);
healthByRegion.Set(0, 100f);
float rendered = healthByRegion.GetInterpolated(0);
```

`Changes` is an `IReadOnlyList<NetworkArrayChange<T0>>`. Each `NetworkArrayChange<T0>` carries `Operation` (a `NetworkArrayOperation`), `Index`, `Item`, and `NewLength`. `NetworkArrayOperation` is `Set`, `Fill`, `Resize`, or `Clear`. `Index` is undefined for `Fill`, `Resize`, and `Clear`; `NewLength` is undefined for every operation except `Resize`; `Item` is the default of `T0` for `Resize` and `Clear`.

## NetworkDictionaryMember\<T0, T1>

A keyed collection with key type `T0` and value type `T1`.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `void Add(T0 key, T1 value)` | Throws when the key is already present. |
| `Remove` | `bool Remove(T0 key)` | Returns whether a matching entry was found and removed. |
| `Clear` | `void Clear()` | Empties the dictionary. |
| `ContainsKey` | `bool ContainsKey(T0 key)` | |
| `TryGetValue` | `bool TryGetValue(T0 key, out T1 value)` | |
| indexer | `T1 this[T0 key] { get; set; }` | The setter adds a new key or overwrites an existing one. A write of the value the key already holds is discarded before anything is recorded. |

```csharp
NetworkDictionaryMember<int, string> playerNames = new();
playerNames.Add(1, "Alice");
playerNames[1] = "Alicia";
playerNames.TryGetValue(1, out string name);
```

`Changes` is an `IReadOnlyList<NetworkDictionaryChange<T0, T1>>`. Each `NetworkDictionaryChange<T0, T1>` carries `Operation` (a `NetworkDictionaryOperation`), `Key`, and `Value`. `NetworkDictionaryOperation` is `Set`, `Remove`, or `Clear` — an add and an overwrite both encode as `Set` since the wire payload is identical. `Key` is the default of `T0` for `Clear`; `Value` is the default of `T1` for `Remove` and `Clear`.

## NetworkHashSetMember\<T0>

An unordered collection of unique values.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `bool Add(T0 item)` | Returns whether the item was added (false when already present). |
| `Remove` | `bool Remove(T0 item)` | Returns whether the item was found and removed. |
| `Clear` | `void Clear()` | Empties the set. |
| `Contains` | `bool Contains(T0 item)` | |

```csharp
NetworkHashSetMember<int> activeQuestIds = new();
activeQuestIds.Add(7);
bool hasQuest = activeQuestIds.Contains(7);
activeQuestIds.Remove(7);
```

`Changes` is an `IReadOnlyList<NetworkHashSetChange<T0>>`. Each `NetworkHashSetChange<T0>` carries `Operation` (a `NetworkHashSetOperation`) and `Item`. `NetworkHashSetOperation` is `Add`, `Remove`, or `Clear`; `Item` is the default of `T0` for `Clear`.

## NetworkQueueMember\<T0>

A first-in-first-out collection.

| Member | Signature | Notes |
|---|---|---|
| `Enqueue` | `void Enqueue(T0 item)` | Appends to the back. |
| `Dequeue` | `T0 Dequeue()` | Removes and returns the front item. |
| `TryDequeue` | `bool TryDequeue(out T0 item)` | Returns `false` with the default of `T0` when the queue is empty. |
| `Peek` | `T0 Peek()` | Returns the front item without removing it. |
| `TryPeek` | `bool TryPeek(out T0 item)` | Returns `false` with the default of `T0` when the queue is empty. |
| `Contains` | `bool Contains(T0 item)` | |
| `Clear` | `void Clear()` | Empties the queue. |

```csharp
NetworkQueueMember<string> pendingActions = new();
pendingActions.Enqueue("Attack");
if (pendingActions.TryDequeue(out string action))
{
    // action == "Attack"
}
```

`Changes` is an `IReadOnlyList<NetworkQueueChange<T0>>`. Each `NetworkQueueChange<T0>` carries `Operation` (a `NetworkQueueOperation`) and `Item`. `NetworkQueueOperation` is `Enqueue`, `Dequeue`, or `Clear`. For `Enqueue` the item is the one appended; for `Dequeue` it is the one removed from the front; `Item` is the default of `T0` for `Clear`.
