---
title: "Engine logging in the Unity console"
---

> **Driving the core API directly?** See [Logging](../../core-api/diagnostics/logging.md).

Every engine log line already shows up in the Unity console, with nothing to set up. Nucleus routes information, warnings and errors to `Debug.Log`, `Debug.LogWarning` and `Debug.LogError`, so each line clicks through to its call site and carries Unity's own stack trace as your Stack Trace Logging settings allow (**Project Settings > Player > Other Settings**). Each line starts with `[Type::Method]`, naming the type and method that logged it.

## Set the log level

| `LoggerSetting` field | Applies to | Default |
|---|---|---|
| `Editor` | The editor | Information |
| `DevelopmentBuilds` | Development players | Information |
| `ReleaseBuilds` | Release players | Error |

To change the levels, register your own logger (below) whose `GetLoggerSetting` returns the levels you want.

## Replace the logger

To send engine logs somewhere else, such as a file or a remote service, register your own `ILogger`:

```csharp
LoggingService.UseLogger(new MyProjectLogger());
```

Nucleus registers its Unity logger before the first scene loads, so a call from any scene script replaces it. Your logger implements `GetLoggerSetting()`, `DisableUnconditionalDevelopmentStacktrace()` and the three log methods. It loses the Unity logger's click-through to the call site unless it provides its own.
