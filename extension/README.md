# nuScr Editor

**nuScr Editor** is a Visual Studio Code extension for working with **nuScr protocol specifications**.

It integrates the `nuScr` command-line tool so you can:

- Check protocol validity
- Explore parsed representations (JSON)
- Generate CFSM projections
- Interact with **nuScr Live** directly from the editor

---

## Features

- ✅ **Check protocol validity**
  - Run `nuScr` checks from the Command Palette or via commands bound in your keybindings.
- 📄 **Enumerate roles / parse to JSON**
  - Inspect roles and protocol structure as JSON for downstream tooling.
- 🔁 **Generate CFSM projections per role**
  - Invoke `nuScr`’s projection commands per role from inside VS Code.
- 🌐 **Open protocol in nuScr Live**
  - Open the current protocol in **nuScr Live** in your browser.
- ⚙️ **Configurable nuScr binary path**
  - Point the extension at any `nuScr` binary (system-installed, custom build, or wrapper script).

All commands are available from the **Command Palette** (search for `nuScr`).

---

## Installation

### 1. Install the extension

- Open **Visual Studio Code**
- Go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`)
- Search for **“nuScr Editor”** (or install from a VSIX built from this repository)
- Click **Install**

> If you’re working from source, you can use `vsce package` / `npm run package` and install the generated `.vsix` via  
> **Extensions → … → Install from VSIX…**

### 2. Install `nuScr`

The extension is a thin client around the `nuScr` CLI. You need an actual `nuScr` binary somewhere on the system.

You have a few options:

- **Use a prebuilt binary** (recommended where available)
- **Install via `opam`**
- **Build from source** (see the nuScr repo)

See **Platform support** below for what is currently provided.

---

## Platform support

### macOS & Linux

On these platforms you can either:

- Use a **prebuilt `nuScr` binary** for your architecture (e.g. from the nuScr releases you maintain for:
  - macOS (Intel)
  - macOS (Apple Silicon / ARM)
  - Linux (x86_64))
- Or install `nuScr` via `opam`:

```bash
opam install nuscr
```

Then configure the extension (see **Configuration**).

### Windows

At the moment **no prebuilt native Windows `nuScr` binary is distributed**.

You have two practical options:

#### Option A — Recommended: use Linux `nuScr` from Windows via WSL2

On Windows you can run the **Linux** `nuScr` binary inside a Linux environment:

- **WSL2** (Windows Subsystem for Linux), or
- A Linux VM / container

Typical setup:

1. Install **WSL2** with a Linux distribution (e.g. Ubuntu).
2. Inside WSL2, install `nuScr` (e.g. `opam install nuscr` or from your Linux binary).
3. Run `nuScr` from a WSL terminal as needed.

If you run VS Code using **Remote – WSL**, the extension can use the Linux `nuScr` inside the WSL environment just like on a normal Linux system (you still configure `nuscrEditor.nuscrPath`, but it points to the Linux binary inside WSL).

#### Option B — Advanced: native `nuscr.exe` on Windows

It is currently **non-trivial** to build `nuScr` natively on Windows due to:

- OCaml toolchain specifics,
- `protoc` / protobuf dependencies,
- `pkg-config` behaviour on Windows.

If you do manage to build a working `nuscr.exe` locally, you can still use it:

1. Build `nuScr` on Windows (following the upstream docs / your own setup).
2. Configure:

```jsonc
{
  "nuscrEditor.nuscrPath": "C:\\path\\to\\your\\nuscr.exe"
}
```

Native Windows is considered **advanced / experimental** at this time.

---

## Configuration

Open **Settings** → search for “nuScr Editor”, or edit your settings JSON directly.

### `nuscrEditor.nuscrPath`

Path to the `nuScr` executable (or wrapper script). Examples:

**macOS / Linux:**

```jsonc
{
  "nuscrEditor.nuscrPath": "/usr/local/bin/nuscr"
}
```

**Windows (native binary):**

```jsonc
{
  "nuscrEditor.nuscrPath": "C:\\tools\\nuscr\\nuscr.exe"
}
```

**Windows using WSL wrapper (advanced):**

You can also point this to a small script that forwards to `wsl nuscr` or similar, if that fits your setup.

> The extension assumes that whatever you configure here behaves like the `nuScr` CLI (supports `--help`, exits with non-zero on error, etc.).

---

## Usage

1. Open a `.nuscr` file in VS Code.
2. Open the **Command Palette** and type `nuScr` to see available commands, e.g.:
   - `nuScr: Check protocol`
   - `nuScr: Enumerate roles`
   - `nuScr: Generate CFSM projections`
   - `nuScr: Open in nuScr Live`
3. Run the desired command.
4. Inspect results:
   - Diagnostics appear in the **Problems** panel and/or as inline squiggles.
   - Additional output goes to the **nuScr** output channel.

---

## Windows support (summary)

- ✅ **Works** when:
  - You run VS Code against a Linux environment (WSL2 / container) with `nuScr` installed, **or**
  - You have a working native `nuscr.exe` and point `nuscrEditor.nuscrPath` at it.
- ❌ **Not currently provided**:
  - An official, prebuilt `nuscr.exe` as part of this extension.

If you just want a reliable setup, we recommend:

> **Windows + WSL2 + Linux `nuScr`**  
> (or using this extension on macOS / Linux where prebuilt binaries are available).

---

## Known limitations

- There is **no official prebuilt Windows `nuScr` binary** at this time.
- Windows users must either:
  - Build `nuScr` locally and point the extension at it, **or**
  - Use the Linux binary via WSL2 / a Linux environment.
- This is primarily due to **upstream tooling constraints** (OCaml, protobuf, `pkg-config` on Windows), not a fundamental runtime limitation of `nuScr` itself.

---

## Troubleshooting

### “No prebuilt Windows binary is provided”

This is expected on Windows.

- Either:
  - Build `nuScr` locally and configure `nuscrEditor.nuscrPath`, **or**
  - Use WSL2 / Linux and run the extension there.

### “nuScr check failed”

- Ensure `nuscrEditor.nuscrPath` points to a valid executable.
- Run `nuscr --help` manually in a terminal to confirm it works and is on PATH.
- Check the **nuScr** output channel in VS Code for detailed error messages.

### Nothing happens / commands are missing

- Make sure the extension is enabled for your workspace.
- Confirm you are opening a file type that the extension activates on (e.g. your `.nuscr` files).
- Open the **Developer Tools** in VS Code and look for extension errors.

---

## Contributing

Issues, feature requests and pull requests are welcome:

- Use GitHub issues for bugs and suggestions.
- If you’d like to contribute a feature, please open an issue or discussion first so we can align on scope and UX.

---

## Links

- nuScr project: https://github.com/nuscr/nuscr  
- nuScr Live: https://nuscr.dev/nuscr/  
- nuScr Editor extension repo: https://github.com/phou/nuScr_extension  

