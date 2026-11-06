---
title: "Building a headless Unity server"
---

> **Driving the core API directly?** See [Running a dedicated .NET server](../../core-api/transports/dedicated-server-host.md).

## Set up the server scene

1. Build with Unity's Dedicated Server target.
2. Put a `UnityCoreManager` in the scene that loads on launch. It adds a `UnityTransportManager` if the scene has none.
3. Set **Automatic Start Mode** on the `UnityTransportManager` to `Server`, or leave it at `None` and start the server from your own script if it reads launch arguments (below).

## Apply launch arguments before the server starts

Nothing in the Unity integration reads the process's launch arguments for you. Call `ApplyCommandLineArguments()` on each transport from your own script, before the transport connects.

Do not combine that script with **Automatic Start Mode** set to `Server`. `UnityTransportManager` starts from its own `Start`, and Unity does not order two components' `Start` calls, so the server can come up before your arguments are applied. Leave **Automatic Start Mode** at `None` and start the server after applying them:

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

`StartServerAsync` calls `EnsureAddedAsync` itself; the explicit call is there so `Transports` is filled before the loop.

`ApplyCommandLineArguments()` with no arguments reads the process's command line (`CommandLineArguments.Process`). The port flag is `-port <value>`, and any flag your transport recognizes works as `-flag value` or `-flag=value`.

## Read logs from the player log file

A headless server has no window, and `NetworkDiagnosticsHud` is demo code that does not ship. Nucleus logs through `UnityEngine.Debug`, so its output lands in the standalone player's log file.

## Shut the transports down early if you need to

`UnityTransportManager.ShutdownAll()` removes and shuts down every transport the manager added. It already runs when the component is destroyed, so call it yourself only to shut down earlier, such as from a signal handler that also tears down other state.

## Skip Unity if the server does not need it

If the server does not need Unity's engine loop, physics or other engine features, a plain .NET host avoids the editor, the Dedicated Server build and this bootstrap. See [Running a dedicated .NET server](../../core-api/transports/dedicated-server-host.md).
