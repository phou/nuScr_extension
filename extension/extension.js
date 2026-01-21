/*************************
 * Helpers
 *************************/
function sanitizeAt(s){ return (''+(s||'')).replace(/@/g,''); }

function buildSel(role, proto){
  const rstr = '' + (role || '');
  if (rstr.includes('@')) {
    const parts = rstr.split('@').filter(Boolean);
    return sanitizeAt(parts[0]) + '@' + sanitizeAt(parts[1] || proto);
  }
  return sanitizeAt(role) + '@' + sanitizeAt(proto);
}

const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

/*************************
 * nuScr binary download
 *************************/
const NUSCR_VERSION = '2.1.1';
const RELEASE_TAG = 'v1.2.7';
const OWNER = 'phou';
const REPO = 'nuScr_extension';

function platformId() {
  const p = os.platform();
  const a = os.arch();
  if (p === 'darwin' && a === 'arm64') return 'macos-arm64';
  if (p === 'darwin' && a === 'x64') return 'macos-x64';
  if (p === 'linux') return 'linux-x64';
  if (p === 'win32') return 'windows-x64.exe';
  throw new Error(`Unsupported platform: ${p} ${a}`);
}

function nuscrAssetName() {
  return `nuscr-${NUSCR_VERSION}-${platformId()}`;
}

function nuscrDownloadUrl() {
  return `https://github.com/${OWNER}/${REPO}/releases/download/${RELEASE_TAG}/${nuscrAssetName()}`;
}

function cachedNuscrPath(context) {
  return path.join(
    context.globalStorageUri.fsPath,
    'nuscr',
    NUSCR_VERSION,
    platformId().endsWith('.exe') ? 'nuscr.exe' : 'nuscr'
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const doRequest = (u) => {
      https.get(u, res => {
        // Handle redirects (GitHub uses 302)
        if (res.statusCode === 301 || res.statusCode === 302) {
          const next = res.headers.location;
          if (!next) {
            reject(new Error(`Redirect with no location header`));
            return;
          }
          doRequest(next);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };

    doRequest(url);
  });
}


async function ensureExecutable(file) {
  if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
}

async function getNuscrPath(context, output) {
  const cfg = vscode.workspace.getConfiguration('nuscrEditor');
  const userPath = cfg.get('nuscrPath');
  if (userPath && fs.existsSync(userPath)) return userPath;

  const target = cachedNuscrPath(context);
  if (fs.existsSync(target)) return target;

  ensureDir(path.dirname(target));
  output.show(true);
  output.appendLine(`Downloading nuScr ${NUSCR_VERSION}...`);

  await downloadFile(nuscrDownloadUrl(), target);
  await ensureExecutable(target);

  output.appendLine(`nuScr ${NUSCR_VERSION} ready`);
  return target;
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
        err
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

  /******** checkCurrent ********/
  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.checkCurrent', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;
      await ed.document.save();

      const bin = await nuscr();
      output.clear(); output.show(true);

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

  /******** parseJson ********/
  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.parseJson', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;

      const bin = await nuscr();
      output.clear(); output.show(true);

      const res = await runCli(bin, ['--enum', ed.document.uri.fsPath]);
      output.appendLine(res.stdout || res.stderr);
    })
  );

  /******** configureNuScr ********/
  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.configureNuScr', async () => {
      const cfg = vscode.workspace.getConfiguration('nuscrEditor');
      const current = cfg.get('nuscrPath') || '';
      const value = await vscode.window.showInputBox({
        prompt: 'Path to nuScr binary (optional override)',
        value: current
      });
      if (value !== undefined) {
        await cfg.update('nuscrPath', value.trim(), vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage('nuScr path updated');
      }
    })
  );

  /******** enumCurrentToOutput ********/
  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.enumCurrentToOutput', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;

      const bin = await nuscr();
      output.clear(); output.show(true);

      const res = await runCli(bin, ['--enum', ed.document.uri.fsPath]);
      output.appendLine(res.stdout || res.stderr);
    })
  );

  /******** fsmForRoleToOutput ********/
  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.fsmForRoleToOutput', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;

      const text = ed.document.getText();
      const m = text.match(/protocol\s+([A-Za-z0-9_]+)/i);
      if (!m) {
        vscode.window.showErrorMessage('Protocol name not found');
        return;
      }
      const proto = m[1];

      const bin = await nuscr();
      output.clear(); output.show(true);

      const enumRes = await runCli(bin, ['--enum', ed.document.uri.fsPath]);
      if (!enumRes.success) {
        output.appendLine(enumRes.stderr);
        return;
      }

      const roles = enumRes.stdout
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      const role = await vscode.window.showQuickPick(roles);
      if (!role) return;

      const sel = buildSel(role, proto);
      const res = await runCli(bin, [`--fsm=${sel}`, ed.document.uri.fsPath]);
      output.appendLine(res.stdout || res.stderr);
    })
  );

  /******** openInNuScrLive ********/
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
