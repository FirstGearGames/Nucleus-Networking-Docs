---
title: "Server, Client, Host"
---

## Ownership and Controller

Ownership is when a specific client owns the object, while controller is whichever entity controls the object. By our terms, only a client can own an object, but either the server or a client may be the controller.

When a client owns an object they are the "controller" and are able to send remote procedure calls without disabling authority checks, among other tasks such as generating prediction data.

A controller is the server if the object is not owned by any client, but again, the client becomes the controller when they own the object.

## Server

Server is an instance of your project which clients connect to. A server allows clients to interact with each other and will often be responsible for important aspects of your game such as score keeping, world spawning, and more.

## Local Server

When a server is started the build or instance running the server is referred to as the local server.

## Remote Client

A remote client is a term only applicable when running as the server. A remote client is a player connection established with the server. It's possible for a remote client to be the same as a local client. The main difference is the local client refers to the player-side logic while a remote client refers to the server's connection with the client.

## Client

A client connects to the server, whether the server be local or online. A client is the player for your game. A client experiences the gameplay while the server synchronizes data between clients.

## Local Client

Local client refers to the client controlling their game. If you join the server as a player, you are the local client.

## Remote Server

When the local client connects to a server, they are connecting to a remote server. It's possible the remote server is also the local server if the client is running as host.

## Host

When behaving as a host you are both the client and the server. An individual can become host without having to compile additional executables, nor having to provide any special access to their computer. Host is ideal for speedy development.
