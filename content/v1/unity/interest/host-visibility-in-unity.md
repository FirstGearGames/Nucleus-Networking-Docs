---
title: "Making a host see what its players see"
---

> **Driving the core API directly?** See [The host interest report](../../core-api/interest/host-interest-report.md)

A host is the server, so it holds every object whatever interest resolves for its players. Unless something acts on that, the person hosting sees every object in the level while their players are sent only some.

## Turn on host hiding

On the `UnityInterestManager`, set **Host Interest Enabled** before the host starts. **Host Visibility Enabled** is already on, so this one switch turns hiding on.

- **Host Interest Enabled** resolves the host's own client against the interest rules, so the host learns which objects its client half would not have been sent. It is off by default because it costs the host one ordinary condition pass per evaluated pair, the same as every remote client.
- **Host Visibility Enabled** hides an object on the host while that report says its client half would not hold it. Only the renderers go dark: the object stays, keeps simulating and keeps replicating.

The hiding is done by a `NetworkHostVisibility` component, which is added to every networked object once the peer becomes a host, including objects already spawned. A client or a dedicated server never gets one.

## Use NetworkHostVisibility from a script

| Member | What it tells you |
|---|---|
| `IsVisibleToHostClient` | True while a host's client half would be holding this object, which is every moment outside a cull. Always true on a client, on a dedicated server, and on a host that resolves nothing for itself. |
| `HiddenRendererCount` | How many renderers this component currently has switched off. Zero on a peer that hides nothing, and on an object currently shown. |
| `RefreshRenderers()` | Gathers the renderers under this object again. Call it after adding or swapping renderers at runtime; a renderer created after this component's `Awake` is otherwise unknown to it. |
| `HostVisibilityChanged` | Raised when the object crosses into or out of what a host's client half would be holding, after the renderers have been switched. For a script that has more to hide than renderers. |

A renderer the game had already disabled stays disabled. Only renderers this component switched off are switched back on.

## Answer the report yourself

Clear **Host Visibility Enabled** to keep the report without the built-in hiding. Then handle `NetworkHostVisibility.HostVisibilityChanged` on a component you place yourself, or `NetworkSystem.HostInterestChanged` directly. Use this to dim an object instead of hiding it, or to hide more than its renderers.

## Avoid these mistakes

- Both inspector switches are read once as the session starts, so changing either during play has no effect.
- `InterestManager.HostInterestEnabled` can change from code mid-session, but whether to hide is decided once, when the peer first becomes a host with its client linked. Turning it on after that gives the report with nothing hiding on it. Turning it off returns every object's membership to `InterestMembership.Streamed`, which shows it again. Code that sets it before the host starts must run after `UnityInterestManager` has applied its settings, or the inspector value overwrites it.
- A dedicated server has no client half. Leave both switches alone.
- Only `InterestMembership.Unspawned` hides an object. A system that is only stopped for a player keeps its object, frozen, so the host shows it too.
