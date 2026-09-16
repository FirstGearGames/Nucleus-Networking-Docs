---
title: "SyncTypes"
---
SyncTypes are FishNet's built-in mechanism for automatically synchronizing state from the server to clients. They handle serialization and delta compression transparently, so you can declare a field and have it replicate without writing any custom RPC code. This section covers all available SyncTypes — SyncVar, SyncList, SyncHashSet, SyncDictionary, SyncTimer, SyncStopwatch, and Custom SyncTypes — as well as how to customize their behavior.
