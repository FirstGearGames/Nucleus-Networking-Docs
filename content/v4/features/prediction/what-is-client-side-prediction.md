---
title: "What Is Client-Side Prediction"
---
Client-Side Prediction allows clients to perform actions in real-time while maintaining server authority.

Client-side prediction is a technique used to move in real-time on clients, providing responsive actions, while also ensuring such actions cannot be cheated. From here on, we will refer to client-side prediction as CSP.

During your development you may also hear the term "server authoritative movement". CSP is a form of server authoritative movement, but they are not the same.

As mentioned, CSP allows the client to move in real-time while also ensuring they cannot cheat. Some server authoritative movement approaches will ensure the client cannot cheat but do so by moving on the server only and relaying the results to clients. While both work, the latter of moving on the server and then relaying will result in the client having a delay based on their latency.

Having such a delay would be unfair to those with higher latency and could ruin the experience for players if your game is expected to have responsive movement. This is why having CSP built into Fish-Networking is so great!
