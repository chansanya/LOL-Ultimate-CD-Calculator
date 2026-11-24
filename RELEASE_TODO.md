# 本版本待发布事项

根据当前仓库变动，本版本发布推荐执行以下步骤：

## 1. 运行本地验证与部署预检

```bash
npm run check
```

原因：执行全套数学引擎、海克斯装备联动、单文件 CSP 散列及 Pages 静态产物测试，并通过 dry-run 验证合规性。

## 2. 部署到 Cloudflare（一键自动化）

### 推荐途径：通过 GitHub 一键部署按钮

1. 打开 [https://github.com/chansanya/LOL-Ultimate-CD-Calculator](https://github.com/chansanya/LOL-Ultimate-CD-Calculator)
2. 点击 README 顶部的 **Deploy to Cloudflare** 蓝色官方按钮。
3. 登录并授权 Cloudflare 访问 GitHub 账号。
4. 页面自动带入仓库配置，点击 **保存并部署 (Save and Deploy)** 即可。

原因：官方 `deploy.workers.cloudflare.com` 服务全自动化拉取、构建并分发，免去手动新建与复杂参数配置。
