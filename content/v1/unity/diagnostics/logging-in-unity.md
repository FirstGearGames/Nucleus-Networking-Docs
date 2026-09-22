---
title: "Engine logging in the Unity console"
---

> **Driving the core API directly?** See [Logging](../../core-api/diagnostics/logging).

Every message the engine logs already shows up in the Unity console. There is nothing to wire up.

## How it gets there

During initialization, `NucleusUnity` registers a Unity-specific logger with the engine's logging service:

```csharp
LoggingService.UseLogger(new Logging.Logger());
```

`Nucleus.Integrations.Unity.Logging.Logger` implements `ILogger` and routes each level to the matching `UnityEngine.Debug` call: `LogInformation` to `Debug.Log`, `LogWarning` to `Debug.LogWarning`, `LogError` to `Debug.LogError`. Because these are the same calls Unity's own code uses, console lines from the engine click through to their call site like any other Unity log.

## Why lines carry a stack trace

The Unity `Logger` appends a full stack trace to every message it logs, so you can always see where a line came from even without clicking through. To avoid printing that trace twice, it also overrides `DisableUnconditionalDevelopmentStacktrace()` to return `true`, telling the engine not to add its own unconditional development stack trace on top.

## Reading a line

A line is prefixed with `[Type::Method]`, built from the calling type and a `CallerMemberName`-based method name - not a manager or subsystem category. The stack trace is appended to the message as plain text after a colon, not attached as one of Unity's own clickable console links, so the click-through you get is Unity's default per-line behavior, not something the stack trace text itself provides.

## Setting the volume

`LoggerSetting` declares three levels: `Editor`, `DevelopmentBuilds`, and `ReleaseBuilds`. The Unity logger's defaults are Information for the editor, Information for development builds, and Error for release builds.

In practice, only the `Editor` level matters right now. The active level is cached once, at the moment `UseLogger` runs, from CodeBoost's `IdeApplicationState`. That state's `IsEditor()` reports `true` unconditionally, so every Unity build - editor, development, or release - is cached at the `Editor` level and never re-evaluates `DevelopmentBuilds` or `ReleaseBuilds` afterward. If you need less noise in a build, don't rely on those two settings yet; the only lever that actually changes it today is swapping the registered logger.

## Replacing the sink

If your project already logs somewhere else - a file, a remote service, a custom console - register your own `ILogger` in place of the Unity one:

```csharp
LoggingService.UseLogger(new MyProjectLogger());
```

Do this after `NucleusUnity` has registered its logger, so your call is the one that sticks. Your implementation controls `GetLoggerSetting()` and `DisableUnconditionalDevelopmentStacktrace()` as well as the three log methods. Giving up the Unity `Logger` means giving up its click-through-to-call-site behavior; your sink is responsible for its own way of pointing back at source, if you want one.
