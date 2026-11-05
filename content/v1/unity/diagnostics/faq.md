---
title: "Frequently asked questions"
---

## Why did an object stop moving instead of disappearing

Interest stopped it rather than unspawning it. A stopped object stays on the receiver but is sent no more updates, so it looks frozen. An unspawned object is removed. See [Frozen or gone: what a stop does to the object](../interest/stopping-objects-in-unity.md).

## Why is nothing replicating at all

Check that the Nucleus source generator runs as an analyzer, not just as a referenced assembly. Without it your networked types are never set up to replicate. See [Code Generation in Unity](../wire/code-generation-in-unity.md).

## Why can I see my object but not drive it

Observing and controlling are separate. Interest decides whether a connection is sent an object's state; the server separately assigns who controls it. Observing an object never makes you its controller. See [What control means](../control/the-control-model.md).

## Why does it work in host mode and break with two processes

Some bugs only show on a client in a separate process, never on a host's own client, so test with a second process. See [Diagnosing desync](./diagnosing-desync.md).

## Why is my bandwidth number unchanged after I turned a feature off

The transport's byte and bit counters are running totals since the connection started, with no per-object or per-feature breakdown. Sample them once a second and compare the rates before and after the change. See [Reading network statistics in Unity](./network-statistics-in-unity.md).

## Why does this type not exist in my build

Pro-only types are left out of a Free build entirely, so referencing one is a compile error, not a runtime failure. Either your code uses Pro-only API in a Free project, or the project has the wrong edition's files.
