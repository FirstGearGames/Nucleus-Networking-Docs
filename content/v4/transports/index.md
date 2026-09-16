---
title: "Transports"
---


The **Transport** is the low-level layer responsible for sending and receiving raw data over the network. It abstracts away the details of TCP/UDP sockets and handles packet delivery, reliability, ordering, etc. FishNet uses events internally to plug into transport messages. Although it be unlikely you would need to access such messages, they are available to you for your development as well.

There are many transports available, some are maintained by the Fish-Networking team and others maintained by the community.

{% hint style="success" %}
[Tugboat](tugboat.md) is the default transport and will be added to your project at runtime. If you wish to use a different transport or customize **Tugboat** you must add the component to your [NetworkManager](../components/managers/network-manager.md) object.
{% endhint %}

## Switching transports at run-time or using multiple transports

FishNet has support for changing transports on your NetworkManager while the network is not running as well as allowing servers to utilize multiple transports at once. For example you may want to use FishyEOS or Unity Transport to support your console users, but also use Tugboat to give a better experience to your Non-Console users.

FishNet uses the Multipass transport to achieve both of these goals.

{% hint style="info" %}
Even with **Multipass**, clients can only ever utilize one active **transport**. More info can be found on the [Component](multipass.md) and [Guide](../../guides/features/transports/multipass.md) pages.
{% endhint %}
