/*************************
 * Imports
 *************************/
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

/*************************
 * Constants
 *************************/
const NUSCR_VERSION = '2.1.1';
const RELEASE_TAG = 'v1.2.7';
const OWNER = 'phou';
const REPO = 'nuScr_extension';

/*************************
 * Helpers
 *************************/
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureExecutable(file) {
  if (process.platform !== 'win32') {
    fs.chmodSync(file, 0o755);
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = u => {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    request(url);
  });
}

function unzip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    cp.execFile(
      'unzip',
      ['-o', zipPath, '-d', destDir],
      err => (err ? reject(err) : resolve())
    );
  });
}

/*************************
 * Platform logic
 *************************/
function platformId() {
  const p = os.platform();
  const a = os.arch();

  if (p === 'darwin' && a === 'arm64') return 'macos-arm64';
  if (p === 'darwin' && a === 'x64') return 'macos-x64';
  if (p === 'linux' && a === 'x64') return 'linux-x64';

  throw new Error(`Unsupported platform: ${p} ${a}`);
}

function isZippedPlatform() {
  return os.platform() === 'darwin' && os.arch() === 'x64';
}

function nuscrAssetName() {
  const base = `nuscr-${NUSCR_VERSION}-${platformId()}`;
  return isZippedPlatform() ? `${base}.zip` : base;
}

function nuscrDownloadUrl() {
  return `https://github.com/${OWNER}/${REPO}/releases/download/${RELEASE_TAG}/${nuscrAssetName()}`;
}

/*************************
 * Cache paths
 *************************/
function cachedNuscrDir(context) {
  return path.join(
    context.globalStorageUri.fsPath,
    'nuscr',
    NUSCR_VERSION,
    platformId()
  );
}

function cachedNuscrPath(context) {
  return path.join(cachedNuscrDir(context), 'nuscr');
}

/*************************
 * Resolve nuScr binary
 *************************/
async function getNuscrPath(context, output) {
  const cfg = vscode.workspace.getConfiguration('nuscrEditor');
  const userPath = cfg.get('nuscrPath');

  // User override always wins
  if (userPath && fs.existsSync(userPath)) return userPath;

  // Windows: manual build required
  if (process.platform === 'win32') {
    const choice = await vscode.window.showErrorMessage(
      'nuScr: No prebuilt Windows binary is provided.\n\n' +
      'Please build nuScr locally on Windows (see README) and set "nuscrEditor.nuscrPath".',
      'Open Settings'
    );
    if (choice === 'Open Settings') {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'nuscrEditor.nuscrPath'
      );
    }
    throw new Error('nuScr not configured on Windows');
  }

  const dir = cachedNuscrDir(context);
  const exe = cachedNuscrPath(context);

  if (fs.existsSync(exe)) return exe;

  ensureDir(dir);
  output.show(true);
  output.appendLine(`Downloading nuScr ${NUSCR_VERSION}...`);

  const assetPath = path.join(dir, nuscrAssetName());
  await downloadFile(nuscrDownloadUrl(), assetPath);

  if (isZippedPlatform()) {
    await unzip(assetPath, dir);
    fs.unlinkSync(assetPath);
  }

  await ensureExecutable(exe);
  output.appendLine('nuScr ready');

  return exe;
}

/*************************
 * Run CLI
 *************************/
function runCli(cmd, args) {
  return new Promise(resolve => {
    cp.execFile(cmd, args, { maxBuffer: 50_000_000 }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
}

/*************************
 * Activate
 *************************/
function activate(context) {
  const output = vscode.window.createOutputChannel('nuScr');
  context.subscriptions.push(output);

  async function nuscr() {
    return await getNuscrPath(context, output);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.checkCurrent', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;
      await ed.document.save();

      const bin = await nuscr();
      output.clear();
      output.show(true);

      const res = await runCli(bin, [ed.document.uri.fsPath]);
      if (!res.success) {
        output.appendLine(res.stderr);
        vscode.window.showErrorMessage('nuScr check failed');
      } else {
        output.appendLine('✓ Protocol is valid');
        vscode.window.showInformationMessage('nuScr: protocol is valid');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.parseJson', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;

      const bin = await nuscr();
      output.clear();
      output.show(true);

      const res = await runCli(bin, ['--enum', ed.document.uri.fsPath]);
      output.appendLine(res.stdout || res.stderr);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.configureNuScr', async () => {
      const cfg = vscode.workspace.getConfiguration('nuscrEditor');
      const current = cfg.get('nuscrPath') || '';
      const value = await vscode.window.showInputBox({
        prompt: 'Path to nuScr binary',
        value: current
      });
      if (value !== undefined) {
        await cfg.update('nuscrPath', value.trim(), vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage('nuScr path updated');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.openInNuScrLive', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;
      await vscode.env.clipboard.writeText(ed.document.getText());
      await vscode.env.openExternal(vscode.Uri.parse('https://nuscr.dev/nuscr/'));
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
