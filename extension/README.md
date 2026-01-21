# nuScr Editor

**nuScr Editor** is a Visual Studio Code extension for working with **nuScr protocol specifications**.  
It integrates the `nuScr` command-line tool to validate protocols, enumerate roles, generate projections, and interact with **nuScr Live** directly from the editor.

---

## Features

- ✅ **Check protocol validity**
- 📄 **Enumerate roles / parse to JSON**
- 🔁 **Generate CFSM projections per role**
- 🌐 **Open protocol in nuScr Live**
- ⚙️ **Configurable nuScr binary path**

All commands are available from the Command Palette.

---

## Requirements

To use this extension, the following requirements must be met:

- **Visual Studio Code v1.70.0 or later**

### Platform requirements

- **macOS / Linux**  
  A prebuilt `nuScr` binary is downloaded automatically on first use.

- **Windows**  
  A prebuilt Windows binary is **not currently provided**.  
  See **Windows Support** below for setup instructions.

---

## Windows Support (Important)

Prebuilt **nuScr** binaries are provided for **macOS** and **Linux** only.

Due to upstream **OCaml / protobuf tooling limitations**, a prebuilt **Windows** binary is **not currently distributed** with this extension.

### What Windows users need to do

To use **nuScr Editor** on Windows:

1. **Build nuScr locally on Windows**

   Follow the build instructions in the nuScr repository:

   https://github.com/nuscr/nuscr

2. **Configure the extension to use your local binary**

   Set the following VS Code setting to the path of your built executable:

   ```json
   {
     "nuscrEditor.nuscrPath": "C:\\path\\to\\nuscr.exe"
   }
   ```

Once configured, **nuScr Editor works correctly on Windows**.

> ⚠️ This limitation affects the **build process only**.  
> nuScr itself runs correctly on Windows once built.

---

## Language Support

The extension activates automatically for the following file types:

- `.nuscr`
- `.scr`

Language ID: `nuscr`

---

## Commands

The following commands are available from the  
**Command Palette** (`Cmd + Shift + P` / `Ctrl + Shift + P`):

- **nuScr Editor: Check protocol syntax**
- **nuScr Editor: Parse to JSON / Enum**
- **nuScr Editor: Enumerate roles**
- **nuScr Editor: Projection on CFSM per role**
- **nuScr Editor: Open in nuScr Live**
- **nuScr Editor: Configure nuScr binary**

---

## Usage

1. Open a `.nuscr` or `.scr` file
2. Edit your protocol specification
3. Use the Command Palette or context menu to:
   - Validate syntax
   - Enumerate roles
   - Generate projections
   - Open the protocol in nuScr Live

---

## Open in nuScr Live

When using **nuScr Editor: Open in nuScr Live**, the extension performs the following steps:

1. Copies the current protocol to the system clipboard
2. Opens the **nuScr Live** webpage in your browser

### Manual Paste Required

Due to browser security restrictions, the protocol **cannot be pasted automatically**.

### What to do

- After the browser opens, press:
  - **Cmd + V** on macOS
  - **Ctrl + V** on Windows / Linux

This behavior is expected and required by modern browser security policies.

---

## Configuration

The extension provides the following settings:

```json
{
  "nuscrEditor.nuscrPath": "nuscr",
  "nuscrEditor.checkOnSave": true,
  "nuscrEditor.codegenLanguages": ["java"],
  "nuscrEditor.genOutput": ".nuscr-gen"
}
```

### `nuscrEditor.nuscrPath`

Optional override for the `nuScr` binary location.

- **Required on Windows**
- Optional on macOS / Linux

Example:

```json
{
  "nuscrEditor.nuscrPath": "/usr/local/bin/nuscr"
}
```

or on Windows:

```json
{
  "nuscrEditor.nuscrPath": "C:\\tools\\nuscr.exe"
}
```

---

## Known Limitations

- Native Windows binaries are not distributed.
- Windows users must build `nuScr` locally.
- This is due to upstream tooling constraints, not a runtime limitation.

---

## Troubleshooting

### “No prebuilt Windows binary is provided”

This message is expected on Windows.

Please build `nuScr` locally and set `nuscrEditor.nuscrPath` as described above.

---

### “nuScr check failed”

- Ensure `nuscrEditor.nuscrPath` points to a valid executable
- Run `nuscr --help` manually to confirm it works
- Check the **nuScr** output channel for details

---

## Links

- nuScr project: https://github.com/nuscr/nuscr  
- nuScr Live: https://nuscr.dev/nuscr/  
- Issues & feedback: https://github.com/phou/nuScr_extension/issues  
