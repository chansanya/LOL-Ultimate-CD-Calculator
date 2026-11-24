# 本版本待发布事项

根据当前仓库变动，本版本发布需要执行以下步骤与脚本：

## 1. 运行本地验证与部署预检

```bash
npm run check
```

原因：重新执行全套 110 项数学引擎、海克斯装备联动及单文件 CSP 散列测试，并通过 `wrangler deploy --dry-run` 验证打包产物合规性。

## 2. 部署到 Cloudflare Workers

### 途径 A：通过 GitHub 一键部署（推荐）

1. 打开 [https://github.com/chansanya/LOL-Ultimate-CD-Calculator](https://github.com/chansanya/LOL-Ultimate-CD-Calculator)
2. 点击 README 中的 **Deploy to Cloudflare** 按钮。
3. 授权 Cloudflare 访问 GitHub 仓库，Worker 名称默认或自定义。
4. 确认构建命令为 `npm run build`，部署命令为 `npm run deploy`。

原因：无需在本地配置 Cloudflare API Token 或登录凭证，依托官方 Workers Deploy 机制实现全边缘自动化部署与持续构建。

### 途径 B：通过 Wrangler CLI 手动部署

```bash
npx wrangler login   # 若未登录 Cloudflare
npm run deploy       # 自动先执行 npm test，验证通过后上传部署
```

原因：使用当前仓库配置直接发布至绑定的 Cloudflare Workers 生产环境。
