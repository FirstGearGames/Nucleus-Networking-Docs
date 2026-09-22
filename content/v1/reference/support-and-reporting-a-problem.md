---
title: "Support and reporting a problem"
---

## Where support happens

During the closed beta, support runs through your account and Discord, not
a public issue tracker. Nucleus is unreleased, confidential software, and a
defect you hit is Confidential Information under the beta agreement — the
same as the engine and its documentation. A public tracker would put that
information somewhere it isn't allowed to be. Sign in on the account you
used to get access, and reach us from there or from the linked Discord.

## What to include

A report that lets us act on it the first time includes:

- **Build and edition.** Free or Pro, and the exact build you're on. Edition
  is a compile-time choice (`-p:NucleusEdition=Free` drops every `*.Pro.cs`
  file), so state it rather than let us guess from symptoms.
- **Runtime.** Unity version if you're in the Unity integration, or the
  target framework if you're a plain host (the engine itself targets
  `netstandard2.1`).
- **Transport.** Which transport you're running on.
- **Tick rate.** The rate your `CoreManager` is configured for.
- **The exact log line.** Full text, not paraphrased or summarized.
- **A minimal reproduction**, kept private — send it through the same
  account/Discord channel, not a public link or repo.

## Capturing the log

All engine logging goes through `CodeBoost.Logging.LoggingService`. A plain
.NET host gets `ConsoleLogger` by default — `LoggingService` wires one up in
its static constructor — so console output is already there unless you've
called `LoggingService.UseLogger` to register your own `ILogger`.

The Unity integration registers its own logger
(`Nucleus.Integrations.Unity.Logging.Logger`) that routes every message
through `UnityEngine.Debug.Log`/`LogWarning`/`LogError` with a full stack
trace appended, so log entries click through to source in the console. Copy
the entry as it appears, stack trace included — that's what we need to
place it.

## Before you report it

Reproduce headlessly where you can, before assuming it's an engine bug. A
host runs both the server and client sides of the connection in the same
process, and running both roles in one process can mask or manufacture
behavior a real client/server split does not show. Narrowing the repro to
plain code, off the editor and off host mode, rules out a whole class of
environment-shaped false positives before it reaches us. See [Filing a bug
report](/meta/filing-a-bug-report) for what a solid repro looks like.

## Support tiers

Support tiers exist and are described on the [pricing
page](https://nucleus-networking.com/pricing) — check there for what your
plan covers rather than assuming.

## What we can't offer yet

There's no community tutorial directory, no documentation pull requests,
and no third-party guides. Everything you read here is written and
maintained by us; report gaps through the same account/Discord channel
rather than trying to route around it.
