# Save to Local History

**Author:** waterblue

Save to Local History is a lightweight extension for VS Code-compatible editors. It manually saves current workspace changes into Local History before AI edits, commits, refactors, merges, resets, or other risky operations.

It is designed for developers who use AI coding tools and want an extra local recovery point before accepting broad automated changes.

## Links

- Open VSX: <https://open-vsx.org/extension/waterblue/save-to-local-history>
- Repository: <https://github.com/zhanghang02/save-to-local-history>
- Required dependency: <https://open-vsx.org/extension/xyz/local-history>

## Why Use It

AI-assisted development can modify many files quickly. Git is still the source of truth, but sometimes you need a local checkpoint before a commit exists, before a change is reviewed, or before a risky operation accidentally overwrites an important intermediate version.

This extension gives you a quick manual action for creating that checkpoint in Local History.

## Prerequisite

This extension depends on the Local History extension:

- Extension ID: `xyz.local-history`
- Open VSX page: <https://open-vsx.org/extension/xyz/local-history>

When installed from a compatible marketplace, `xyz.local-history` is declared as an extension dependency and should be installed automatically. If the dependency is not installed, this extension will still show an install prompt and provides an explicit install command.

## Features

- Save Git changed files into Local History from the status bar
- Preview which files will be saved before writing snapshots
- Install or verify the Local History dependency from the side bar
- Configure the current workspace for safer Local History usage
- Exclude common large or generated folders such as `node_modules`, `data`, `logs`, caches, and binary data

## Recommended Use Cases

- Before asking AI to modify multiple files
- Before accepting a large AI-generated change
- Before committing code
- Before merging, rebasing, resetting, or cleaning files
- Before reorganizing a project
- Before any operation where an intermediate version may be hard to recover

## Commands

- `Save to Local History: Install Local History Dependency`
- `Save to Local History: Snapshot Git Changes`
- `Save to Local History: Preview Git Changes`
- `Save to Local History: Configure Workspace Local History`

## Install

Install from Open VSX:

```powershell
code --install-extension waterblue.save-to-local-history
```

If your editor uses a different command-line executable, replace `code` with that executable.

You can also download the VSIX from Open VSX and install it manually:

```powershell
code --install-extension .\waterblue.save-to-local-history-0.2.0.vsix
```

## Development

Install dependencies:

```powershell
npm install
```

Package the extension:

```powershell
npm run package
```

The package command creates a `.vsix` file in the project root.

Publish to Open VSX after setting `OVSX_PAT`:

```powershell
$env:OVSX_PAT = "<your-open-vsx-token>"
npm run publish:openvsx -- --pat $env:OVSX_PAT
```

## Notes

This extension is not a replacement for Git. It works as an additional local safety checkpoint alongside Git and Local History.

---

# Save to Local History 中文说明

**作者：** waterblue

Save to Local History 是一个适用于 VS Code 兼容编辑器的轻量扩展，用于在 AI 修改代码、提交、重构、合并、重置或其他高风险操作前，手动把当前工作区更改保存到 Local History。

它适合经常使用 AI 辅助开发的场景，帮助你在接受大范围自动修改前保留一个本地恢复点，降低关键中间版本因误操作丢失的风险。

## 链接

- Open VSX：<https://open-vsx.org/extension/waterblue/save-to-local-history>
- GitHub：<https://github.com/zhanghang02/save-to-local-history>
- 前置依赖：<https://open-vsx.org/extension/xyz/local-history>

## 使用前提

本扩展依赖 Local History：

- 扩展 ID：`xyz.local-history`
- Open VSX 页面：<https://open-vsx.org/extension/xyz/local-history>

从兼容市场安装时，本扩展已声明 `xyz.local-history` 为前置依赖，通常会自动安装。如果依赖未安装，扩展也会主动提示安装，并提供单独的安装命令。

## 主要功能

- 通过状态栏按钮把 Git 修改区文件补快照到 Local History
- 执行前预览将写入快照的文件
- 在侧边栏检查或安装 Local History 依赖
- 一键配置当前工作区的 Local History 保存规则
- 默认排除 `node_modules`、`data`、`logs`、缓存和二进制数据等大文件或生成目录

## 适合场景

- 让 AI 修改多个文件之前
- 接受 AI 生成的大量改动之前
- 提交代码之前
- 合并、变基、重置或清理文件之前
- 重组项目结构之前
- 任何担心误操作后无法找回关键中间版本的场景

## 注意

本扩展不是 Git 的替代品。它是 Git 和 Local History 之外的本地安全快照工具。
