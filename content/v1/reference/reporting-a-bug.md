---
title: "Reporting a bug"
---

Bugs go to the [issue tracker](https://github.com/FirstGearGames/nucleus-issues/issues/new/choose). The form there asks for your version, edition, transport and topology, because those four facts decide which code path ran.

This page covers the part the form cannot do for you: the project you attach so someone else can see the fault happen.

## Why a project matters

Nucleus faults are usually timing faults. A description of what you saw narrows the search a little; a project that reproduces it narrows it to a specific tick. Most reports that go unfixed are not ignored, they simply could never be reproduced.

An issue without a reproduction project is investigated at lower priority, and may be closed if it cannot be reproduced.

## The size limit

**Under 1 MB, zipped.** That sounds tight, and it is not. A Unity project carrying one scene, a handful of prefabs and the Nucleus package fits comfortably once the regenerated folders are gone.

Delete these before zipping. Unity rebuilds every one of them the first time the project is opened:

- `Library/`
- `Temp/`
- `obj/` and `Build/`
- `Logs/`
- `UserSettings/`

`Library/` alone is usually most of the archive. If you are still over 1 MB after deleting it, something in `Assets/` is the cause, and it is almost always an imported asset that the bug does not need.

## What the project should contain

- **No third-party assets.** Replace anything from the Asset Store with primitives and untextured materials. A project that cannot be opened without buying something cannot be used to investigate your bug.
- **The Nucleus package as you have it installed.** Which build you are running is part of the report, so leave it in rather than stripping it out to save space.
- **One scene, one fault.** Strip everything the bug does not need. If two things are wrong, open two issues.
- **The steps inside that scene**, named exactly: which scene to open, what to press, what to watch.

## What to say alongside it

- **The topology it needs.** A host, or a dedicated server plus a client, and how many peers have to be running. A large class of faults disappears the moment the same code runs as a host, and the reverse is also true.
- **How often it happens.** "Every time" and "roughly one run in four" lead to completely different investigations. An intermittent fault is still worth reporting, as long as the report says it is intermittent.
- **Whether it happens in a build too**, or only in the editor.
- **Any simulated packet loss** you had switched on, and at what percentage.

## If you cannot get under 1 MB

Open the issue anyway. Attach the smallest project that still shows the fault, and say in the issue what you could not remove and why. A report that arrives is worth more than one that was never filed because the archive was 1.4 MB.

## What not to send

Do not attach your game. A full project is slower to investigate than no project at all, because the first job becomes cutting it down, and only you know which parts matter.
