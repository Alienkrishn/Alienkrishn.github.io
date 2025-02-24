+++
date = '2025-02-24T07:33:37Z'
title = 'QEMU in Termux: A Complete Guide with Examples 🚀'
image = 'post8.jpg'
+++


## Introduction

QEMU (Quick EMUlator) is a powerful open-source emulator that allows you to run different operating systems on various hardware architectures. Its versatility makes it a great tool for developers, testers, and enthusiasts. In this blog post, we'll explore how to set up and use QEMU in Termux, a terminal emulator and Linux environment for Android devices. 📱

## What is Termux? 🤔

Termux is an Android application that provides a powerful terminal emulation environment. It allows you to use a Linux command-line interface without the need for rooting your device. Termux supports a wide range of packages, making it an excellent platform for development, scripting, and running various tools.

## Installing QEMU in Termux 🛠️

To get started with QEMU in Termux, follow these steps:

### Step 1: Install Termux

First, download and install Termux from the Google Play Store or F-Droid. 📥

### Step 2: Update Packages

Open Termux and update the package repository:

```bash
pkg update && pkg upgrade
```

### Step 3: Install Required Packages

Next, install the necessary packages to run QEMU:

```bash
pkg install qemu-utils qemu-system-x86_64
```

## Setting Up a Virtual Machine 🖥️

Once QEMU is installed, you can create and run a virtual machine (VM). Here’s how to set it up step by step.

### Step 4: Create a Disk Image 💾

You need a disk image to install an operating system. Create a disk image with the following command:

```bash
qemu-img create -f qcow2 disk.img 10G
```

This command creates a 10GB disk image named `disk.img`.

### Step 5: Download an ISO File 🌐

For this example, we will download a minimal Linux distribution, such as Alpine Linux. You can use `wget` to download it:

```bash
wget https://dl-cdn.alpinelinux.org/alpine/v3.15/releases/x86/alpine-standard-3.15.0-x86.iso
```

### Step 6: Boot the Virtual Machine 🚀

Now you can boot the virtual machine using the ISO file and the disk image you created:

```bash
qemu-system-x86_64 -hda disk.img -boot d -cdrom alpine-standard-3.15.0-x86.iso -m 512 -smp 2
```

In this command:
- `-hda disk.img` specifies the hard drive image.
- `-boot d` tells QEMU to boot from the CD-ROM (the ISO).
- `-cdrom alpine-standard-3.15.0-x86.iso` specifies the installation ISO.
- `-m 512` allocates 512MB of RAM to the VM.
- `-smp 2` assigns 2 CPU cores to the VM.

### Step 7: Install the Operating System 🛠️

Once the VM boots up, follow the on-screen instructions to install Alpine Linux on the `disk.img`. After installation, you can shut down the VM.

### Step 8: Boot from the Disk Image 🔄

After installation, you can boot the VM from the disk image:

```bash
qemu-system-x86_64 -hda disk.img -m 512 -smp 2
```

## Additional QEMU Commands in Termux 📋

Here are some additional commands you might find useful when working with QEMU in Termux:

- **View Disk Image Information**:
  ```bash
  qemu-img info disk.img
  ```

- **Convert Disk Image Format**:
  ```bash
  qemu-img convert -O vmdk disk.img disk.vmdk
  ```

- **Take a Snapshot**:
  ```bash
  qemu-img snapshot -c snapshot_name disk.img
  ```

- **List Snapshots**:
  ```bash
  qemu-img snapshot -l disk.img
  ```

## Conclusion 🎉

Using QEMU in Termux opens up a world of possibilities for emulation and testing on your Android device. Whether you want to run a lightweight Linux distribution or test applications in different environments, QEMU provides a flexible solution.

Feel free to explore more about QEMU and experiment with different operating systems. If you have any questions or experiences to share, please leave a comment below! 💬

---

Thank you for reading! Happy emulating! 🎈
