# 本版本待发布事项

根据当前仓库变动，本版本发布推荐优先使用 **Cloudflare Pages** 托管（不限流量与请求数），同时继续兼容 Cloudflare Workers：

## 1. 运行本地验证与部署预检

```bash
npm run check
```

原因：执行全套数学引擎、海克斯装备联动、Pages 静态产物 (`dist/index.html` 与 `dist/_headers`) 及 Workers CSP 散列测试，并通过 dry-run 验证合规性。

## 2. 部署到 Cloudflare Pages（首选强烈推荐）

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，点击侧边栏 **Compute (Workers) -> Workers & Pages**。
2. 点击 **Create -> Pages -> Connect to Git**。
3. 选择 GitHub 仓库 `chansanya/LOL-Ultimate-CD-Calculator`。
4. 构建参数配置：
   * **Framework preset**：`None`
   * **Build command**：`npm run build`
   * **Build output directory**：`dist`
5. 点击 **Save and Deploy**，Cloudflare 即刻在全球 CDN 节点免费上线，获得无请求上限的专属域名。

原因：Pages 静态托管**完全不限请求量与流量**，无需担心玩家高并发访问产生限额报错；每次向 GitHub 推送代码自动触发增量构建。

## 3. 部署到 Cloudflare Workers（双轨兼容备选）

若仍希望使用 Workers 部署，可任选以下途径：

### 途径 A：通过 GitHub 一键部署按钮
点击 README 顶部的 **Deploy to Cloudflare Workers** 按钮，根据页面提示完成连接部署。

### 途径 B：通过 Wrangler CLI 本地发布
```bash
npx wrangler login   # 若未登录
npm run deploy       # 自动校验测试并通过 wrangler 部署
```
