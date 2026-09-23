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

`ConsoleLogger`'s setting runs `Information` in the editor and development, `Error` in release. Which of the three applies comes from CodeBoost's application state, and in a plain .NET process the default one, `IdeApplicationState`, always reports that it is running in the editor, in Debug and Release builds alike. A .NET host therefore logs at `Information` by default, even in a Release build. To log less, register a logger whose `GetLoggerSetting` returns a lower `Editor` level.

Checking a level before formatting a message avoids the cost of building a string nobody will read. `LoggingService` exposes `IsInformationEnabled`, `IsWarningEnabled`, and `IsErrorEnabled` for this:

```csharp
if (LoggingService.IsInformationEnabled)
    LoggingService.LogInformation($"Tick {tick}: {expensiveDescription()}");
```

When a level is disabled, the guarded branch never runs, so the interpolated string is never built.

## Set this before new CoreManager()

Swap the logger before you construct the `CoreManager`. The constructor already logs (a clamped tick rate, for one), and with the default provider the loop starts stepping the moment the constructor returns, so anything raised during bring-up goes to the old sink if you swap afterward. The level is also only re-read inside `UseLogger`, so calling it is what makes a later level change take effect, not just the sink change.

```csharp
LoggingService.UseLogger(new MyServiceLogger());
CoreManager coreManager = new();
// The constructor, AddTransportAsync and everything after this line log through MyServiceLogger.
```
