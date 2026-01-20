

function sanitizeAt(s){ return (''+(s||'')).replace(/@/g,''); }

function buildSel(role, proto){
  // If role already contains an '@', assume it may already be a role@protocol pair.
  // Normalize by taking the first two non-empty parts and prefer the protocol part from role if present.
  const rstr = '' + (role || '');
  if(rstr.includes('@')){
    const parts = rstr.split('@').filter(function(x){ return !!x; });
    const r = parts[0] || '';
    const p = parts[1] || (''+(proto||''));
    return sanitizeAt(r) + '@' + sanitizeAt(p);
  }
  // otherwise build from role and proto
  return sanitizeAt(role) + '@' + sanitizeAt(proto);
}
const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function runCli(nuscrPath, args, stdin) {
  return new Promise((resolve) => {
    try {
      const child = cp.execFile(nuscrPath, args, { maxBuffer: 50_000_000 }, (err, stdout, stderr) => {
        resolve({ success: !err, stdout: stdout || '', stderr: stderr || '', code: err && err.code ? err.code : 0, err });
      });
      if (stdin && child.stdin) child.stdin.end(stdin);
    } catch (e) {
      resolve({ success: false, stdout: '', stderr: String(e), code: 127, err: e });
    }
  });
}

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
    const ti = new vscode.TreeItem(element.label, element.collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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
      return Object.keys(groups).map(p => ({ label: p, collapsible: true, children: groups[p] }));
    } else {
      return (element.children || []).map(r => {
        return { label: r, collapsible: false, command: { command: 'nuscrEditor.generateCFSMFor', title: 'Generate CFSM', arguments: [this.selectedFile, r, element.label] } };
      });
    }
  }
}

function activate(context) {
  const output = vscode.window.createOutputChannel('nuScr');
  const diagnostics = vscode.languages.createDiagnosticCollection('nuscr');
  context.subscriptions.push(output, diagnostics);

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = 'nuScr: idle';
  status.show();
  context.subscriptions.push(status);

  // roles status button
  const rolesButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  rolesButton.text = '$(list-unordered) nuScr Roles';
  rolesButton.tooltip = 'Show roles & generate CFSM';
  rolesButton.command = 'nuscrEditor.showRoles';
  rolesButton.show();
  context.subscriptions.push(rolesButton);

  // open-in-live status button
  const liveButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  liveButton.text = '$(globe) Open in Live';
  liveButton.tooltip = 'Copy protocol to clipboard and open nuScr Live';
  liveButton.command = 'nuscrEditor.openInNuScrLive';
  liveButton.show();
  context.subscriptions.push(liveButton);

  const config = () => vscode.workspace.getConfiguration('nuscrEditor');
  const nuscrPathCfg = () => config().get('nuscrPath') || 'nuscr';

  const rolesProvider = new RolesProvider(context);
  const treeView = vscode.window.createTreeView('nuScrRolesView', { treeDataProvider: rolesProvider });
  context.subscriptions.push(treeView);

  // classical-only: never attempt modern subcommands
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
      output.appendLine('Classical nuScr: no output — protocol appears valid.');
      vscode.window.showInformationMessage('nuScr: Protocol is valid (classical nuscr).');
      status.text = 'nuScr: OK';
      diagnostics.delete(vscode.Uri.file(filePath));
    }
  }

  context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.checkCurrent', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showInformationMessage('Open a nuScr file first.'); return; }
    await editor.document.save();
    await runClassicalCheck(editor.document.uri.fsPath);
  }));

  // open in live
  context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.openInNuScrLive', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showInformationMessage('Open a nuScr file first.'); return; }
    try {
      const text = editor.document.getText();
      if (text && text.trim().length > 0) {
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('Protocol copied to clipboard!');
      } else {
        vscode.window.showWarningMessage('File is empty — nothing copied.');
      }
      await vscode.env.openExternal(vscode.Uri.parse('https://nuscr.dev/nuscr/'));
    } catch (e) {
      vscode.window.showErrorMessage('Failed to open nuScr Live: ' + String(e));
    }
  }));

  // show roles & generate CFSM
  

  

  async function updateRolesForFile(filePath) {
    if (!filePath) return;
    const nuscr = nuscrPathCfg();
    output.clear(); output.show(true);
    output.appendLine('--- RUN: ' + nuscr + ' --enum ' + filePath);
    const res = await runCli(nuscr, ['--enum', filePath]);
    if (res.stdout) output.appendLine(res.stdout);
    if (res.stderr) output.appendLine(res.stderr);
    if (!res.success) {
      vscode.window.showErrorMessage('nuscr --enum failed (see Output)');
      rolesProvider.setRoles([]);
      return;
    }
    const roles = [];
    (res.stdout || '').split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (!l) return;
      if (l.toLowerCase().startsWith('roles:') || l.toLowerCase().startsWith('protocols:')) return;
      const p = l.split(/[,:]/)[0].trim();
      if (p) roles.push({ role: p, protocol: p });
    });
    try {
      const txt = fs.readFileSync(filePath,'utf8');
      const m = txt.match(/protocol\s+([A-Za-z0-9_]+)/i);
      const protoName = m ? m[1] : null;
      const final = roles.map(r => ({ role: r.role, protocol: protoName || r.protocol }));
      rolesProvider.setRoles(final);
      rolesProvider.selectedFile = filePath;
      rolesProvider.refresh(filePath);
    } catch (e) {
      rolesProvider.setRoles([]);
    }
  }

  context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.parseJson', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showInformationMessage('Open a nuScr file first.'); return; }
    const fp = editor.document.uri.fsPath;
    output.clear(); output.show(true);
    const nuscr = nuscrPathCfg();
    const res = await runCli(nuscr, ['--enum', fp]);
    output.appendLine(res.stdout || '');
    output.appendLine(res.stderr || '');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.configureNuScr', async () => {
    const cfg = vscode.workspace.getConfiguration('nuscrEditor');
    const current = cfg.get('nuscrPath') || 'nuscr';
    const result = await vscode.window.showInputBox({ prompt: 'Path to nuscr binary', value: current });
    if (result !== undefined) {
      await cfg.update('nuscrPath', result.trim(), vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage('nuScr binary set to: ' + result.trim());
    }
  }));

  // auto-run enum when opening .nuscr or switching active editor
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(async (doc) => {
    if (doc && doc.languageId === 'nuscr') {
      rolesProvider.selectedFile = doc.uri.fsPath;
      await updateRolesForFile(doc.uri.fsPath);
    }
  }));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor && editor.document && editor.document.languageId === 'nuscr') {
      rolesProvider.selectedFile = editor.document.uri.fsPath;
      await updateRolesForFile(editor.document.uri.fsPath);
    }
  }));

  
