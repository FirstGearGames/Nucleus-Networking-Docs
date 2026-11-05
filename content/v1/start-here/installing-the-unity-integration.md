---
title: "Install Nucleus in Unity"
---

> **Using plain .NET?** See [Add Nucleus to a .NET project](./adding-nucleus-to-a-dotnet-project.md).

Nucleus needs Unity 6.5 (6000.5) or newer.

## Import the package

1. In Unity, choose **Assets > Import Package > Custom Package**.
2. Select the Nucleus `.unitypackage` and click **Import**.

Everything is placed in `Assets/Nucleus`. When the import finishes, **Tools > Nucleus** appears in the menu bar.

## Check that the code generator runs

Nucleus generates your networking code when Unity compiles. If the generator does not run, your project still compiles, but nothing replicates and no error appears.

1. In the Project window, open `Assets/Nucleus` and select `Nucleus.CodeAnalysis.SourceGenerators`.
2. At the bottom of the Inspector, check that the asset has the `RoslynAnalyzer` label.

If the label is missing, add it in the Inspector.

## Update by importing the whole new package

When a new version comes out, import its `.unitypackage` over the old one. Never update only some of the DLLs in `Assets/Nucleus`, because DLLs from different versions fail at runtime.

To copy files by hand instead, or to see what each file is, read [Installing and updating Nucleus in Unity](../reference/installing-and-updating-in-unity.md).
