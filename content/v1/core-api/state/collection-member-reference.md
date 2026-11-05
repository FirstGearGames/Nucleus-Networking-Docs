---
title: "Collection member reference"
---

## Every collection member has these

All five derive from `NetworkCollectionMemberBase<TChange>` and share:

- `Values`: the live contents. `IReadOnlyList<T0>` for a list, `ReadOnlySpan<T0>` for an array, `IReadOnlyDictionary<T0, T1>` for a dictionary, `IReadOnlyCollection<T0>` for a hash set or queue.
- `PreviousValues`: the contents from the most recent tick, before the current one, on which the collection changed.
- `Count`: the number of items held.
- `Changes`: an `IReadOnlyList<TChange>` of this tick's operations.
- A constructor taking `int ringDepth = 2`, the number of snapshots kept. See [Networked collections](./networked-collections.md).
- Protected virtual `GetRingDepth()`, which returns the constructed ring depth, and `GetCurrentTick()`, which returns the network loop's tick, or an unset value when none is running. Override either only to change where a subclass gets those values.

## NetworkListMember\<T0> is an ordered list

Items are addressed by index.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `void Add(T0 item)` | Appends to the end. |
| `AddRange` | `void AddRange(IReadOnlyList<T0> items)` | Appends each item in order. |
| `Insert` | `void Insert(int index, T0 item)` | Inserts at the index. |
| `Remove` | `bool Remove(T0 item)` | Removes the first occurrence; returns whether one was found. |
| `RemoveAt` | `void RemoveAt(int index)` | Removes the item at the index. |
| `Clear` | `void Clear()` | Empties the list. |
| `Contains` | `bool Contains(T0 item)` | |
| `IndexOf` | `int IndexOf(T0 item)` | Returns `-1` when not found. |
| indexer | `T0 this[int index] { get; set; }` | The setter records a `Set` operation. Writing the value the element already holds records nothing. |
| `GetEnumerator` | `List<T0>.Enumerator GetEnumerator()` | Struct enumerator over the live list. |

```csharp
NetworkListMember<int> scores = new();
scores.Add(10);
scores.AddRange(new List<int> { 20, 30 });
scores[0] = 15;
scores.RemoveAt(1);
```

`Changes` holds `NetworkListChange<T0>` entries with `Operation` (a `NetworkListOperation`: `Add`, `Insert`, `RemoveAt`, `Set` or `Clear`), `Index` and `Item`. `Index` is undefined for `Clear`. `Item` is the default of `T0` for `RemoveAt` and `Clear`.

## NetworkArrayMember\<T0> is a fixed-length array

Items are addressed by index. It is the only collection with per-element interpolation.

| Member | Signature | Notes |
|---|---|---|
| `Set` | `void Set(int index, T0 item)` | Replaces one element. Writing the value already held records nothing. |
| `Fill` | `void Fill(T0 item)` | Sets every element to the same value; length is unchanged. |
| `Resize` | `void Resize(int newLength)` | Grows or shrinks the array. New slots are default-filled; truncated slots are dropped. Throws `ArgumentOutOfRangeException` above 65,536, the largest length a receiver accepts. |
| `Clear` | `void Clear()` | Sets every element to the default of `T0`; length is unchanged. |
| `IndexOf` | `int IndexOf(T0 item)` | Returns `-1` when not found. |
| `Count` / `Length` | `int Count { get; }` / `int Length { get; }` | The same value. |
| `Values` | `ReadOnlySpan<T0> Values { get; }` | The live contents. Valid only until the next change. |
| `GetInterpolated` | `T0 GetInterpolated(int index)` | Animates the element at `index` from its value at the previous change toward its current value, for rendering between ticks. Returns the current value when the element type has no registered interpolator, or when the previous snapshot did not hold that index. |
| `GetEnumerator` | `Enumerator GetEnumerator()` | Struct enumerator over the live contents, up to the current length. |

```csharp
NetworkArrayMember<float> healthByRegion = new(ringDepth: 2);
healthByRegion.Resize(4);
healthByRegion.Set(0, 100f);
float rendered = healthByRegion.GetInterpolated(0);
```

`Changes` holds `NetworkArrayChange<T0>` entries with `Operation` (a `NetworkArrayOperation`: `Set`, `Fill`, `Resize` or `Clear`), `Index`, `Item` and `NewLength`. `Index` is undefined for `Fill`, `Resize` and `Clear`. `NewLength` is defined only for `Resize`. `Item` is the default of `T0` for `Resize` and `Clear`.

## NetworkDictionaryMember\<T0, T1> maps keys to values

The key type is `T0` and the value type is `T1`.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `void Add(T0 key, T1 value)` | Throws when the key is already present. |
| `Remove` | `bool Remove(T0 key)` | Returns whether an entry was found and removed. |
| `Clear` | `void Clear()` | Empties the dictionary. |
| `ContainsKey` | `bool ContainsKey(T0 key)` | |
| `TryGetValue` | `bool TryGetValue(T0 key, out T1 value)` | |
| indexer | `T1 this[T0 key] { get; set; }` | The setter adds a key or overwrites one. Writing the value the key already holds records nothing. |

```csharp
NetworkDictionaryMember<int, string> playerNames = new();
playerNames.Add(1, "Alice");
playerNames[1] = "Alicia";
playerNames.TryGetValue(1, out string name);
```

`Changes` holds `NetworkDictionaryChange<T0, T1>` entries with `Operation` (a `NetworkDictionaryOperation`: `Set`, `Remove` or `Clear`), `Key` and `Value`. An add and an overwrite are both `Set`. `Key` is the default of `T0` for `Clear`. `Value` is the default of `T1` for `Remove` and `Clear`.

## NetworkHashSetMember\<T0> holds unique values

The set is unordered.

| Member | Signature | Notes |
|---|---|---|
| `Add` | `bool Add(T0 item)` | Returns false when the item is already present. |
| `Remove` | `bool Remove(T0 item)` | Returns whether the item was found and removed. |
| `Clear` | `void Clear()` | Empties the set. |
| `Contains` | `bool Contains(T0 item)` | |

```csharp
NetworkHashSetMember<int> activeQuestIds = new();
activeQuestIds.Add(7);
bool hasQuest = activeQuestIds.Contains(7);
activeQuestIds.Remove(7);
```

`Changes` holds `NetworkHashSetChange<T0>` entries with `Operation` (a `NetworkHashSetOperation`: `Add`, `Remove` or `Clear`) and `Item`. `Item` is the default of `T0` for `Clear`.

## NetworkQueueMember\<T0> is a first-in-first-out queue

| Member | Signature | Notes |
|---|---|---|
| `Enqueue` | `void Enqueue(T0 item)` | Adds to the back. |
| `Dequeue` | `T0 Dequeue()` | Removes and returns the front item. |
| `TryDequeue` | `bool TryDequeue(out T0 item)` | Returns `false` with the default of `T0` when empty. |
| `Peek` | `T0 Peek()` | Returns the front item without removing it. |
| `TryPeek` | `bool TryPeek(out T0 item)` | Returns `false` with the default of `T0` when empty. |
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

`Changes` holds `NetworkQueueChange<T0>` entries with `Operation` (a `NetworkQueueOperation`: `Enqueue`, `Dequeue` or `Clear`) and `Item`: the item added for `Enqueue`, the item removed for `Dequeue`, and the default of `T0` for `Clear`.
