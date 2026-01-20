let activatedOnce = false;

/* =========================
   Utility helpers
========================= */

function sanitizeAt(s){ return (''+(s||'')).replace(/@/g,''); }

function buildSel(role, proto){
  const rstr = '' + (role || '');
  if(rstr.includes('@')){
    const parts = rstr.split('@').filter(Boolean);
    const r = parts[0] || '';
    const p = parts[1] || (''+(proto||''));
    return sanitizeAt(r) + '@' + sanitizeAt(p);
  }
  return sanitizeAt(role) + '@' + sanitizeAt(proto);
}

const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

/* =========================
   CLI runner
========================= */

function runCli(nuscrPath, args, stdin) {
  return new Promise((resolve) => {
    try {
      const child = cp.execFile(
        nuscrPath,
        args,
        { maxBuffer: 50_000_000 },
        (err, stdout, stderr) => {
          resolve({
            success: !err,
            stdout: stdout || '',
            stderr: stderr || '',
            code: err && err.code ? err.code : 0,
            err
          });
        }
      );
      if (stdin && child.stdin) child.stdin.end(stdin);
    } catch (e) {
      resolve({
        success: false,
        stdout: '',
        stderr: String(e),
        code: 127,
        err: e
      });
    }
  });
}

/* =========================
   Roles tree provider
========================= */

class RolesProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.roles = [];
    this.selectedFile = null;
  }

  refresh(filePath) {
    this.selectedFile = filePath || this.selectedFile;
    this._onDidChangeTreeData.fire();
  }

  setRoles(list) {
    this.roles = list || [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    const ti = new vscode.TreeItem(
      element.label,
      element.collapsible
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    if (element.command) ti.command = element.command;
    return ti;
  }

  getChildren(element) {
    if (!element) {
      const groups = {};
      for (const r of this.roles) {
        const proto = r.protocol || 'protocol';
        groups[proto] = groups[proto] || [];
        groups[proto].push(r.role);
      }
      return Object.keys(groups).map(p => ({
        label: p,
        collapsible: true,
        children: groups[p]
      }));
    } else {
      return (element.children || []).map(r => ({
        label: r,
        collapsible: false,
        command: {
          command: 'nuscrEditor.generateCFSMFor',
          title: 'Generate CFSM',
          arguments: [this.selectedFile, r, element.label]
        }
      }));
    }
  }
}

/* =========================
   Extension activation
========================= */

function activate(context) {
  if (activatedOnce) {
    return;
  }
  activatedOnce = true;

  const output = vscode.window.createOutputChannel('nuScr');
  const diagnostics = vscode.languages.createDiagnosticCollection('nuscr');
  context.subscriptions.push(output, diagnostics);

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  status.text = 'nuScr: idle';
  status.show();
  context.subscriptions.push(status);

  const rolesButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  rolesButton.text = '$(list-unordered) nuScr Roles';
  rolesButton.tooltip = 'Show roles & generate CFSM';
  rolesButton.command = 'nuscrEditor.showRoles';
  rolesButton.show();
  context.subscriptions.push(rolesButton);

  const liveButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  );
  liveButton.text = '$(globe) Open in Live';
  liveButton.tooltip = 'Copy protocol to clipboard and open nuScr Live';
  liveButton.command = 'nuscrEditor.openInNuScrLive';
  liveButton.show();
  context.subscriptions.push(liveButton);

  const config = () => vscode.workspace.getConfiguration('nuscrEditor');
  const nuscrPathCfg = () => config().get('nuscrPath') || 'nuscr';

  const rolesProvider = new RolesProvider(context);
  const treeView = vscode.window.createTreeView('nuScrRolesView', {
    treeDataProvider: rolesProvider
  });
  context.subscriptions.push(treeView);

  async function runClassicalCheck(filePath) {
    const nuscr = nuscrPathCfg();
    output.clear(); output.show(true);
    output.appendLine('--- RUN (classical): ' + nuscr + ' ' + filePath);
    const res = await runCli(nuscr, [filePath]);
    if (res.stdout) output.appendLine(res.stdout);
    if (res.stderr) output.appendLine(res.stderr);
    if (!res.success) {
      vscode.window.showErrorMessage('nuScr: check failed (see Output).');
      status.text = 'nuScr: error';
      diagnostics.set(vscode.Uri.file(filePath), []);
    } else {
      vscode.window.showInformationMessage(
        'nuScr: Protocol is valid (classical nuscr).'
      );
      status.text = 'nuScr: OK';
      diagnostics.delete(vscode.Uri.file(filePath));
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.checkCurrent', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await editor.document.save();
      await runClassicalCheck(editor.document.uri.fsPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nuscrEditor.openInNuScrLive', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = editor.document.getText();
      if (text.trim()) {
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('Protocol copied to clipboard!');
      }
      await vscode.env.openExternal(
        vscode.Uri.parse('https://nuscr.dev/nuscr/')
      );
    })
  );

  async function updateRolesForFile(filePath) {
    if (!filePath) return;
    const nuscr = nuscrPathCfg();
    const res = await runCli(nuscr, ['--enum', filePath]);
    if (!res.success) {
      rolesProvider.setRoles([]);
      return;
    }
    const roles = [];
    res.stdout.split(/\r?\n/).forEach(l => {
      const s = l.trim();
      if (s && !/^roles:|^protocols:/i.test(s)) {
        roles.push({ role: s.split(/[,:]/)[0], protocol: s.split(/[,:]/)[0] });
      }
    });
    let proto = null;
    try {
      const txt = fs.readFileSync(filePath,'utf8');
      const m = txt.match(/protocol\s+([A-Za-z0-9_]+)/i);
      proto = m ? m[1] : null;
    } catch {}
    rolesProvider.setRoles(
      roles.map(r => ({ role: r.role, protocol: proto || r.protocol }))
    );
    rolesProvider.selectedFile = filePath;
    rolesProvider.refresh(filePath);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'nuscr') {
        updateRolesForFile(doc.uri.fsPath);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'nuscr') {
        updateRolesForFile(editor.document.uri.fsPath);
      }
    })
  );
}

function deactivate() {
  activatedOnce = false;
}

module.exports = { activate, deactivate };
