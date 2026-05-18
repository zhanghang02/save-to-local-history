const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const output = vscode.window.createOutputChannel('Save to Local History');
const LOCAL_HISTORY_EXTENSION_ID = 'xyz.local-history';
const INSTALL_DEPENDENCY_COMMAND = 'saveToLocalHistory.installDependency';

class ActionItem extends vscode.TreeItem {
    constructor(label, description, commandName, iconId) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.command = {
            command: commandName,
            title: label
        };
        this.iconPath = new vscode.ThemeIcon(iconId || 'history');
    }
}

class ActionsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const dependencyInstalled = isLocalHistoryInstalled();
        return [
            new ActionItem(
                dependencyInstalled ? 'Local History 依赖已就绪' : '安装 Local History 主扩展',
                dependencyInstalled ? '检查' : '缺少依赖',
                INSTALL_DEPENDENCY_COMMAND,
                dependencyInstalled ? 'check' : 'cloud-download'
            ),
            new ActionItem('补快照到 Local History', '执行', 'saveToLocalHistory.snapshotGitChanges', 'save'),
            new ActionItem('预览将写入的快照', 'Dry Run', 'saveToLocalHistory.previewGitChanges', 'preview'),
            new ActionItem('配置当前工作区', '设置', 'saveToLocalHistory.configureWorkspace', 'gear')
        ];
    }
}

const RECOMMENDED_EXCLUDE = [
    '**/.history/**',
    '**/node_modules/**',
    '**/.pytest_cache/**',
    '**/__pycache__/**',
    '**/.hypothesis/**',
    '**/data/**',
    '**/logs/**',
    '**/*.log',
    '**/*.csv',
    '**/*.tsv',
    '**/*.parquet',
    '**/*.feather',
    '**/*.jsonl',
    '**/*.h5',
    '**/*.hdf5',
    '**/*.db',
    '**/*.sqlite',
    '**/*.sqlite3',
    '**/*.pkl',
    '**/*.pickle',
    '**/*.npz',
    '**/*.npy',
    '**/*.zip',
    '**/*.7z',
    '**/*.tar',
    '**/*.gz',
    '**/*.tgz',
    '**/*.rar',
    '**/*.bak',
    '**/*.tmp',
    '**/*.bin',
    '**/*.dat'
];

function getWorkspaceFolder() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (folder) {
            return folder;
        }
    }
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0]
        : undefined;
}

function isLocalHistoryInstalled() {
    return !!vscode.extensions.getExtension(LOCAL_HISTORY_EXTENSION_ID);
}

async function ensureLocalHistoryInstalled(interactive = true) {
    if (isLocalHistoryInstalled()) {
        return true;
    }

    if (!interactive) {
        return false;
    }

    const action = await vscode.window.showWarningMessage(
        '未检测到 Local History 主扩展 `xyz.local-history`，是否现在安装？',
        '立即安装',
        '取消'
    );
    if (action !== '立即安装') {
        return false;
    }

    try {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', LOCAL_HISTORY_EXTENSION_ID);
        vscode.window.showInformationMessage('Local History 安装请求已发出。请等待安装完成后重载窗口，再重新执行当前动作。');
        return false;
    } catch (error) {
        vscode.window.showErrorMessage(`安装 Local History 失败：${error.message || error}`);
        return false;
    }
}

async function installDependency() {
    if (isLocalHistoryInstalled()) {
        vscode.window.showInformationMessage('Local History 主扩展已安装。');
        return;
    }

    await ensureLocalHistoryInstalled(true);
}

function mergeUnique(base, extras) {
    const seen = new Set();
    const merged = [];
    [...base, ...extras].forEach((item) => {
        if (!item || seen.has(item)) {
            return;
        }
        seen.add(item);
        merged.push(item);
    });
    return merged;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

function formatTimestamp(date) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}

