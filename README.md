# 极寒回响 · LOL 大招流计算器

寒冰射手 E/R 互刷与自定义双技能理论计算器。原生 HTML、CSS、JavaScript，深色冰蓝界面，Lucide 图标；所有计算在浏览器内实时完成。无需数据库、外部 API 或运行时 CDN。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chansanya/LOL-Ultimate-CD-Calculator)

> **理论达标不代表游戏内可以无限释放。** 技能与海克斯数据来自 [开发规范](./LOL-Ultimate-Calculator-Spec.md)，游戏版本未独立核验。E 的充能恢复、5 秒施放间隔、Q/W 是否抢占返还和实际返还目标均需实测。

## 通过 GitHub 一键部署

1. 将完整项目上传到公开仓库 `chansanya/LOL-Ultimate-CD-Calculator`，包含 `package-lock.json`、`worker.js` 和 `wrangler.toml`。
2. 点击上方 **Deploy to Cloudflare** 按钮，登录 Cloudflare，连接 GitHub，选择目标仓库及 Worker 名称。
3. 确认构建命令 `npm run build`、部署命令 `npm run deploy`。部署脚本先运行验收测试，全部通过后才执行 `wrangler deploy`。
4. 在 Cloudflare 界面确认部署，完成后打开生成的 `workers.dev` 地址。

按钮采用 [Cloudflare 官方 Deploy to Cloudflare 流程](https://developers.cloudflare.com/workers/platform/deploy-buttons/)。源仓库需为公开 GitHub 仓库。没有密钥、数据库或绑定需要配置；`wrangler.toml` 中的 `keep_vars = true` 保留现有远端变量。若使用已有 Worker，部署前核对其远端 routes、vars、bindings，并将需要保留的路由合并至配置，避免覆盖远端设置。

GitHub Actions 只进行测试、打包检查并上传 `worker.js` 构建产物，**不会部署 Cloudflare**。一键部署连接成功后，Cloudflare Workers Builds 可能在推送后自动部署；若希望始终手动发布，请在 Cloudflare 的构建设置中关闭自动构建。

## WSL 本地启动

需要 Linux Node.js **22.8+**（推荐 Node.js 24 LTS）和 npm。在 WSL 中运行：

```bash
cd /home/dev/workspace/projects/vscode/LOL-Ultimate-CD-Calculator
npm ci
npm run dev
```

打开 [http://localhost:8787](http://localhost:8787)。`dev` 使用本地 Wrangler 模拟，不部署远端；修改 `src/` 后 Wrangler 会重新构建。按 `Ctrl+C` 停止。

若 WSL 提示找不到 `node`，或 npm 错误调用了 Windows Node，本机已有的 Linux Node 可这样加入当前终端路径：

```bash
export PATH=/home/dev/workspace/node24.11.1/bin:$PATH
node --version
npm --version
```

通用环境请使用自己的 Linux Node 安装路径，避免复用 Windows 的 `node.exe` 或 npm。

## 构建与测试

```bash
npm test          # 构建 + 公式、验收数据及 Worker 自动化测试
npm run build    # 生成根目录 worker.js
npm run check    # 全部测试 + Wrangler deploy --dry-run，只检查，不部署
```

验收数据逐行固定在 `tests/engine.test.js`，覆盖规范第 8 节和全部 15 组 E/R 的有术士、无术士两种组合，并验证“最低整数急速达标、低 1 点不达标”。还检查独立急速、A/B 交换、比例边界、非法输入、无有限解和数值精度。Worker 测试验证 HTML、内嵌脚本语法、CSP 散列和 HTTP 行为。

测试使用 Node 内置 `node:test`，在同一进程运行以兼容受限 WSL / 沙箱环境，不依赖测试框架。浏览器的视觉与手动交互验收由使用者进行。

## 功能

- 默认 2E + 2R、150 通用急速、大法师 30%、术士 10%。
- 寒冰 W/E/R 预设与自定义英雄、任意双技能；名称、等级、基础 CD 可编辑，Q 不进入该模型。
- 通用急速滑块 0–500；数字输入允许超过 500、小数急速；A/B 独立急速分别配置。
- 大法师与术士开关及百分比可调；关闭即按 0 计算。
- 最低成型通用急速、当前差额、一键应用最低急速；无有限解时禁用应用。
- 逐技能显示有效急速、综合 CDR、实际 CD、获得返还和剩余 CD。
- 按基础冷却分解缩减、有效返还、剩余冷却；有效返还最多为实际冷却。
- 双向流程明确展示“释放 A 返还 B / 释放 B 返还 A”。
- 15 组加点对照保留文档验收列，另按当前配置计算阈值；2E + 2R 和 4E + 3R 可直接应用。
- 非法输入提示中文错误并清除过期结果；计算过程不舍入，显示保留两位小数。
- 手机自适应、键盘可操作、可见焦点、结果播报、减少动态效果支持。

“实时模拟器”指配置变化即时更新的**静态双技能模型**，不包含事件驱动时间轴。修改自定义等级只改变等级标记；寒冰等级会载入对应基础 CD。切换英雄模式会保留各自技能配置。应用加点不自动应用最低急速，需要另外点击“应用最低急速”。

## 计算模型

比例在引擎内为小数；UI 输入百分比。大法师返还采用**另一技能的基础 CD**，术士在急速换算的 CDR 上**加算**。

```text
C_i = clamp((H + X_i) / (100 + H + X_i) + S, 0, 1)
T_i = B_i × (1 − C_i)
F_A = B_B × M
F_B = B_A × M
L_i = max(0, T_i − F_i)

q_i = 1 − F_i / B_i − S
need_i = 0                                  q_i <= 0
need_i = Infinity                           q_i >= 1
need_i = max(0, 100 × q_i / (1 − q_i) − X_i)  其余情况
H_required = ceil(max(need_A, need_B))
```

沿用参考引擎的 `1e-8` 剩余冷却判定容差，以及最低值向上取整前的 `1e-9` 浮点容差。等基础 CD、有术士时最低 150；无术士最低 234。2E + 2R 在 150 急速及默认海克斯下，实际冷却与返还均为 24 秒；4E + 3R 均为 18 秒。

## 源码与单文件交付

```text
src/
  engine.js          纯函数计算引擎与加点阈值接口
  data/heroes.js     英雄、技能、来源、版本及验证状态
  data/augments.js   海克斯比例与验证状态
  ui.js              原生 DOM 与实时交互
  index.html         中文页面结构
  styles.css         冰蓝主题与响应式样式
  worker.js          请求入口工厂与响应头
scripts/build.mjs    打包浏览器代码、内嵌 CSS/JS，生成单文件 Worker
tests/               规范验收、边界条件、Worker 响应测试
worker.js            生成产物，可独立上传 Cloudflare Workers
wrangler.toml        Workers 配置
.github/workflows/ci.yml  只测试与打包，不部署
```

新增英雄或海克斯优先扩展 `src/data/`，计算逻辑放在 `src/engine.js`。修改源码后运行 `npm run build`，不要手工编辑生成的根目录 `worker.js`。构建依赖 esbuild、Lucide 和 Wrangler；部署后的 Worker 与页面没有外部依赖。

若以后决定通过 CLI 手动部署，命令为 `npm run deploy`（需要先 `npx wrangler login`），本次开发不执行该命令。当前推荐使用上方 GitHub 一键部署入口。

本工具为非官方玩家工具，与 Riot Games 无关联。Lucide 图标使用 ISC 许可，许可证随构建代码保留。
