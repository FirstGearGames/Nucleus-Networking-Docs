---
title: "Building a headless Unity server"
---

> **Driving the core API directly?** See [Running a dedicated .NET server](../../core-api/transports/dedicated-server-host).

## The scene

Build with Unity's Dedicated Server target. The scene that loads on launch needs a `UnityCoreManager` and, on the same GameObject hierarchy, a `UnityTransportManager` with its Automatic Start Mode set to Server.

`UnityCoreManager.Awake` runs before any other script (it carries `[DefaultExecutionOrder(-10000)]`), builds the `CoreManager`, and adds every missing Unity manager component - `UnityTransportManager` among them - so a scene with only a `UnityCoreManager` still ends up with one.

## Reading launch arguments yourself

Nothing in the Unity integration calls `Transport.ApplyCommandLineArguments` for you. `UnityTransportManager` adds each `NetworkTransport` component it finds to the core manager and can start them, but it never reads the process's launch arguments on your behalf. You need your own bootstrap script that calls `ApplyCommandLineArguments()` on each transport, and it has to run before that transport connects - the call only has anything to change if it runs first.

```csharp
using Nucleus.Transports;

public class ServerBootstrap : MonoBehaviour
{
    private async void Start()
    {
        UnityTransportManager transportManager = GetComponent<UnityTransportManager>();

        await transportManager.EnsureAddedAsync();

        foreach (Transport transport in transportManager.Transports)
            transport.ApplyCommandLineArguments();

        await transportManager.StartServerAsync();
    }
}
```

`ApplyCommandLineArguments()` with no arguments reads `CommandLineArguments.Process`, which parses `Environment.GetCommandLineArgs()` once and caches the result for the process. The port flag is `-port <value>`; any flag your transport recognizes works in both `-flag value` and `-flag=value` form.

## Why Automatic Start Mode alone isn't enough

`UnityTransportManager` starts itself from its own `Start()`, and Unity gives no ordering guarantee between two components' `Start()` calls on the same frame. Set Automatic Start Mode to Server and add your own argument-applying script beside it, and you have a race: whichever `Start()` runs first decides whether the server came up with your arguments applied or not.

Leave Automatic Start Mode at None and drive the start yourself once arguments are applied, as in the bootstrap above - call `StartServerAsync()` after your loop of `ApplyCommandLineArguments()` calls, not before. `StartServerAsync` calls `EnsureAddedAsync` itself, so the explicit call in the example above is only there to get at `Transports` before the transports connect.

## What a headless build has and doesn't have

There's no `NetworkDiagnosticsHud` in a build made this way - it's demo code that lives under the integration's `Demos` folder and isn't meant to ship. A headless server has no window to read it from regardless. Route Nucleus's own logging somewhere you can actually read: the Unity integration's logger writes through `UnityEngine.Debug`, whose output still lands in the standalone player's log file even with no console attached, so check that file rather than expecting a console window.

## Shutting down cleanly

Call `UnityTransportManager.ShutdownAll()` on process exit to remove and shut down every transport the manager added. It already runs from the component's own `OnDestroy`, so a normal scene teardown covers it; call it directly only if your bootstrap needs to shut the transports down before that, for example on a signal handler that also tears down other state.

## When to skip Unity entirely

If the server doesn't need Unity's engine loop, physics, or any other engine-side feature, a plain .NET host avoids the editor, the Dedicated Server build pipeline, and this bootstrap ordering altogether. See [Running a dedicated .NET server](../../core-api/transports/dedicated-server-host).
