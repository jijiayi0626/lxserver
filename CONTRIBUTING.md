# 贡献指南 (Contributing Guide)

感谢你对 **lxserver** 项目感兴趣！我们要打造一个优秀的开源项目，离不开每一位开发者的贡献。

在提交代码之前，请花几分钟阅读以下指南，这将有助于我们快速审查和合并你的代码。

## 🌳 分支管理策略 (Branch Strategy)

为了保证主分支的稳定性，我们采用以下分支策略：

*   **`main`**: 生产环境分支，时刻保持稳定，**严禁直接提交代码**。
*   **`dev`**: 开发主分支，包含最新的功能。**所有的 Pull Request (PR) 都必须合并到 `dev` 分支**。
*   **`feature/xxx` 或 `fix/xxx`**: 你的开发分支。

> ⚠️ **注意**：请不要向 `main` 分支提交 PR，否则会被自动关闭。

## 🛠️ 开发流程 (Workflow)

### 1. Fork 本仓库
点击右上角的 "Fork" 按钮，将 `lxserver` 复制到你自己的 GitHub 账号下。

### 2. 克隆到本地
```bash
git clone https://github.com/XCQ0607/lxserver.git
cd lxserver
