# 居家办公计算器 / 海克斯大招流计算器 (LOL Ultimate CD Calculator)

在线体验：👉 **[https://lol.10085.fun/](https://lol.10085.fun/)**

英雄联盟海克斯大乱斗 / 斗魂竞技场大招流战术模拟与计算终端。原生 HTML5、CSS3、Vanilla JavaScript，基于 **Cloudflare Pages 全球无限制静态托管**，深色全息冰蓝机能美学。纯浏览器本地秒级实时运算，零数据库、零外部 API、零运行时 CDN 依赖。

[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-f38020?logo=cloudflarepages&logoColor=white)](https://dash.cloudflare.com/)
[![CI Tests](https://github.com/chansanya/LOL-Ultimate-CD-Calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/chansanya/LOL-Ultimate-CD-Calculator/actions)

> **理论达标不代表游戏内可以无限释放。** 模型计算基于海克斯机制与理论推演公式，游戏版本未独立核验；技能施放手感、施法间隔与充能机制请以对局实际体验为准。表面伤害模拟计算可能有误差，以实际对局为准。

---

## 核心战术功能矩阵

### 1. 英雄专属流派与技能配置
* **寒冰射手 (艾希 Ashe)**：
  * **E 鹰击长空 + R 魔法水晶箭** 双技能对向互刷闭环。
  * 内置 `2E + 2R`（起步 CD 80s/80s，150 急速互刷）与 `4E + 3R`（满级 CD 60s/60s，150 急速互刷）快速配置 Chips。
  * 实时推演理论互刷最低急速、当前差额，并支持一键应用最低急速。
* **死亡颂唱者 (死歌 Karthus)**：
  * **R 安魂曲** 极致冷却压缩与全屏伤害爆发推演。
  * 支持 160s / 180s / 200s 基础 CD 调谐与等级切换。
* **海洋之灾 (船长 Gangplank)**：
  * **R 加农炮幕** 全球轰炸冷却推演与法强加成计算。

### 2. 海克斯强化联动矩阵 (Hextech Augments)
* **纯粹主义者 - 术师**：提供 +10% 独立加算 CDR，并将全部额外攻速按 0.65 换算为技能急速。
* **尤里卡**：获得相当于总法术强度 30% 的技能急速，与帽子、黯炎火炬等法强百分比放大产生极速流质变。
* **缩小引擎**：每层参与击杀提供 +10 技能急速，支持击杀层数动态模拟。
* **无限循环往复**：基准提供 +60 技能急速，每次参与击杀额外永久提供 +3 技能急速。
* **物理转魔法**：将全部额外攻击力转化为等额法术强度，并额外提升 15% 总法术强度。
* **大法师 · 双技能互刷核心**：释放任一技能，按其基础冷却时间的 30% 返还给另一技能。
* **卡片折叠架构**：全网格卡片支持独立收起/展开，支持一键批量折叠，极简呈现。

### 3. 海斗锻体额外属性（属性砧木系统）
支持在装备装配之外，模拟局内海斗锻体（属性砧木）获得的纯额外属性，全链路参与被动放大：
* **海斗锻体额外攻速 (%)**：经术师转化为常规技能急速。
* **海斗锻体额外法强 (AP)**：受帽子（+30%）、火炬（+4%~20%）、物转法（+15%）放大后，经尤里卡以 30% 比例注入技能急速池。
* **海斗锻体额外攻击力 (AD)**：经物转法等额转为基础法强并触发增益放大。

### 4. 英雄战术装备库（12 件核心装备深度联动）
* **6 格已装备栏展示**：支持卡片独立折叠、一键折叠、点击格位快捷卸下与一键清空。
* **装备分类筛选**：全部装备、🔮 法术/急速、⚡ 攻速/联动、🏹 物理/大招、👟 鞋子系列。
* **装备专属被动机制联动**：
  * **残疫 (Malignance)**：提供 +20 专属终极技能急速，独立加算大招等效 CDR。
  * **帝国指令 (Imperial Mandate)**：+60 AP、+20 AH。寒冰大招附带定身控制效果，完美触发协同特化被动，额外获得 +20 技能急速（共计提供 40 AH）。
  * **灭世者的死亡之帽 (Rabadon's Deathcap)**：被动提升 30% 总法术强度。
  * **黯炎火炬 (Blackfire Torch)**：邪焰灼烧每个敌方英雄提供 4% 法强加成（最高 5 人 +20% 法强）。
  * **巫妖之祸 (Lich Bane)**：支持开启咒刃爆发开关，施法后瞬间触发 +50% 攻速，在术师下瞬时爆发 +32.5 技能急速。
  * **纳什之牙 (Nashor's Tooth)**：提供 +50% 攻速，术师机制下直接转为 +32.5 技能急速。
  * **大天使之杖 (Archangel's Staff)**：+80 AP、+600 法力值、+25 急速。
  * **兰德里的折磨 (Liandry's Torment)**：+70 AP、+300 生命值、2% 最大生命值灼烧。
  * **星界驱驰 / 影焰 / 虚空之杖 / 明朗之靴 / 赛瑞尔达的怨恨**：提供基础急速与对应属性加成。

### 5. 实时急速池与战术拆解（侧边抽屉面板）
* 点击主界面快捷卡片即可从右侧平滑展开抽屉，支持 ESC 键、点击遮罩或关闭按钮收起。
* 全息拆解装备与符文基础急速、术师攻速转化、尤里卡法强转化、缩小引擎层数、无限循环往复成长与残疫终极大招专属急速。

### 6. 终极大招全息伤害推演
* 综合基础技能伤害与法强加成倍率，实时计算单次爆发伤害。
* 针对死歌安魂曲提供单体爆发与 5 人全图总和双重遥测。
* 明确标注免责说明：`表面伤害模拟计算可能有误差，以实际对局为准`。

---

## 数学计算模型

### 1. 冷却缩减与技能急速换算
对于常规技能急速 $H$、专属独立急速 $X$、术师加算冷却缩减 $S$（默认 10%）：

$$C = \text{clamp}\left(\frac{H + X}{100 + H + X} + S, 0, 1\right)$$

实际冷却时间 $T$ 与另一技能返还值 $F$（大法师比例 $M = 30\%$）：

$$T_A = B_A \times (1 - C_A), \quad F_A = B_B \times M$$

互刷达标充要条件为两技能剩余冷却时间均归零：

$$L_A = \max(0, T_A - F_A) \le 10^{-8}, \quad L_B = \max(0, T_B - F_B) \le 10^{-8}$$

### 2. 最低互刷急速逆向解析
求解使 $T_A \le F_A$ 且 $T_B \le F_B$ 的理论最低常规急速：

$$q_A = 1 - \frac{B_B \times M}{B_A} - S$$

$$\text{need}_A = \begin{cases} 0 & q_A \le 0 \\ \infty & q_A \ge 1 \\ \max\left(0, \frac{100 \times q_A}{1 - q_A} - X_A\right) & 0 < q_A < 1 \end{cases}$$

$$H_{\text{required}} = \lceil \max(\text{need}_A, \text{need}_B) \rceil$$

### 3. 法强复合放大与尤里卡转化
$$\text{AP}_{\text{total}} = (\text{AP}_{\text{items}} + \text{AP}_{\text{anvil}} + \text{AD}_{\text{total}} \times 1.0) \times (1 + P_{\text{rabadon}} + P_{\text{torch}} + P_{\text{adapt}})$$

$$\text{Haste}_{\text{eureka}} = \text{AP}_{\text{total}} \times 30\%$$

---

## 本地启动与开发

环境要求：Linux Node.js **22.8+**（推荐 Node.js 24 LTS）与 npm。在 WSL 或 Linux 环境中运行：

```bash
# 1. 克隆代码仓库
git clone https://github.com/chansanya/LOL-Ultimate-CD-Calculator.git
cd LOL-Ultimate-CD-Calculator

# 2. 安装依赖并启动本地开发模拟
npm ci
npm run dev
```

浏览器打开 `http://localhost:8787` 即可体验。`dev` 脚本使用本地 Wrangler 模拟器运行，不向远端发送任何请求。

若 WSL 提示找不到 Node 或调用了 Windows 版，可将 Linux Node 加入当前终端路径：
```bash
export PATH=/home/dev/workspace/node24.11.1/bin:$PATH
```

---

## 构建与测试验证

```bash
npm test          # 构建 + 纯函数计算、加点表格、装备联动与 Pages 交付测试
npm run build     # 编译 CSS / JS，校验 CSP 散列，生成 dist/ 静态目录
npm run check     # 全套测试 + 部署预检
```

* **测试框架**：基于 Node.js 原生 `node:test`，无外部断言库依赖，共计 112 项验收测试 100% 通过。
* **安全交付**：构建生成的 `dist/` 包含经过严格散列校验的 Content-Security-Policy (CSP) `_headers`，禁止一切未授权外部脚本注入与跨域请求。

---

## Cloudflare Pages 部署指引

Cloudflare Pages 是专门面向前端静态站点的全球托管平台，**完全不限访问次数与带宽**。

> **特别说明**：形如 `deploy.workers.cloudflare.com` 的外链 Deploy 按钮是 Cloudflare 专用于 Worker 产品的（所以点开才会显示“配置 Worker 项目”）。Pages 项目官方目前不提供类似的外链一键克隆服务，需在控制台直接关联仓库，只需操作一次，以后自动同步更新。

### 部署操作步骤

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)；
2. 在左侧菜单点击 **Workers 和 Pages (Workers & Pages)**；
3. 点击右侧的 **创建 (Create application)** 按钮；
4. **务必切换到「Pages」选项卡**（不要停留在默认的 Workers 选项卡）-> 点击 **连接到 Git (Connect to Git)**；
5. 在列表里直接勾选你的 GitHub 仓库：`chansanya/LOL-Ultimate-CD-Calculator`，点击「开始设置」；
6. 在配置表单中填写：
   * **项目名称**：自定义（如 `lol-ultimate-cd-calculator`）
   * **生产分支**：`main`
   * **框架预设**：选择 **None**
   * **构建命令**：`npm run build`
   * **构建输出目录**：`dist`
   * **根目录**：留空（即默认的 `/`）
7. 环境变量与绑定：**无需配置，直接留空**；
8. 点击底部的 **保存并部署 (Save and Deploy)** 按钮。

数十秒后即可完成全球多区域 CDN 节点分发，并获得专属的 `*.pages.dev` 访问链接。以后每次向 `main` 分支执行 `git push`，Cloudflare Pages 将自动触发增量构建并极速上线！

---

## 目录结构

```text
├── .github/workflows/ci.yml # GitHub Actions 自动化测试与打包检查
├── dist/                    # Cloudflare Pages 静态产物目录（含 index.html 与 _headers 安全头）
├── public/                  # 静态资源与离线图标库
│   ├── augments/            # 海克斯强化官方图标
│   ├── champions/           # 英雄原画头像
│   └── items/               # 战术装备官方图标
├── src/
│   ├── data/
│   │   ├── augments.js      # 海克斯数据定义与比例系数
│   │   ├── heroes.js        # 英雄技能数据与基础冷却
│   │   └── items.js         # 战术装备库属性与被动定义
│   ├── engine.js            # 纯数学计算引擎与阈值推演
│   ├── index.html           # 全息战术终端 HTML 架构
│   ├── styles.css           # 赛博冰蓝主题与动效样式
│   ├── ui.js                # 原生 DOM 响应式交互与事件总线
│   └── worker.js            # Cloudflare Worker 请求处理工厂
├── tests/
│   ├── engine.test.js       # 规范验收、边界防护与联动推演测试
│   └── worker.test.js       # Pages 静态交付、Worker 响应头与 CSP 安全测试
├── scripts/build.mjs        # 打包器：同时生成 dist/ (Pages) 与 worker.js (Workers)
├── worker.js                # Workers 单文件交付产物（可直接独立部署）
├── wrangler.toml            # Cloudflare Workers 项目配置
└── README.md                # 项目文档
```

---

## 协议与免责声明

* **开源协议**：本项目基于 MIT License 开放。Lucide 图标遵循 ISC License。
* **免责声明**：本工具为英雄联盟玩家社区非官方研制的战术推演工具，与 Riot Games 或 腾讯游戏 无官方关联。League of Legends 及其相关素材版权均归 Riot Games, Inc. 所有。
