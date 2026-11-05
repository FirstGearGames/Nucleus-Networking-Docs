---
title: "The host interest report"
---

> **Using Unity?** See [Making a host see what its players see](../../unity/interest/host-visibility-in-unity.md).

## The report tells a host what its own client half would have received

A host holds every object in the world, so it cannot tell what its own client half would have been sent. Set `InterestManager.HostInterestEnabled` to resolve the host's own client against the registered conditions, as for a remote client.

The answer is only a report. Nothing is culled, no observer is dropped and no despawn is written for the host. Objects keep existing, replicating and being controllable as before.

It is off by default because it costs one condition pass per evaluated pair for the host connection. Turn it on in a host world that should see what its players see, and leave it off on a dedicated server. It can be switched during a session. Turning it off returns each system's membership to `InterestMembership.Streamed`, and raises that change, as the system is next resolved.

## Read the report from each system

```csharp
public InterestMembership HostInterestMembership { get; private set; }
```

```csharp
public event HostInterestChangedHandler? HostInterestChanged;

public delegate void HostInterestChangedHandler(InterestMembership previousInterestMembership, InterestMembership currentInterestMembership);
```

`HostInterestChanged` is raised only on a host, and only while `HostInterestEnabled` is set. It arrives on the network loop thread on the interest cadence, and a handler may do engine work. `HostInterestMembership` reads `InterestMembership.Streamed` on a client, on a dedicated server, and on a host with `HostInterestEnabled` cleared.

## Hide on Unspawned, not Stopped

`InterestMembership.Unspawned` means a client would not have the object at all, so it is the one to hide on. `InterestMembership.Stopped` means a client would still see the object, just without updates, so hiding on `Stopped` shows the host less than its players see.

A system leaving the world, or the host's client half dropping its link, returns the membership to `Streamed` and raises that too, so anything you hid on `Unspawned` is always shown again.

## The bundle gate abstains for a host, the scene gate does not

A host's own client already holds every content bundle the server loaded, so `BundleInterestCondition` abstains for any Connection with `IsHostLoopback` set, and for one on a local in-process transport such as Yak.

The scene condition does not abstain. A host is placed in scene instances like any other client, so the scene gate settles against its real scene records. Position and scene are what can genuinely differ for a host.
