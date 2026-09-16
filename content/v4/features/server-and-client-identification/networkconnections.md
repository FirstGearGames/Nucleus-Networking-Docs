A look at how Fish-Networking distinguishes clients from one another.

## NetworkConnections

A `NetworkConnection` in FishNet is a core object that represents a single connected client within the networking system. As soon as a client connects to the server, a `NetworkConnection` is created to represent it, perform actions on it, and gather information about that specific client.

## Purposes

- **Client representation:** Each connected player/client has a corresponding `NetworkConnection` instance. This object tracks the client's identity, state, and the objects it owns.
- **Ownership and authority:** `NetworkConnection` tracks which networked objects (such as player avatars) the client owns, enabling authority checks and state management.
- **Authentication and state:** It manages authentication state, and notes if it's disconnecting.
- **Scene tracking:** It is used to track which networked scenes the client has loaded into.
- **Events:** It provides events for actions like gaining or losing ownership of objects and loading start scenes.
- **Custom data:** Developers can associate custom data with a connection for gameplay or server logic. (This data is not automatically synchronized across the network.)
- **Disconnection:** Provides methods to disconnect the client, either immediately or after sending pending data.

## Important Fields and Properties

**ClientId** — One important field is the `ClientId`. This is a unique ID for the `NetworkConnection` and it is used in a few other places in Fish-Networking. If a `ClientId` is not set, it defaults to `-1`, and generally `ClientId`s increment from `0` until the maximum integer value before reusing old ones from the beginning.

**FirstObject** — FishNet doesn't have a forced Player GameObject, but you can get the first object owned by a client with the `FirstObject` property. You can also set it with the `SetFirstObject` method, which can be useful if you have the object destroyed and re-instantiated.

**Objects** — This field is a `HashSet` of all the network objects owned by this connection. It is available to this connection and server.

**Scenes** — These are the networked scenes this connection is considered a part of.

**CustomData** — As mentioned above, this is a user-definable object for storing arbitrary data on the connection. It is not synced at all.

> **Tip:** Many more useful fields, properties, and methods are available and can be found in the API page.

## Where to Get Them and Where to Use Them

### How Is It Created/Used?

Each client has a `NetworkConnection` representing itself; this can be accessed with `ClientManager.Connection`, or `LocalConnection` from within a `NetworkBehaviour`.

The server maintains a dictionary of `NetworkConnection` instances for all connected clients; this is available at `ServerManager.Clients`. It is also available on clients under the `ClientManager.Clients`. You should use the `ServerManager` version if the instance is running as a server. The dictionary key is the Client ID and the value is the `NetworkConnection`.

`NetworkObject`s can have an owner, which is a `NetworkConnection` that has authority over the object. From the `NetworkObject` or `NetworkBehaviour` you can get the `NetworkConnection` with the `Owner` property.

When calling `TargetRpc`s you will need to provide a `NetworkConnection` as the first argument of the method; this represents which client you will send the RPC to.
