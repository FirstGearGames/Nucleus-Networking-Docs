---
title: "Choose your track: Unity or the core API"
---

## The one-sentence rule

Working in the Unity editor: read the Unity track. Calling Nucleus from plain C# — a console host, a dedicated server, another engine — read the API track.

## Why the split is real

It is not a documentation convenience laid over one API. Dropping `UnityCoreManager` into a scene builds the entire session for you.

`UnityCoreManager.Awake` adds a `UnityNetworkLoopStepProvider` to drive its loop, constructs a `CoreManager` with it, then calls a private `EnsureManagers` that adds ten components to the same GameObject if they are not already there: `UnityNetworkLoopManager`, `UnityTransportManager`, `UnityServerManager`, `UnityClientManager`, `UnitySystemManager`, `UnityInterestManager`, `UnityPacketManager`, `UnityMessageManager`, `UnitySceneManager`, and `UnityPhysicsManager`. Once every component exists, `Awake` calls `ManagersInstantiated` on each `UnityManager` in its children — the same pattern `CoreManager`'s own constructor uses internally, calling `ManagersInstantiated` on every `ManagerBase` it owns once all of them are built.

A Unity reader never writes `new CoreManager(...)`, never chooses a loop step provider, and configures almost everything through inspector fields on these ten components. The API track's constructors and manager classes still exist underneath, but the component layer is the whole interface a Unity project needs.

## When the Unity track still sends you to the API track

The component layer is a seat on top of the core managers, not a replacement for them. `UnityCoreManager` exposes the `CoreManager` it built as a public property, and several Unity manager components mirror one of its own fields onto an inspector field rather than adding new behavior.

`UnityNetworkLoopManager` is the clearest example: its inspector-configured tick rate is read back as `TickRate => (uint)_tickRate`, and `UnityCoreManager.Awake` reads that value before construction to pass as the `tickRate` argument to `new CoreManager(tickRate, ...)`. The inspector field and the core manager's own value are the same setting seen twice, not two settings. Any page documenting what a setting actually does, or what a core manager member is for, is written once on the API track and pointed to from the matching Unity field — never duplicated.

## What the API track assumes the Unity track supplies

The core engine declares seams it does not implement, and expects an integration to fill them in. An API reader does not need to read the Unity track, but should know these seams exist and that Unity fills them:

- `ISceneLoader`: loads and releases scenes by handle and id; the core has no notion of a scene asset, path, or build index.
- `IInterestPositionReader`: reads a `NetworkSystem`'s world position for level of detail. (A distance condition reads positions through its own `TryReadSourcePosition`.) **This is a Pro seam**, not something every edition's Unity project has.
- `UnityPhysicsManager`: the inspector seat for the process-wide physics execution mode a `PhysicsSimulationCoordinator` reads.

A dedicated server or another engine implements these same seams its own way; nothing in the core requires Unity specifically.

## Subjects that live in one track only

Some subjects have no counterpart on the other side, so don't search for a page that would be empty:

- **Unity-only**: component references (the fields on each `UnityManager`), prefab id stamping, and editor tooling.
- **API-only**: writing a custom `INetworkLoopStepProvider`, driving ticks yourself instead of letting a provider do it, and hosting a dedicated .NET server with no engine attached.

## How the cross-links work

A page whose subject is split across both tracks opens with a one-line pointer to its counterpart — the Unity page for a setting points at the core manager member it mirrors, and the API page for that member points back at the inspector field. Following the link is never a detour into the same material restated; each side documents only what is actually different about it.