function isExcludedBySimpleRules(relativePath, patterns) {
    if (!patterns || patterns.length === 0) {
        return false;
    }

    const normalized = relativePath.replace(/\\/g, '/');
    for (const pattern of patterns) {
        if (!pattern) {
            continue;
        }

        const dirMatch = pattern.match(/^\*\*\/([^/]+)\/\*\*$/);
        if (dirMatch) {
            const dir = dirMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|/)${dir}(/|$)`);
            if (regex.test(normalized)) {
                return true;
            }
            continue;
        }

        const extMatch = pattern.match(/^\*\*\/\*\.([A-Za-z0-9]+)$/);
        if (extMatch) {
            const ext = `.${extMatch[1].toLowerCase()}`;
            if (normalized.toLowerCase().endsWith(ext)) {
                return true;
            }
        }
    }

    return false;
}

function expandLocalHistoryPath(historyPathSetting, workspaceRoot) {
    if (!historyPathSetting) {
        return null;
    }

    let expanded = historyPathSetting.replace(/%([^%]+)%/g, (_, key) => process.env[key] || '');
    if (expanded.startsWith('~')) {
        expanded = path.join(require('os').homedir(), expanded.slice(1));
    }

    const match = expanded.match(/^\$\{workspaceFolder(?:\s*:\s*(.*?))?\}(.*)$/i);
    if (match) {
        expanded = path.join(workspaceRoot, (match[2] || '').replace(/^[/\\]+/, ''));
    }

    return expanded;
}

function getHistoryInfo(folder) {
    const config = vscode.workspace.getConfiguration('local-history', folder.uri);
    const historyPathSetting = config.get('path');
    const absolute = !!config.get('absolute', false);
    const enabled = config.get('enabled', 1) !== 0;
    const exclude = config.get('exclude', []);

    let basePath = expandLocalHistoryPath(historyPathSetting, folder.uri.fsPath);
    if (!basePath) {
        basePath = folder.uri.fsPath;
    }

    let historyRoot;
    if (absolute) {
        historyRoot = path.join(basePath, '.history');
    } else if (historyPathSetting) {
        historyRoot = path.join(basePath, '.history', path.basename(folder.uri.fsPath));
    } else {
        historyRoot = path.join(basePath, '.history');
    }

    return {
        enabled,
        exclude,
        absolute,
        historyRoot
    };
}

function parseGitChangedFiles(workspaceRoot) {
    const stdout = cp.execFileSync(
        'git',
        ['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-uall'],
        { cwd: workspaceRoot, encoding: 'utf8' }
    );

    return stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            const x = line[0] || ' ';
            const y = line[1] || ' ';
            if ((x === 'D' || y === 'D') && !line.includes(' -> ')) {
                return null;
            }
            let target = line.slice(3);
            if (target.includes(' -> ')) {
                target = target.split(' -> ').pop();
            }
            if (target.startsWith('"') && target.endsWith('"')) {
                target = target.slice(1, -1);
            }
            return target.trim();
        })
        .filter(Boolean);
}

async function configureWorkspace() {
    if (!(await ensureLocalHistoryInstalled(true))) {
        return;
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
        vscode.window.showWarningMessage('未检测到工作区，无法配置 Local History。');
        return;
    }

    const localHistoryConfig = vscode.workspace.getConfiguration('local-history', folder.uri);
    const filesConfig = vscode.workspace.getConfiguration('files', folder.uri);

    const currentExclude = localHistoryConfig.get('exclude', []);
    const mergedExclude = mergeUnique(Array.isArray(currentExclude) ? currentExclude : [], RECOMMENDED_EXCLUDE);

    await localHistoryConfig.update('enabled', 2, vscode.ConfigurationTarget.Workspace);
    await localHistoryConfig.update('daysLimit', 30, vscode.ConfigurationTarget.Workspace);
    await localHistoryConfig.update('saveDelay', 0, vscode.ConfigurationTarget.Workspace);
    await localHistoryConfig.update('path', '${workspaceFolder}/.vscode', vscode.ConfigurationTarget.Workspace);
    await localHistoryConfig.update('absolute', false, vscode.ConfigurationTarget.Workspace);
    await localHistoryConfig.update('exclude', mergedExclude, vscode.ConfigurationTarget.Workspace);

    const currentFilesExclude = filesConfig.get('exclude', {});
    const nextFilesExclude = Object.assign({}, currentFilesExclude || {}, { '**/.history': true });
    await filesConfig.update('exclude', nextFilesExclude, vscode.ConfigurationTarget.Workspace);

    try {
        await vscode.workspace.getConfiguration('local-history').update('treeLocation', 'explorer', vscode.ConfigurationTarget.Workspace);
    } catch (_) {
    }

    vscode.window.showInformationMessage('Local History 工作区配置已更新。');
}

async function snapshotGitChanges(previewOnly = false) {
    if (!(await ensureLocalHistoryInstalled(true))) {
        return;
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
        vscode.window.showWarningMessage('未检测到工作区，无法补快照。');
        return;
    }

    const workspaceRoot = folder.uri.fsPath;
    const historyInfo = getHistoryInfo(folder);
    if (!historyInfo.enabled) {
        vscode.window.showWarningMessage('Local History 当前被禁用，请先运行配置命令。');
        return;
    }

    let changedFiles;
    try {
        changedFiles = parseGitChangedFiles(workspaceRoot);
    } catch (error) {
        vscode.window.showErrorMessage(`读取 Git 修改区失败：${error.message || error}`);
        return;
    }

    if (changedFiles.length === 0) {
        vscode.window.showInformationMessage('Git 修改区为空，无需补快照。');
        return;
    }

    const saveConfig = vscode.workspace.getConfiguration('saveToLocalHistory', folder.uri);
    const includeExcluded = !!saveConfig.get('snapshot.includeExcluded', false);

    output.clear();
    output.appendLine(`[scope] Workspace`);
    output.appendLine(`[ws]    ${workspaceRoot}`);
    output.appendLine(`[hist]  ${historyInfo.historyRoot}`);

    let processed = 0;
    let skippedExcluded = 0;
    let skippedMissing = 0;
    const baseTime = new Date();
    let offset = 0;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: previewOnly ? '预览 Save to Local History' : '保存到 Local History',
            cancellable: false
        },
        async (progress) => {
            for (const relPath of changedFiles) {
                const sourcePath = path.join(workspaceRoot, relPath);
                if (!fs.existsSync(sourcePath)) {
                    output.appendLine(`[skip] missing: ${relPath}`);
                    skippedMissing += 1;
                    continue;
                }

                const stat = fs.statSync(sourcePath);
                if (!stat.isFile()) {
                    output.appendLine(`[skip] dir: ${relPath}`);
                    continue;
                }

                if (!includeExcluded && isExcludedBySimpleRules(relPath, historyInfo.exclude)) {
                    output.appendLine(`[skip] excluded: ${relPath}`);
                    skippedExcluded += 1;
                    continue;
                }

                const parsed = path.parse(sourcePath);
                const timestamp = formatTimestamp(new Date(baseTime.getTime() + offset * 1000));
                offset += 1;

                const targetDir = historyInfo.absolute
                    ? path.join(historyInfo.historyRoot, path.dirname(sourcePath).replace(':', '').replace(/^[/\\]+/, ''))
                    : path.join(historyInfo.historyRoot, path.dirname(relPath));
                const targetPath = path.join(targetDir, `${parsed.name}_${timestamp}${parsed.ext}`);

                output.appendLine(`[plan] ${relPath} => ${targetPath}`);
                if (!previewOnly) {
                    fs.mkdirSync(targetDir, { recursive: true });
                    fs.copyFileSync(sourcePath, targetPath);
                }

                processed += 1;
                progress.report({ message: `${processed}/${changedFiles.length}: ${relPath}` });
            }
        }
    );

    output.appendLine(`[done] processed=${processed} skipped_missing=${skippedMissing} skipped_excluded=${skippedExcluded}`);
    output.show(true);

    try {
        await vscode.commands.executeCommand('treeLocalHistory.forAll');
        await vscode.commands.executeCommand('treeLocalHistory.refresh');
    } catch (_) {
    }

    if (previewOnly) {
        vscode.window.showInformationMessage(`预览完成：计划补 ${processed} 个文件，跳过 ${skippedExcluded} 个排除项。`);
    } else {
        vscode.window.showInformationMessage(`已补快照 ${processed} 个文件到 Local History。`);
    }
}

function createStatusBarItem(context) {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    const refresh = () => {
        const config = vscode.workspace.getConfiguration('saveToLocalHistory');
        const enabled = !!config.get('statusBar.enabled', true);
        const workspaceFolder = getWorkspaceFolder();

        if (!enabled || !workspaceFolder) {
            item.hide();
            return;
        }

        item.text = String(config.get('statusBar.text', '$(history) Save→History'));
        item.tooltip = '点击后将 Git 修改区文件补快照进 Local History';
        item.name = 'Save to Local History';
        item.command = 'saveToLocalHistory.snapshotGitChanges';
        item.show();
    };

    refresh();
    context.subscriptions.push(item);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('saveToLocalHistory') || event.affectsConfiguration('local-history')) {
            refresh();
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => refresh()));
}

function activate(context) {
    context.subscriptions.push(output);

    const provider = new ActionsProvider();

    context.subscriptions.push(vscode.commands.registerCommand(INSTALL_DEPENDENCY_COMMAND, async () => {
        await installDependency();
        provider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('saveToLocalHistory.configureWorkspace', configureWorkspace));
    context.subscriptions.push(vscode.commands.registerCommand('saveToLocalHistory.previewGitChanges', () => snapshotGitChanges(true)));
    context.subscriptions.push(vscode.commands.registerCommand('saveToLocalHistory.snapshotGitChanges', () => snapshotGitChanges(false)));

    context.subscriptions.push(vscode.window.registerTreeDataProvider('saveToLocalHistory.view', provider));

    createStatusBarItem(context);
    context.subscriptions.push(vscode.extensions.onDidChange(() => provider.refresh()));

    setTimeout(() => {
        const workspaceFolder = getWorkspaceFolder();
        const config = vscode.workspace.getConfiguration('saveToLocalHistory');
        const enabled = !!config.get('statusBar.enabled', true);
        if (workspaceFolder && enabled) {
            output.appendLine('[hint] Status bar button is available on the bottom-right: Save→History');
        }
        if (!isLocalHistoryInstalled()) {
            output.appendLine('[hint] Local History dependency is missing. Open the right sidebar view or click the status bar button to install it.');
        }
    }, 1200);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
