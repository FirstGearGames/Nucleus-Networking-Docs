---
title: "Getting Started with AWS"
cover: "https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/aws-cover.png"
---
A community-made guide for using AWS to host a FishNet server.

> This tutorial was kindly provided by haseebzahid413#2226.

## Verify Permissions for AWS Account

1. Go to AWS Management Console and launch a Virtual Machine.
2. Select any free-tier Linux machine and any free-tier instance type.
3. Edit Security Groups and add two rules:
   - **Custom TCP Rule** — port 7770 (or your chosen port), Source set to Anywhere
   - **UDP Rule** — port 7770 (or your chosen port), Source set to Anywhere
4. Press **Review and Launch**.
5. Create a new Key Pair, give it a name, download the keypair, then press **Launch Instance**.

## Setting Up Putty and WinSCP

1. Download Putty and WinSCP.
2. Open PuttyGen: go to **Conversions > Import Key**, select the downloaded key, set the correct Key Type, and press **Save Private Key**. This produces a `.ppk` file used in the steps below.
3. Open Putty. Copy the IPv4 DNS address for your EC2 instance from the AWS console.
4. In Putty: go to **Configuration > Session > Host Name** and enter `ec2-user@<your-dns-address>`. Keep port 22 and Connection Type SSH.
5. Go to **Connection > SSH > Auth** and browse for the `.ppk` file generated above.
6. Go back to Session, give it a name, press **Save**, then double-click the session name to open a terminal on the Linux machine.
7. Open WinSCP. When prompted, choose the single window with two panels option.
8. In **Login > New Site**: set File Protocol to SCP, paste the same hostname, set Username to `ec2-user`, then under **Advanced > SSH > Authentication** provide the private key file.
9. Press **Ok**, then **Save** with a name, and double-click the login to connect to the Linux server. This window is used to transfer, replace, or delete builds on the server.

## Configuring Fish-Networking

1. Add the **TugBoat** component on the Network Manager.
2. Set the IPv4 server bind address to `127.0.0.1` (or leave empty).
3. Set the port to `7770` (or your chosen port — must match the EC2 security group rule).
4. Set the client address to the EC2 instance's public IPv4 DNS address.
5. Save the scene.

## Building for Linux

1. In Build Settings, set the target platform to **Linux**, architecture **x86_64**, and enable **Server Build** (headless).
2. Ensure the server scene is added and enabled in Build Settings.
3. Build and save to a folder. Wait for the build to complete.

## Deploying

1. In WinSCP, navigate the left panel to your Unity server build folder.
2. Right-click and upload the build to the Linux server. This may take a moment.
3. Once the upload is complete, go to the Putty terminal and navigate into the build folder.
4. Run the following commands:

```bash
chmod +x "YourExecutable.x86_64"
./"YourExecutable.x86_64"
```

The server is now up and running.

## Connecting a Client

1. Open your Unity project.
2. Press **Client** — it should connect to the server successfully.
