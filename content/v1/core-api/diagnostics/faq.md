---
title: "Frequently asked questions"
---

## Why did an object stop moving instead of disappearing

Interest stopped it rather than unspawning it. A stopped object stays on the receiver but is sent nothing further, so it looks frozen. An unspawned object is removed. See [Stopping versus culling](../interest/stopping-versus-culling.md).

## Why is nothing replicating at all

Check that the Nucleus source generator is added to the project as an analyzer, not as an ordinary assembly reference. Without it your networked types cannot be sent or read. See [Wiring the source generator into a .NET project](../wire/source-generator-setup.md).

## Why can I see my object but not drive it

Observing and controlling are separate. Interest decides whether a connection is sent an object's state. Control is assigned by the server. Being an observer never makes a client the controller. See [What control means](../control/the-control-model.md).

## Why does it work in host mode and break with two processes

Some bugs only show up on a client in a separate process, never on a host's own client, so test with a second process. See [Diagnosing desync](./diagnosing-desync.md).

## Why does the host see my object differently than my client does

A host holds every object in the world, because it is the server. To find out what its own client would have received, turn on the host interest report. See [The host interest report](../interest/host-interest-report.md).

## Why is my bandwidth number unchanged after I turned a feature off

The transport's byte and bit counters are running totals since the connection started. Turning a feature off changes how fast they climb, not their value. Sample them per second and compare the rates before and after. See [Network statistics](./network-statistics.md).

## Why does this type not exist in my build

Pro-only code is left out of a Free build entirely, so a Pro-only type is a compile error in a Free project, not a runtime failure. Either your code uses Pro-only API in a Free build, or your project has the wrong edition's files.
