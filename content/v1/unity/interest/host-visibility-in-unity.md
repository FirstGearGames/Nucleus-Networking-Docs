---
title: "Making a host see what its players see"
---

> **Driving the core API directly?** See [The host interest report](../../core-api/interest/host-interest-report)

A host is the authority: it holds every object in its own process regardless of what interest rules resolve for anyone. Without anything acting on that report, the person hosting sees every object in the level while their players are only sent a few — the host plays a different game to everyone else.

## Turning it on

On the `UnityInterestManager` component, set **Host Interest Enabled**. That is the whole of it. Its acting half, **Host Visibility Enabled**, is already on by default, so switching on the report is what switches on the hiding.

**Host Interest Enabled** resolves this peer's own client against the world's interest rules too, so the host can be told which objects its client half would not have been sent. It is off by default because the pass costs the host connection an ordinary condition pass per evaluated pair, the same one every remote client already pays.

**Host Visibility Enabled** is the acting half: it hides an object on a host while the report says its own client half would not have been holding it. Nothing is ever culled from a host by it — the object stays, keeps simulating, keeps replicating. Only its renderers go dark.

## What actually hides the object

A `NetworkHostVisibility` component is put on each of a world's networked objects, but only once this peer turns out to be a host, and only then. A client and a dedicated server never attach one and never walk an object for renderers they could not hide anyway.

The mechanism is a `HostVisibilityBinder`, one per `CoreManager`, built by `UnityInterestManager` whenever Host Visibility Enabled is set. It watches for the moment this peer becomes a host, sweeps every object already linked at that point, and from then on attaches the component to each object as it links. A peer only becomes a host partway through its own startup, often after its scenes have already spawned a world, so the sweep is what catches those already standing.

## NetworkHostVisibility reference

| Member | What it tells you |
|---|---|
| `IsVisibleToHostClient` | True while a host's client half would be holding this object — every moment outside a cull. True on a client, on a dedicated server, and on a host that resolves nothing for itself. |
| `HiddenRendererCount` | How many renderers this component currently has switched off. Zero on any peer that hides nothing, and zero on an object that is currently shown. |
| `RefreshRenderers()` | Re-gathers the renderers under this object. Call it after adding or swapping renderers at runtime — a renderer created after this component's `Awake` is otherwise unknown to it. |
| `HostVisibilityChanged` | Raised as the object crosses into or out of what a host's client half would be holding, after the renderers have already been switched. For a script that has more to hide than renderers. |

A renderer the game had already disabled stays disabled: only the renderers this component switched off get switched back on.

## Answering the report yourself

Clear **Host Visibility Enabled** to keep the report without the built-in hiding. Nothing is hidden automatically, and it's yours to answer through `NetworkHostVisibility`'s own `HostVisibilityChanged` event, or through `NetworkSystem.HostInterestChanged` directly. That's the path for dimming an object instead of hiding it, or for hiding more than its renderers.

## Gotchas

- Both switches are read once as the world comes up. Changing either while playing leaves that session hiding exactly as it already was.
- A dedicated server has no client half to answer for. Leave both switches alone.
- Hiding only happens on `InterestMembership.Unspawned`. A system that's merely stopped for a player still keeps its object standing, frozen rather than gone — hiding on a stop would show the host less than that player actually sees.
