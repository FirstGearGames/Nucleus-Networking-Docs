---
title: "Versioning, upgrading and release notes"
---

## Checking your build

Every Unity release names itself in two places. `Assets/Nucleus/VERSION.txt` reads `Nucleus <version>`, so you can check what a project has installed without building anything, and a running player writes `Thank you for using Nucleus Networking <version>.` to its log at launch, so you can check what a built player is running.

The DLLs themselves carry no version: `Nucleus.csproj` sets `GenerateAssemblyInfo` to `false`, and `AssemblyInfo.cs` declares only the title, product, company, copyright and a licence metadata string, with no `AssemblyVersion` or `AssemblyFileVersion` attribute. There is no protocol-version handshake between peers at connect time either, so the version a peer runs is something you check, not something the connection checks for you.

## What this page will become

As releases accumulate, this page holds two things:

- **Release notes** — one entry per build, describing what changed.
- **API change register** — a table of deliberate breaking changes, each row keyed to the build it landed in and naming the direct replacement for whatever it removed.

Until then, the section below is the closest thing to that register: the breaking changes a current beta tester is likely to hit.

## Changes to know about right now

| Removed | Replacement |
|---|---|
| `IsAuthority` | `IsServerStarted` or `IsController`, depending on which you meant |
| `IsHostOwnClient` | removed, no direct replacement |
| `IsHostOwnServer` | removed, no direct replacement |

Separately, a framework-wide naming audit renamed roughly 1,300 members in one pass. If a member you remember by name no longer resolves and isn't in the table above, it's almost certainly a casualty of that audit rather than a removal — search the current API for a similarly-named member before assuming it's gone.

## Mixed builds are not supported

Both peers in a connection must run the same build. The wire format carries no version number, so a client and server on different builds will not fail cleanly — they'll either misread each other's packets or silently disagree about what a message means. There is no handshake to catch this for you. If you see corruption or unexplained desync, confirm both ends are on the same build before looking anywhere else.

## Can't find where something moved?

If a member you're looking for isn't in the table above and you can't locate its replacement, see the support page.
