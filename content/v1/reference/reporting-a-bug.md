---
title: "Reporting a bug"
---

Report bugs on the [issue tracker](https://github.com/FirstGearGames/nucleus-issues/issues/new/choose). Its form asks for your version, edition, transport and topology. Attach a project that reproduces the fault: an issue without one is investigated at lower priority, and may be closed if it cannot be reproduced.

## Keep the zipped project under 1 MB

**Attachments over 1 MB are deleted, with no exceptions.** Deleting the attachment does not close the issue, but it leaves the issue without a reproduction project. Do not attach an oversized project and explain the size instead.

1. Delete these folders, which Unity rebuilds when the project opens:
   - `Library/`, usually most of the archive on its own.
   - `Temp/` and `obj/`.
   - `Build/`.
   - `Logs/`. Paste the relevant log lines into the issue instead.
   - `UserSettings/`.
2. Delete the `Assets/Nucleus` folder. **Do not include the Nucleus package**; give your version on the form.
3. Replace every third-party asset, such as anything from the Asset Store, with primitives and untextured materials.
4. Cut the project down to one scene showing one fault. If two things are wrong, open two issues.
5. Zip it. If it is still over 1 MB, something in `Assets/` is not needed for the bug; find it and remove it.

Do not send your whole game. Only you know which parts matter, so a full project is slower to investigate than none.

## Say these things in the issue

- **The steps.** Which scene to open, what to press, and what to watch for.
- **The topology.** A host, or a dedicated server plus a client, and how many peers must be running. Many faults appear only as a host, or only without one.
- **How often it happens.** "Every time" or "roughly one run in four". An intermittent fault is still worth reporting.
- **Whether it also happens in a build**, or only in the editor.
- **Any simulated packet loss** you had switched on, with the percentage.
