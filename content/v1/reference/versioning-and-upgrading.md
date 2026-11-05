---
title: "Versioning, upgrading and release notes"
---

## Check which build you are running

- In a project, `Assets/Nucleus/VERSION.txt` reads `Nucleus <version>`.
- A running player writes `Thank you for using Nucleus Networking <version>.` to its log at launch.

The DLLs carry no version number.

## Run the same build on every peer

Peers do not exchange a protocol version when they connect, so nothing checks that both ends match. A client and server on different builds misread each other's packets or silently disagree about what a message means. If you see corruption or unexplained desync, confirm both ends run the same build first.

## Replace removed members

| Removed | Replacement |
|---|---|
| `IsAuthority` | `IsServerStarted` or `IsController`, depending on which you meant |
| `IsHostOwnClient` | removed, no direct replacement |
| `IsHostOwnServer` | removed, no direct replacement |

A naming pass also renamed roughly 1,300 members. If a member you remember is not in the table and no longer resolves, search the current API for a similarly named member before assuming it is gone. If you still cannot find it, see the support page.
