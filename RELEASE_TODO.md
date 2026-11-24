# 本版本待发布事项

根据当前仓库变动，本版本统一使用 **Cloudflare Pages** 进行全球边缘部署（完全不限请求量与流量）：

## 1. 运行本地验证与部署预检

```bash
npm run check
```

原因：执行全套数学引擎、海克斯装备联动及 Pages 静态产物 (`dist/index.html` 与 `dist/_headers`) 测试，确保 100% 通过。

## 2. 部署到 Cloudflare Pages

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，在左侧导航栏点击 **Workers 和 Pages (Workers & Pages)**。
2. 点击右侧 **创建 (Create application)** -> **选择「Pages」选项卡** -> 点击 **连接到 Git (Connect to Git)**。
3. 选择 GitHub 仓库 `chansanya/LOL-Ultimate-CD-Calculator`。
4. 构建参数填写：
   * **项目名称**：自定义（如 `lol-ultimate-cd-calculator`）
   * **生产分支**：`main`
   * **框架预设**：选择 **None**
   * **构建命令**：`npm run build`
   * **构建输出目录**：`dist`
   * **根目录**：留空（默认为 `/`）
5. 环境变量与绑定：**无需配置，全部留空**。
6. 点击底部的 **保存并部署 (Save and Deploy)**，即可完成全球上线并获得 `*.pages.dev` 访问链接。

原因：Pages 静态托管**完全不限请求量与带宽**，免除 Workers 每日 10 万次上限焦虑；每次向 GitHub 推送代码自动触发增量部署。
