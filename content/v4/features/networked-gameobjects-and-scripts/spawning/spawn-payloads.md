`NetworkBehaviour`s have support for writing and reading extra data and sending it along with the spawn payloads for the network object. This can be quite useful for syncing an initial state of the object.

To use this, you need to override the `NetworkBehaviour`'s `WritePayload` and `ReadPayload` methods.

> **Important:** When writing and reading, the order and amount of data written and read is important and MUST be the same.

## Write Payload

The first parameter of the `WritePayload` method needs to be a `NetworkConnection`; this represents which client the spawn is going to happen for and is provided by FishNet when it calls the method.

The second parameter should be of the type `Writer`; this will represent a reference to the `Writer` being used and you will use it to add data to the payload.

```csharp
public override void WritePayload(NetworkConnection connection, Writer writer)
{
    // Writes the string stored in the class variable _playerName to the spawn payload.
    writer.WriteString(_playerName);

    // Writes the integer 42 to the payload.
    writer.WriteInt32(42);
}
```

## Read Payload

The first parameter of the `ReadPayload` method needs to be a `NetworkConnection`; this represents which client the spawn is happening for and is provided by FishNet when it calls the method.

The second parameter should be of the type `Reader`; this will represent a reference to the `Reader` being used and you will use it to get data out of the payload.

```csharp
public override void ReadPayload(NetworkConnection connection, Reader reader)
{
    // Reads a string from the payload. Since a string was written first, it must be read first too.
    _playerName = reader.ReadStringAllocated();

    // Reads an integer from the payload.
    _playerScore = reader.ReadInt32();
}
```

## More Advanced Example

```csharp
// SpawnPayloadExample.cs
public class SpawnPayloadExample : NetworkBehaviour
{
    private ArraySegment<byte> _cachedPayload = ArraySegment<byte>.Empty;

    public override void WritePayload(NetworkConnection connection, Writer writer)
    {
        /* If you are using predicted spawning and want to write the
         * payload if you are the spawning client, this might help! */
        bool isPredictedSpawner = NetworkObject.PredictedSpawner.IsLocalClient;

        /* It is worth noting that the server will still call WritePayload when
         * spawning the object for clients, even if a predicted spawn.
         * Should a client send a predicted spawn the server will receive ReadPayload
         * for the predicted spawn, and the server will also be given an opportunity to
         * send a payload to other clients which are not the predicted spawner. If you wish to
         * forward a payload from a predicted spawner cache the values locally, and
         * send them here. */
        if (isPredictedSpawner)
        {
            // As the predicted spawner let's write our own payload!
        }
        // If not the predicted spawner, we are the server sending a payload to other clients.
        else
        {
            // Write our cached payload, or don't, send whatever you want!
            // Check if not empty first.
            if (_cachedPayload != ArraySegment<byte>.Empty)
                writer.WriteArraySegmentAndSize(_cachedPayload);
        }
    }

    public override void ReadPayload(NetworkConnection connection, Reader reader)
    {
        /* You can also check if the payload is coming from the predicted spawner.
         *
         * ReadPayload would be first called on the server, and if the connection IsValid, we know
         * that the connection is a predicted spawner, as that is the only time connection would be
         * valid on the server. */
        bool isFromPredictedSpawner = IsServerStarted && connection.IsValid;

        /* Another way using a similar workflow to WritePayload. */
        bool isFromPredictedSpawner2 = IsServerStarted && connection == NetworkObject.PredictedSpawner;

        /* When the connection is not valid, as noted in the parameter comments, this means
         * the server is the sender. */
        bool isFromServer = !connection.IsValid;

        /* If you're the server and wish to cache a payload received from a predicted spawner,
         * this is the place to do it. We are caching into an ArraySegment named _cachedPayload --
         * see WritePayload on how to forward this to other clients. */
        if (isFromPredictedSpawner)
        {
            int readerStart = reader.Position;
            // Do all your reads as you would.
            int readAmount = reader.Position - readerStart;

            // Let's use a pooled array so we don't allocate.
            byte[] payload = ArrayPool<byte>.Shared.Rent(readAmount);

            /* Copy into payload array from where the reader started, up to
             * the calculated readAmount. */
            Array.Copy(reader.GetBuffer(), sourceIndex: readerStart, payload, destinationIndex: 0, readAmount);
            _cachedPayload = new(payload, 0, readAmount);

            // /* You will probably want to return the rented array when OnStop callbacks occur. */
            // if (_cachedPayload != ArraySegment<byte>.Empty)
            //     ArrayPool<byte>.Shared.Return(_cachedPayload.Array);
        }
    }
}
```
