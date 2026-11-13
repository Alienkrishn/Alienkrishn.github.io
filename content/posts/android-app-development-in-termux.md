+++
date = '2026-11-13T08:00:00Z'
title = '📱 Build Android Apps Natively in Termux: apkgen-cli, Gradle & Flutter'
categories = ['Termux']
tags = ['termux', 'android', 'apkgen', 'flutter', 'development']
+++

You do not need a PC, Android Studio or a cloud build service to make an Android APK anymore. With **TermuxVoid**, you can install the Android SDK, NDK and CMake directly on your phone, scaffold a project with **apkgen-cli**, and build both **debug and release APKs** natively in Termux.

This guide is for beginners. It covers Java, Kotlin, Native C/C++ and Flutter projects, plus how to sign a release APK and install it on your device.

## What you need

- Termux installed from [F-Droid](https://f-droid.org/en/packages/com.termux/) or [GitHub](https://github.com/termux/termux-app/releases) — **not** the Play Store build
- Android 7 or newer
- A few GB of free storage for the SDK, NDK and build caches
- Internet for the first install and for downloading Gradle dependencies
- `aarch64` or `x86_64` device (the Flutter package ships builds for these)

## Step 1: Add the TermuxVoid repository

Use the setup that matches your Termux:

**APT (dpkg):**

```bash
curl -fsSL https://github.com/termuxvoid/repo/raw/main/install.sh | bash
```

**Pacman:**

```bash
curl -fsSL https://github.com/termuxvoid/pacman-repo/raw/main/install-repo.sh | bash
```

Then refresh the package lists:

```bash
pkg update
```

> Piping a script to `bash` runs it immediately. If you prefer, download and read the installer first.

## Step 2: Install the Android toolchain

```bash
pkg install android-sdk android-ndk android-cmake apkgen-cli
```

Here is what each package does:

| Package | Version | Installed path | Purpose |
| --- | --- | --- | --- |
| `android-sdk` | 37.0.0 | `$PREFIX/opt/android-sdk` | SDK, platform tools, build tools, `aapt2` |
| `android-ndk` | 30.0.16248370 | `$PREFIX/opt/android-ndk` | Compiles native C/C++ code |
| `android-cmake` | 4.1.2 | `$PREFIX/opt/android-cmake/4.1.2` | Build system for native code |
| `apkgen-cli` | latest | `$PREFIX/bin/apkgen` | Project scaffolding and build helper |

`$PREFIX` is normally `/data/data/com.termux/files/usr`.

**No environment variables are required.** The apkgen templates already point Gradle at the TermuxVoid SDK, NDK and CMake paths.

## Step 3: Meet apkgen-cli

apkgen-cli removes the repetitive Android setup. It can create a project and build it without you editing Gradle files by hand.

Open the interactive menu:

```bash
apkgen
```

Or use commands directly:

| Command | What it does |
| --- | --- |
| `apkgen create myapp` | Java project (default) |
| `apkgen create myapp --kotlin` | Kotlin project |
| `apkgen create myapp --nativec` | Native C project |
| `apkgen create myapp --nativecpp` | Native C++ project |
| `apkgen create myapp --flutter` | Flutter project |
| `apkgen build debug` | Build a debug APK |
| `apkgen build release` | Build a release APK |
| `apkgen build flutter` | Flutter debug build (legacy alias) |
| `apkgen build flutter release` | Flutter release build |
| `apkgen clean` | Remove build artifacts |
| `apkgen version` | Show the installed version |

`apkgen build debug` and `apkgen build release` auto-detect the project type. Flutter projects get Flutter commands, everything else goes through Gradle.

> **Tip:** Run `apkgen help` at any time to see the full command list.

## Step 4: Build your first APK (Java)

Create a project:

```bash
apkgen create myapp
```

You will be asked for the app name and package name (for example `com.example.myapp`). Then enter the directory and build:

```bash
cd myapp
apkgen build debug
```

The debug APK is written to:

```
app/build/outputs/apk/debug/app-debug.apk
```

That file is already signed with the debug key, so it can be installed on a device right away.

### Build a release APK

```bash
apkgen build release
```

Output:

```
app/build/outputs/apk/release/app-release-unsigned.apk
```

Gradle projects produce an **unsigned** release APK. You must sign it before installing or sharing it. The next step shows how.

### Kotlin, C and C++

The workflow is identical, only the template changes:

```bash
apkgen create mykotlin --kotlin
apkgen create mynativec --nativec
apkgen create mynativecpp --nativecpp
```

Build any of them with `apkgen build debug` or `apkgen build release`. Native projects automatically use the installed NDK and CMake.

## Step 5: Sign a release APK

Create a signing key once, then reuse it for every future release. **Back it up** — losing it means you cannot update your app with the same identity.

```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias mykey
```

If `keytool` is missing, install a JDK:

```bash
pkg install openjdk-17
```

Align and sign the APK:

```bash
cd myapp

$PREFIX/opt/android-sdk/build-tools/37.0.0/zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app-release-aligned.apk

$PREFIX/opt/android-sdk/build-tools/37.0.0/apksigner sign \
  --ks my-release-key.jks --out app-release-signed.apk \
  app-release-aligned.apk
```

Verify the signature:

```bash
$PREFIX/opt/android-sdk/build-tools/37.0.0/apksigner verify \
  --print-certs app-release-signed.apk
```

If the installed build-tools version differs, adjust the `37.0.0` in the paths:

```bash
ls "$PREFIX/opt/android-sdk/build-tools"
```

## Step 6: Flutter on Termux (patched, debug and release)

TermuxVoid ships a **custom patched Flutter SDK** built from upstream Flutter source with Termux compatibility patches for Dart, Skia and the engine. The current package is based on **Flutter 3.50.0** and includes release AOT snapshotters for `arm`, `arm64` and `x64`.

That means both **debug and release Android builds work on-device**. Profile mode is not packaged.

### Install Flutter

```bash
pkg install x11-repo
pkg install flutter
```

Verify it:

```bash
flutter --version
```

### Point Flutter at the Android SDK

```bash
flutter config --android-sdk "$PREFIX/opt/android-sdk"
flutter doctor -v
```

This is a one-time setting. Do **not** set `ANDROID_HOME`, `ANDROID_SDK_ROOT` or `ANDROID_NDK_HOME` — the TermuxVoid packages and project files handle the paths.

### Create a Flutter project

The easiest route is the apkgen Flutter template, because it already contains the required Termux-specific `local.properties`, `gradle.properties` and `app/build.gradle.kts` values:

```bash
apkgen create myflutter --flutter
cd myflutter
```

Check that Flutter sees the SDK:

```bash
flutter doctor -v
```

### Build debug and release

Debug, split per ABI:

```bash
apkgen build flutter
# or: flutter build apk --debug --split-per-abi
```

Release:

```bash
apkgen build flutter release
# or: flutter build apk --release
```

Outputs:

```
build/app/outputs/flutter-apk/
├── app-<abi>-debug.apk    # debug, one per ABI
└── app-release.apk        # release, universal
```

> **Warning:** Flutter release APKs from the default template are signed with the **debug key**. That is fine for testing and sideloading, but configure your own signing key before publishing or distributing the app.

### Flutter project versions

Flutter 3.50.0 generates projects using:

- Android Gradle Plugin `9.3.1`
- Kotlin `2.4.20`
- Gradle `9.5.0`

The apkgen Flutter template currently pins Android Gradle Plugin `9.1.0`, Kotlin `2.4.0` and Gradle `9.3.1`. Both combinations work. If you port an older project, align it with one of these sets.

### Using `flutter create` instead

You can still use the normal Flutter command:

```bash
flutter create myapp
cd myapp
```

Then add the Termux paths and overrides yourself. The required edits are:

`android/local.properties` — absolute paths, no shell variables:

```properties
sdk.dir=/data/data/com.termux/files/usr/opt/android-sdk
flutter.sdk=/data/data/com.termux/files/usr/opt/flutter
cmake.dir=/data/data/com.termux/files/usr/opt/android-cmake/4.1.2
ndk.dir=/data/data/com.termux/files/usr/opt/android-ndk
```

`android/gradle.properties` — use the TermuxVoid `aapt2`:

```properties
android.aapt2FromMavenOverride=/data/data/com.termux/files/usr/opt/android-sdk/build-tools/37.0.0/aapt2
```

`android/app/build.gradle.kts` — match the installed build tools and NDK:

```kotlin
android {
    compileSdk = flutter.compileSdkVersion
    buildToolsVersion = "37.0.0"
    ndkVersion = "30.0.16248370"
    // ...
}
```

Full details: [Building Android apps on Termux](https://github.com/termuxvoid/flutter-termux/blob/main/BUILDING_APPS.md).

## Step 7: Install the APK on your device

The Android SDK includes `adb` under `platform-tools`. Connect a device with USB debugging (or Android 11+ wireless debugging), then:

```bash
$PREFIX/opt/android-sdk/platform-tools/adb devices
$PREFIX/opt/android-sdk/platform-tools/adb install app-debug.apk
```

Use `-r` to replace an existing installation:

```bash
$PREFIX/opt/android-sdk/platform-tools/adb install -r app-release-signed.apk
```

No second device? Copy the APK to your Downloads folder, tap it in a file manager, and allow "Install unknown apps" for that file manager.

## Troubleshooting

### `apkgen: command not found`

The TermuxVoid repository is not configured or `apkgen-cli` is not installed:

```bash
pkg update
pkg install apkgen-cli
```

### `aapt2` not found or fails to run

Check the path in `android/gradle.properties` against the installed build-tools:

```bash
ls -l "$PREFIX/opt/android-sdk/build-tools/37.0.0/aapt2"
```

Update the path if the version number changed.

### NDK version mismatch

Gradle must find the exact NDK version named in `android/app/build.gradle.kts`:

```bash
grep Pkg.Revision "$PREFIX/opt/android-ndk/source.properties"
```

Make both `ndk.dir` and `ndkVersion` match that value.

### CMake not found

```bash
ls "$PREFIX/opt/android-cmake/4.1.2/bin/cmake"
```

Update `cmake.dir` if the installed version differs.

### Gradle cannot find the Android SDK

```bash
flutter config --list | grep android-sdk
cat android/local.properties
```

Both paths must exist and point at the same SDK directory.

### Flutter command not found or package missing

Re-add the TermuxVoid repository, run `pkg update`, then `pkg install flutter` again. Open a new shell if `$PATH` was cached.

### Build killed or running out of memory

The templates set a large Gradle heap (`-Xmx8G`). On a low-RAM phone, lower it in `android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx2G -XX:MaxMetaspaceSize=1G
```

### Flutter license errors in `flutter doctor`

Accept the Android licenses once:

```bash
flutter doctor --android-licenses
```

## Quick command cheat sheet

```bash
# Setup
pkg install android-sdk android-ndk android-cmake apkgen-cli
pkg install x11-repo flutter
flutter config --android-sdk "$PREFIX/opt/android-sdk"

# Java / Kotlin / C / C++
apkgen create myapp --kotlin
cd myapp
apkgen build debug
apkgen build release

# Flutter
apkgen create myflutter --flutter
cd myflutter
apkgen build flutter          # debug
apkgen build flutter release  # release

# Clean
apkgen clean
```

## Links

- [apkgen-cli](https://github.com/termuxvoid/apkgen-cli)
- [Flutter for Termux](https://github.com/termuxvoid/flutter-termux)
- [Building Android apps on Termux](https://github.com/termuxvoid/flutter-termux/blob/main/BUILDING_APPS.md)
- [TermuxVoid repository](https://github.com/termuxvoid/repo)
- [Pacman repository](https://github.com/termuxvoid/pacman-repo)
- [TermuxVoid website](https://termuxvoid.github.io)
- [Telegram](https://t.me/termuxvoid)

Building APKs on a phone is slower than on a PC, but for learning, testing and small projects it works. Start with a debug build, then sign a release when you are ready to share your app.
