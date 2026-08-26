# 🔒 安全策略 (Security Policy)

eduNest 团队非常重视系统的安全性和用户隐私。我们致力于及时响应和修复任何已知的安全漏洞。

---

## 🛡️ 支持的版本 (Supported Versions)

目前我们为以下版本提供积极的安全维护和更新补丁：

| 版本 (Version) | 支持状态 (Supported) |
| :--- | :--- |
| **1.0.x (Latest)** | :white_check_mark: 积极维护中 |
| < 1.0.0 | :x: 已停止支持 |

---

## 🚨 报告安全漏洞 (Reporting a Vulnerability)

如果您在 eduNest 中发现了安全漏洞，**请切勿公开发布在 GitHub Issues 或社交媒体上**。

请按照以下流程私下提报：
1. **GitHub Security Advisory**：优先通过 GitHub 仓库的 [Security Advisories](https://github.com/tubban1/eduNest/security/advisories/new) 提交私密漏洞报告。
2. **紧急邮件提报**：如无法使用 GitHub Security，请发送详细漏洞描述至安全响应邮箱（如 `security@edunest.ai` 或直接联系项目核心维护者）。

### 报告中请尽量包含：
- 漏洞类型与受影响的组件（例如：Supabase 权限绕过、API 注入、JWT 伪造等）。
- 复现漏洞的详细步骤、PoC 代码或请求截图。
- 潜在危害及修复建议（如有）。

### 响应周期：
- 我们将在 **48 小时** 内确认并回复您的报告。
- 确认漏洞后，团队将在独立安全分支进行修复并在最短时间内发布安全更新。
- 漏洞修复发布后，我们将在 Release Notes 中对漏洞报告者表示公开致谢（可匿名）。
