---
title: "Logging"
---

> **Using Unity?** See [Engine logging in the Unity console](../../unity/diagnostics/logging-in-unity.md).

## The default logger

A plain .NET host gets a `ConsoleLogger` automatically. `LoggingService` registers one in its static constructor, so `Console.WriteLine` output starts flowing before you write any setup code. That's fine when the engine runs behind a terminal. It's wrong for a service: nothing there reads stdout, so every log line is lost.

## Swapping the logger

`LoggingService.UseLogger(ILogger)` is the one call that replaces the active logger. It sets the public `LoggingService.Logger` field and re-reads the current logging level, so a fresh sink starts filtering correctly from that point on.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
```

Code that needs to react when the logger changes can subscribe to `LoggingService.LoggerSet`, which fires with the newly registered `ILogger` instance.

```csharp
LoggingService.LoggerSet += logger => Console.WriteLine($"Logger swapped to {logger.GetType().Name}");
```

## Implementing ILogger

```csharp
public interface ILogger
{
    LoggerSetting GetLoggerSetting();
    bool DisableUnconditionalDevelopmentStacktrace();
    void LogInformation(string message);
    void LogWarning(string message);
    void LogError(string message);
}
```

`LogInformation`, `LogWarning`, and `LogError` receive the formatted message string; route each to your host's own logging framework.

`GetLoggerSetting` declares which `LoggerLevel` your logger runs at in each environment (see below). `LoggingService` calls it whenever it needs to re-cache the active level.

`DisableUnconditionalDevelopmentStacktrace` returns `true` when your sink already captures its own stack traces, so the engine doesn't need to attach one unconditionally in development environments.

## Levels and cost

`LoggerLevel` is `Error`, `Warning`, `Information`, or `Disabled`. `Error`, `Warning`, and `Information` run least to most verbose; `Disabled` turns logging off entirely rather than sitting at either end of that scale. `LoggerSetting` exposes it as three independent knobs:

| Field | Applies to |
|---|---|
| `Editor` | Running inside the editor |
| `DevelopmentBuilds` | Development builds outside the editor |
| `ReleaseBuilds` | Release builds |

`ConsoleLogger`'s setting runs `Information` in the editor and development, `Error` in release.

Checking a level before formatting a message avoids the cost of building a string nobody will read. `LoggingService` exposes `IsInformationEnabled`, `IsWarningEnabled`, and `IsErrorEnabled` for this:

```csharp
if (LoggingService.IsInformationEnabled)
    LoggingService.LogInformation($"Tick {tick}: {expensiveDescription()}");
```

When a level is disabled, the guarded branch never runs, so the interpolated string is never built.

## Set this before AddTransportAsync

Swap the logger before doing anything else with `CoreManager`. The default loop provider starts stepping the moment the `CoreManager` constructor returns, so any warnings raised during bring-up are lost if you swap the sink afterward. The level is also only re-read inside `UseLogger`, so calling it is what makes a later level change take effect, not just the sink change.

```csharp
CoreManager coreManager = new();
LoggingService.UseLogger(new MyServiceLogger());
// AddTransportAsync and everything after this line logs through MyServiceLogger.
```
