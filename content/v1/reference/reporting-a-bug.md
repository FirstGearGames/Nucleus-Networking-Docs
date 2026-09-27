---
title: "Reporting a bug"
---

Bugs go to the [issue tracker](https://github.com/FirstGearGames/nucleus-issues/issues/new/choose). The form there asks for your version, edition, transport and topology, because those four facts decide which code path ran.

This page covers the part the form cannot do for you, which is the project you attach so that someone else can watch the fault happen.

## A reproduction project is what gets a bug fixed

Nucleus faults are usually timing faults. A description of what you saw narrows the search a little, but a project that reproduces it narrows the search to a single tick. Most reports that go unfixed were never ignored; they simply could not be reproduced.

An issue without a reproduction project is investigated at lower priority, and it may be closed if it cannot be reproduced.

## Every attachment must be under 1 MB

**Zip your project and keep the archive under 1 MB. Attachments over 1 MB are deleted, and there are no exceptions.**

That limit sounds tight, and it is not. A Unity project carrying one scene, a handful of prefabs and the Nucleus package fits comfortably once the regenerated folders are gone, and every reproduction project can be reduced to that.

Delete these folders before zipping, because Unity rebuilds every one of them the first time the project is opened:

- `Library/` holds the imported asset cache, and it is usually most of the archive on its own.
- `Temp/` and `obj/` hold intermediate build files.
- `Build/` holds any player you have built from the project.
- `Logs/` holds the editor logs, which belong pasted into the issue rather than zipped.
- `UserSettings/` holds your personal editor layout, which nobody else needs.

## The project should contain only what the bug needs

- **Remove every third-party asset.** Replace anything from the Asset Store with primitives and untextured materials, because a project that cannot be opened without buying something cannot be used to investigate your bug.
- **Leave the Nucleus package in place, exactly as you have it installed.** Which build you are running is part of the report, so do not strip it out to save space.
- **Reduce the project to one scene showing one fault.** If two things are wrong, please open two issues.
- **Name the steps precisely.** Say which scene to open, what to press, and what to watch for.

## Say these things in the issue itself

- **Describe the topology the fault needs.** Say whether it takes a host or a dedicated server plus a client, and how many peers have to be running. A large class of faults disappears the moment the same code runs as a host, and the reverse is true just as often.
- **Say how often it happens.** "Every time" and "roughly one run in four" lead to completely different investigations. An intermittent fault is still worth reporting, as long as the report says that it is intermittent.
- **Say whether it also happens in a build**, or only in the editor.
- **Mention any simulated packet loss** that you had switched on, and give the percentage.

## Attachments larger than 1 MB are deleted

If your zipped project is still over 1 MB after you have deleted the regenerated folders, then the extra size is coming from something in `Assets/` that the bug does not need. Find it and remove it. Cutting a project down to the smallest thing that still shows the fault is useful work in its own right, because it tells you which parts of your setup the fault actually depends on.

Please do not attach an oversized project and explain the size in the issue instead. An attachment larger than 1 MB is deleted, and while deleting it does not close your issue, it does leave that issue without a reproduction project. An issue without one is investigated at lower priority, and it may be closed if it cannot be reproduced.

## Do not send your whole game

A full project is slower to investigate than no project at all, because the first job becomes cutting it down, and only you know which parts matter.
