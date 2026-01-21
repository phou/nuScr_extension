# nuScr Editor

**nuScr Editor** provides language support and tooling for writing **nuScr protocol specifications** in Visual Studio Code.

It integrates validation, role analysis, protocol projections, and browser-based visualisation via **nuScr Live**.

## Requirements

To use this extension, the following requirements must be met:

- **Visual Studio Code v1.70.0 or later**

---

## Features

- Language support for `.nuscr` and `.scr` files
- Protocol syntax checking
- Parse nuScr specifications to JSON / Enum
- Enumerate protocol roles
- Project protocols to CFSMs per role
- Open the current protocol in **nuScr Live**
- Dedicated **nuScr Roles** explorer view
- Configurable `nuScr` binary and code generation options

---

## Language Support

The extension activates automatically for the following file types:

- `.nuscr`
- `.scr`

Language ID: `nuscr`

---

## Commands

The following commands are contributed by the extension and are available from the **Command Palette** (`Cmd + Shift + P` / `Ctrl + Shift + P`):

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




