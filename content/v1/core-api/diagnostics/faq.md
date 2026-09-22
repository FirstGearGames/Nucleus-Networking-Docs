---
title: "Frequently asked questions"
---

Short answers to the questions that come up before anyone has finished reading the rest of the docs. Each one links to the page with the full explanation.

## Visibility and spawning

### Why did an object stop moving instead of disappearing

Interest resolves to one of a few verdicts per connection, and "stopped" is not "unspawned." A stopped object is kept by the receiver and simply sent nothing further, which reads as frozen; an unspawned object is torn down. They are different outcomes of the same evaluation, not two names for one thing. See the interest and area-of-interest pages for what drives each verdict.

### Why is nothing replicating at all

Check that the Nucleus source generator is wired into the project as an analyzer, not just referenced as an ordinary assembly. Without it no serializers are produced for your networked types, so there is nothing for the wire to send or read. See the source generator setup page.

## Control

### Why can I see my object but not drive it

Observing and controlling are separate questions. Interest decides whether a connection is sent an object's state at all; control is a separate assignment made by the server over who is allowed to drive it. Being registered as an observer never implies being the controller. See the control assignment page.

## Timing

### Why does it work in host mode and break with two processes

A host's own client and its server share one process, and packets between them still go through the transport's loopback path. The receiving half never reads that loopback copy back: it discards the arriving packet unread rather than deserializing it, so nothing on the deserialize-and-apply path runs for a host talking to itself. Testing exclusively in host mode never exercises that path at all, which is why a bug there only shows up once a second process is involved. See the diagnosing-desync page for the isolation steps.

## Host-mode surprises

### Why does the host see my object differently than my client does

The same loopback exemption above applies more broadly: a host's server half never goes through its own client's receive path, so anything gated behind deserialization, including any host-side reporting of what its own client would have received, has to be resolved separately rather than inferred from a packet the host never actually reads.

## Bandwidth surprises

### Why is my bandwidth number unchanged after I turned a feature off

The transport's byte and bit counters are running totals, accumulated since the connection started, with no per-object or per-feature attribution. Turning a feature off changes the rate at which the totals climb, not the totals themselves, so a snapshot taken once won't show it. Sample the counters over time (per second) and compare rates before and after the change, rather than reading a single cumulative value.

## Editions

### Why does this type not exist in my build

Free and Pro are not a runtime switch. A Pro-only source file is excluded from the compilation entirely when building Free, so a Pro-only type is a compile error in a Free project, not something that fails or falls back at runtime. If your code references a type that isn't there, you're either building Free against Pro-only API, or your project is pulling in the wrong edition's files.
