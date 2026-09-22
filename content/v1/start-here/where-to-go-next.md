---
title: "Where to go next"
---

A quickstart gets one object moving between two peers. It does not tell you which of the thirty other pages matter for the game you're actually building. This page does.

## If you're building on Unity

- **A player-controlled character.** Start with control and `NucleusBehaviour` — how a system decides who may drive it, and `IsController` as the check your scripts gate input and movement on. `NetworkPlayerSpawner` hands each authenticated connection its own object automatically; you still write what a script does with it once `IsController` says this peer drives it.
- **A world with more objects than one peer can hold.** Read interest next: how `InterestManager` decides which spawns, despawns, and state updates a connection actually receives.
- **A game with several rooms or matches.** Read up on scenes and per-room worlds — each room opening its own copy of a scene, and how a system finds the copy it belongs to rather than the first one loaded.
- **A dedicated server.** Read the server/headless setup page, then control — a dedicated server is the clearest case of a peer that drives everything and controls nothing itself.

## If you're building against the core library

- **A player-controlled character.** Read control at the `NetworkSystem` level — `IsController(ControllerType)`, without the Unity component layer (`NucleusBehaviour`, `EnsureIsController`) on top.
- **A world with more objects than one peer can hold.** Same interest page as above; `InterestManager` is core, not Unity-specific.
- **A game with several rooms or matches.** Read the scene management page for how a server opens and closes per-room scene instances and how systems get scoped to one.
- **A dedicated server.** Read the transport and connection setup pages for running a `CoreManager` headless, then control.

## What everyone needs by week two

Regardless of route, three pages stop being optional once you're past a single moving cube:

- **Control** — who may write what, and why a write from the wrong peer is silently wrong rather than an error.
- **Interest** — why a connection sees some objects and not others, and what changes that.
- **Diagnostics** — when an object exists on one peer and never appears on another, this is the page that walks the checklist: is it in the sender's interest set, did the spawn actually replicate, is the receiving system still waiting on a handshake step. Read it before assuming the bug is yours.

## The two guided tutorials

If you'd rather build one whole small game than read features in isolation, work through both tutorials in order. Each is a sequence of small, working steps rather than a single walkthrough.

**Courier Run** starts from a bare connecting world and adds, step by step: a per-player controlled object, prefab claiming, keeping a claim honest against a race, carrying and scoring an item, replacing `Instantiate` with pooled spawning, measuring what each kind of object costs to replicate, and moving the whole arena into a scene of its own that every player joins. By the end it also covers a scoreboard that reaches every player regardless of which scene they're standing in.

**Lobby and Worlds** starts from an empty lobby and builds up room membership: taking a name, creating and listing a room, joining with its four refusal cases, leaving and host handoff, kicking, and ready-checks. It then opens a scene per room — the trap of placing an object before that scene is the one you're in, and how a system finds the copy it was just opened into — and finishes with per-room physics and a per-room win message.

Neither tutorial is a substitute for the reference pages above; each explains a feature only as far as that game needs it.

## Runnable examples, no engine required

`Nucleus.Tests` is the actual body of core-only examples. `Integrations/Bridge/BridgeSyncTests.cs` wires two real `CoreManager` instances together over an in-memory transport and drives them by hand — message round-trips in both directions, server-to-client system spawn, and delta convergence — with no Unity, no sockets, and no flaky timing. `Harness/LoopHarness.cs` is the setup code those tests share: building a hand-driven `CoreManager`, and ticking both ends forward until a condition holds. If you learn an API fastest from working code rather than prose, start there.

## When a page doesn't answer it

If you've read the relevant reference page and the tutorial chapter that covers the same feature and you're still stuck, that's worth asking about directly rather than guessing from partial documentation — file the question against the Nucleus repository rather than assuming the gap is intentional.
