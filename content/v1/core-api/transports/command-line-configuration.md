---
title: "Configuring a transport from launch arguments"
---

## Apply launch arguments before connecting

Nothing applies launch arguments for you. Call `Transport.ApplyCommandLineArguments()` after adding the transport and **before** `ConnectAsync`; values changed after the connection starts do not affect it.

```csharp
Transport transport = await coreManager.TransportManager.AddTransportAsync<Synapse>();
transport.ApplyCommandLineArguments();

await transport.ConnectAsync(invoker);
```

To apply arguments that did not come from this process's command line, such as a launcher's configuration, pass a `CommandLineArguments`:

```csharp
CommandLineArguments launcherArguments = new(launcherProvidedArgs);
transport.ApplyCommandLineArguments(launcherArguments);
```

A flag that was not supplied leaves its setting as the build configured it. The call is safe when no arguments are passed.

## Use the shipped flags

| Flag | Honored by | Sets |
|---|---|---|
| `port` (`Transport.PortArgument`) | Every transport | `Configuration.Port`, read as a `ushort` |
| `address` (`Synapse.AddressArgument`) | `Synapse` | `RemoteHost`, the address the client dials. The server always binds every local address. A value that is not an IP address leaves `RemoteHost` unchanged and logs an error. |

```csharp
transport.ApplyCommandLineArguments(new(["Server.exe", "-port", "7777", "-address", "10.0.0.5"]));
```

## Add your own flags

Override `OnApplyCommandLineArguments` and call the base first so `port` still applies:

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

## Argument formats the parser accepts

`CommandLineArguments` parses a `string[]` into flag and value pairs. `CommandLineArguments.Process` parses `Environment.GetCommandLineArgs()` once and keeps the result for the life of the process.

- `-flag value`, `--flag value`, `-flag=value` and `--flag=value` all work.
- Flags are case-insensitive: `-PORT` and `-port` are the same.
- A dash followed by anything other than a letter is a value, so `-5` is read as a negative number.
- Argument zero, the executable path, is ignored.
- A flag with no value after it is recorded with an empty value, as a switch.

```csharp
CommandLineArguments args = new(["Server.exe", "-port", "7777", "--address=10.0.0.5", "-headless", "-offset", "-5"]);
```

## Read values

`TryGetValue`, `TryGetUInt16` and `TryGetUInt32` return false rather than throw:

```csharp
if (commandLineArguments.TryGetUInt16("port", out ushort port))
    Configuration.Port = port;
```

- `TryGetValue` returns false for a flag never supplied or supplied with no value.
- `TryGetUInt16` and `TryGetUInt32` also return false when the value does not parse as that type.
- `Contains(flag)` reads a switch, where the flag's presence is the information:

```csharp
if (commandLineArguments.Contains("headless"))
{
    // run without a display
}
```