// explicit --enum output command (enumCurrentToOutput)
context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.enumCurrentToOutput', async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'nuscr') {
    vscode.window.showInformationMessage('Open a .nuscr file first.');
    return;
  }
  await editor.document.save();
  const filePath = editor.document.uri.fsPath;
  const nuscr = nuscrPathCfg();
  output.clear(); output.show(true);
  output.appendLine('--- RUN: ' + nuscr + ' --enum ' + filePath);
  const res = await runCli(nuscr, ['--enum', filePath]);
  if (res.stdout) output.appendLine(res.stdout);
  if (res.stderr) output.appendLine(res.stderr);
  if (!res.success) {
    vscode.window.showErrorMessage('nuscr --enum failed (see Output).');
  }
}));

// explicit --fsm=ROLE@PROTO output command (fsmForRoleToOutput)
context.subscriptions.push(vscode.commands.registerCommand('nuscrEditor.fsmForRoleToOutput', async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'nuscr') {
    vscode.window.showInformationMessage('Open a .nuscr file first.');
    return;
  }
  await editor.document.save();
  const filePath = editor.document.uri.fsPath;
  const nuscr = nuscrPathCfg();
  // infer protocol name
  let proto = null;
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    const m = txt.match(/protocol\s+([A-Za-z0-9_]+)/i);
    proto = m ? m[1] : null;
  } catch(e){}
  if (!proto) {
    vscode.window.showErrorMessage('Protocol name not found in file (e.g. "protocol Adder(...)").');
    return;
  }
  // enumerate roles
  output.clear(); output.show(true);
  output.appendLine('--- RUN: ' + nuscr + ' --enum ' + filePath);
  const enumRes = await runCli(nuscr, ['--enum', filePath]);
  if (enumRes.stdout) output.appendLine(enumRes.stdout);
  if (enumRes.stderr) output.appendLine(enumRes.stderr);
  if (!enumRes.success) {
    vscode.window.showErrorMessage('nuscr --enum failed (see Output).');
    return;
  }
  const lines = (enumRes.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^roles:/i.test(l) && !/^protocols:/i.test(l));
  const roles = lines.map(l => l.split(/[ ,:]/)[0]).filter(Boolean);
  if (!roles.length) {
    vscode.window.showInformationMessage('No roles found in file.');
    return;
  }
  const role = await vscode.window.showQuickPick(roles, { placeHolder: 'Select role for --fsm=ROLE@' + proto });
  if (!role) return;
  const sel = buildSel(role, proto);
  output.appendLine('--- RUN: ' + nuscr + ' --fsm=' + sel + ' ' + filePath);
  const res2 = await runCli(nuscr, ['--fsm=' + sel, filePath]);
  if (res2.stdout) output.appendLine(res2.stdout);
  if (res2.stderr) output.appendLine(res2.stderr);
  if (!res2.success) {
    vscode.window.showErrorMessage('nuscr --fsm failed (see Output).');
    return;
  }
  try {
    const outDir = path.join(path.dirname(filePath), '.nuscr-gen', 'cfsm');
    fs.mkdirSync(outDir, { recursive: true });
    const dotPath = path.join(outDir, role + '.dot');
    fs.writeFileSync(dotPath, res2.stdout || '');
  } catch(e){}
}));

// run check on save if enabled
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (doc.languageId === 'nuscr') {
      const cfg = vscode.workspace.getConfiguration('nuscrEditor');
      if (cfg.get('checkOnSave') !== false) {
        try { await runClassicalCheck(doc.uri.fsPath); } catch(e){}
      }
    }
  }));
}

function deactivate() {}

module.exports = { activate, deactivate };
