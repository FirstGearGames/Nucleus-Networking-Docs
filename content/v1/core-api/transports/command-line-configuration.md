---
title: "Configuring a transport from launch arguments"
---

## Applying launch arguments

`Transport.ApplyCommandLineArguments()` reads the current process's parsed launch arguments and applies the flags a transport recognizes onto its `Configuration`. Nothing calls it for you; a build that wants its endpoint to come from the command line calls it itself, after adding the transport and before connecting.

```csharp
Transport transport = await coreManager.TransportManager.AddTransportAsync<Synapse>();
transport.ApplyCommandLineArguments();

await transport.ConnectAsync(invoker);
```

An overload takes a `CommandLineArguments` instance directly, for arguments that did not come from this process's own command line, such as a launcher's own configuration:

```csharp
CommandLineArguments launcherArguments = new(launcherProvidedArgs);
transport.ApplyCommandLineArguments(launcherArguments);
```

A flag that was not supplied leaves its setting at whatever the build configured. Applying arguments is safe to call even when the launcher passes none.

### Ordering

Apply arguments before `ConnectAsync`. The socket reads `Configuration` (and, for Synapse, `RemoteHost`) as it builds; changing those values after the connection has started has no effect on that connection.

## Flags that ship

| Flag | Honored by | Sets |
|---|---|---|
| `port` (`Transport.PortArgument`) | Every transport | `Configuration.Port` |
| `address` (`Synapse.AddressArgument`) | `Synapse` | `RemoteHost` |

`port` is read as a `ushort`. Every transport honors it because the base `Transport.OnApplyCommandLineArguments` applies it.

`address` is Synapse-specific. The server side of a Synapse transport binds every local address, so it reads only the port; the client side connects out to `RemoteHost`, so `address` sets that. Supplying an `address` value that does not parse as an IP address leaves `RemoteHost` unchanged and logs an error.

```csharp
transport.ApplyCommandLineArguments(new(["Server.exe", "-port", "7777", "-address", "10.0.0.5"]));
```

## Adding your own flags

Override `OnApplyCommandLineArguments` on a transport to read additional flags. Call the base implementation first so the shared `port` flag still applies:

```csharp
protected override void OnApplyCommandLineArguments(CommandLineArguments commandLineArguments)
{
    base.OnApplyCommandLineArguments(commandLineArguments);

    if (commandLineArguments.TryGetValue(MyCustomArgument, out string value))
    {
        // apply value
    }
}
```

## The parser

`CommandLineArguments` parses a `string[]` of launch arguments into flag/value pairs. `CommandLineArguments.Process` parses `Environment.GetCommandLineArgs()` on first use and caches the result for the process lifetime.

Supported forms:

- Separated: `-flag value` or `--flag value`
- Inline: `-flag=value` or `--flag=value`
- Single or double dashes, either form
- Flags match case-insensitively (`-PORT` and `-port` are the same flag)
- A dash immediately followed by anything other than a letter is read as a value, not a flag, so a negative number (`-5`) supplied as a value survives instead of being mistaken for a flag
- A token with nothing before it that a flag would claim (the executable path in argument zero) is ignored
- A flag with nothing after it (end of arguments, or the next token is itself a flag) is still recorded, with an empty value, so it reads as a switch

```csharp
CommandLineArguments args = new(["Server.exe", "-port", "7777", "--address=10.0.0.5", "-headless", "-offset", "-5"]);
```

### Reading values

`TryGetValue`, `TryGetUInt16`, and `TryGetUInt32` report failure rather than throwing, since launch arguments are user input:

```csharp
if (commandLineArguments.TryGetUInt16("port", out ushort port))
    Configuration.Port = port;
```

`TryGetValue` returns false for a flag that was never supplied, and also for a flag supplied with no value (an empty string does not count as a value). `TryGetUInt16` and `TryGetUInt32` additionally return false when the supplied value does not parse as that integer type.

Use `Contains(flag)` to read a valueless switch, where the flag's presence is the information:

```csharp
if (commandLineArguments.Contains("headless"))
{
    // run without a display
}
```
