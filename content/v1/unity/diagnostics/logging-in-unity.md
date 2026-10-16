---
title: "Engine logging in the Unity console"
---

> **Driving the core API directly?** See [Logging](../../core-api/diagnostics/logging.md).

Every message the engine logs already shows up in the Unity console. There is nothing to wire up.

## How it gets there

During initialization, `NucleusUnity` registers a Unity-specific logger with the engine's logging service:

```csharp
LoggingService.UseLogger(new Logging.Logger());
```

`Nucleus.Integrations.Unity.Logging.Logger` implements `ILogger` and routes each level to the matching `UnityEngine.Debug` call: `LogInformation` to `Debug.Log`, `LogWarning` to `Debug.LogWarning`, `LogError` to `Debug.LogError`. Because these are the same calls Unity's own code uses, console lines from the engine click through to their call site like any other Unity log.

## Lines carry Unity's own stack trace

The Unity `Logger` hands each message to `Debug` unchanged, and Unity attaches its own stack trace as the project's Stack Trace Logging settings allow (Project Settings > Player > Other Settings). It overrides `DisableUnconditionalDevelopmentStacktrace()` to return `true`, so the engine does not add a second trace on top.

## Reading a line

A line is prefixed with `[Type::Method]`, built from the calling type and a `CallerMemberName`-based method name - not a manager or subsystem category. The stack trace is appended to the message as plain text after a colon, not attached as one of Unity's own clickable console links, so the click-through you get is Unity's default per-line behavior, not something the stack trace text itself provides.

## Setting the volume

`LoggerSetting` declares three levels: `Editor`, `DevelopmentBuilds`, and `ReleaseBuilds`. The Unity logger's defaults are Information for the editor, Information for development builds, and Error for release builds.

Which of the three applies is decided by the Unity application state the integration registers before the first scene loads: the editor uses `Editor`, a development player uses `DevelopmentBuilds`, and a release player uses `ReleaseBuilds`. The level is worked out again whenever the logger or the application state is set, so the order the two are registered in does not matter, and a release build logs only errors by default. To change the volume, register your own logger whose `GetLoggerSetting` returns the levels you want (below).

## Replacing the sink

If your project already logs somewhere else - a file, a remote service, a custom console - register your own `ILogger` in place of the Unity one:

```csharp
LoggingService.UseLogger(new MyProjectLogger());
```

Do this after `NucleusUnity` has registered its logger, so your call is the one that sticks. Your implementation controls `GetLoggerSetting()` and `DisableUnconditionalDevelopmentStacktrace()` as well as the three log methods. Giving up the Unity `Logger` means giving up its click-through-to-call-site behavior; your sink is responsible for its own way of pointing back at source, if you want one.
