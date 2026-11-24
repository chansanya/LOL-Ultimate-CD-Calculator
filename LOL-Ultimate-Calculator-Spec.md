# LOL 大招流计算器 — 开发需求与计算规范

## 1. 项目目标
构建一个可部署到 Cloudflare Workers 的 LOL 海克斯大招流计算网站。首期实现寒冰射手 E/R 互刷及任意双技能冷却计算，支持扩展英雄、技能和海克斯效果。本文可直接交给 Codex 作为开发任务说明。

## 2. 技术与交付要求
- 单文件 `worker.js`，ES Module，`export default { async fetch(request, env, ctx) { ... } }`。
- Worker 返回 HTML，内嵌 CSS/JS；Content-Type: text/html; charset=utf-8。首期无需数据库、框架或外部 API。
- 计算引擎与 UI 分离，纯函数可独立测试；所有输入变化实时更新，无需请求后端。
- 深色冰蓝主题，桌面/移动端适配，中文界面。
- 提供 wrangler.toml、README、计算单元测试；已有 Worker 部署前检查远端 routes、vars 等配置，不擅自覆盖。

## 3. 数据与机制假设
以下数据来自本次讨论及用户提供的技能截图，未独立核验游戏版本。术士按用户确认采用加算；大法师按释放技能的基础 CD 返还给另一技能的模型计算。游戏内目标选择、充能和施放间隔仍需实测。网站不得将理论阈值标为已验证无限施放。

| 技能 | 名称 | 各等级基础 CD（秒） | 备注 |
|---|---|---|---|
| Q | 射手的专注 | 0 | 普攻叠满4层后释放，不纳入普通CD互刷模型 |
| W | 万箭齐发 | 18 / 14.5 / 11 / 7.5 / 4 | 普通技能 |
| E | 鹰击长空 | 90 / 80 / 70 / 60 / 50 | 充能时间；最多2层；施放间隔5秒 |
| R | 魔法水晶箭 | 100 / 80 / 60 | 大招 |

大法师 M=0.30；术士 S=0.10（关闭时为0）。两者可配置，比例内部统一使用小数。

## 4. 公式规范
符号：B_A/B_B 为基础 CD（秒）；H 为通用技能急速；X_A/X_B 为独立技能急速（例如大招急速）；M 为返还比例；S 为加算冷却缩减。

```text
CDR(H) = H / (100 + H)
H(C) = 100*C / (1-C)  （0 <= C < 1）
C_i = clamp(CDR(H + X_i) + S, 0, 1)
T_i = B_i * (1 - C_i)
F_A = B_B * M   # A 获得的返还，来源 B
F_B = B_A * M   # B 获得的返还，来源 A
L_i = max(0, T_i - F_i)
```
互刷理论条件：L_A = L_B = 0。无独立急速时：

```text
C_required = max(0, 1 - M * min(B_A,B_B)/max(B_A,B_B))
C_haste = max(0, C_required - S)
H_required = ceil(100*C_haste/(1-C_haste))
```
存在独立急速时分别求解：

```text
q_i = 1 - F_i/B_i - S
need_i = 0                         if q_i <= 0
need_i = Infinity                  if q_i >= 1
need_i = max(0, 100*q_i/(1-q_i)-X_i) otherwise
H_required = ceil(max(need_A, need_B))
```
等基础 CD 时，无术士需要 70% 急速换算冷却缩减（233.333... 急速，整数234）；有术士需要60%（150急速），综合均至少70%。

## 5. 参考计算引擎（JavaScript）
```js
function calculateCooldown({baseA=80,baseB=80,haste=150,
  extraHasteA=0,extraHasteB=0,archmage=.3,sorcerer=.1}={}) {
  const vals=[baseA,baseB,haste,extraHasteA,extraHasteB,archmage,sorcerer];
  if (!vals.every(Number.isFinite) || baseA<=0 || baseB<=0 ||
      [haste,extraHasteA,extraHasteB].some(x=>x<0) ||
      [archmage,sorcerer].some(x=>x<0||x>1)) throw new RangeError('Invalid input');
  const cdr=x=>Math.min(1,x/(100+x)+sorcerer);
  const cdrA=cdr(haste+extraHasteA), cdrB=cdr(haste+extraHasteB);
  const cdA=baseA*(1-cdrA), cdB=baseB*(1-cdrB);
  const refundA=baseB*archmage, refundB=baseA*archmage;
  const remainA=Math.max(0,cdA-refundA), remainB=Math.max(0,cdB-refundB);
  function need(base,refund,extra) {
    const q=1-refund/base-sorcerer;
    return q<=0?0:q>=1?Infinity:Math.max(0,100*q/(1-q)-extra);
  }
  const minHaste=Math.ceil(Math.max(need(baseA,refundA,extraHasteA),
    need(baseB,refundB,extraHasteB))-1e-9);
  return {cdrA,cdrB,cdA,cdB,refundA,refundB,remainA,remainB,minHaste,
    theoreticalLoop:remainA<=1e-8&&remainB<=1e-8};
}
```

## 6. 寒冰预设与验收数据
默认 2E+2R、150急速、大法师开启、术士开启、独立急速0。以下阈值按公式向上取整。

| E等级 | R等级 | E CD | R CD | 无术士 | 有术士 |
|---|---|---|---|---|---|
| 1 | 1 | 90 | 100 | 271 | 171 |
| 1 | 2 | 90 | 80 | 275 | 173 |
| 1 | 3 | 90 | 60 | 400 | 234 |
| 2 | 1 | 80 | 100 | 317 | 195 |
| 2 | 2 | 80 | 80 | 234 | 150 |
| 2 | 3 | 80 | 60 | 345 | 208 |
| 3 | 1 | 70 | 100 | 377 | 223 |
| 3 | 2 | 70 | 80 | 281 | 176 |
| 3 | 3 | 70 | 60 | 289 | 180 |
| 4 | 1 | 60 | 100 | 456 | 258 |
| 4 | 2 | 60 | 80 | 345 | 208 |
| 4 | 3 | 60 | 60 | 234 | 150 |
| 5 | 1 | 50 | 100 | 567 | 300 |
| 5 | 2 | 50 | 80 | 434 | 248 |
| 5 | 3 | 50 | 60 | 300 | 186 |

推荐 2E+2R（均80秒），后期4E+3R（均60秒）。前者150急速+术士时实际CD和返还均24秒；后者均18秒。注意同步加点过程中可能暂时破坏互刷条件。

## 7. 页面功能
- 英雄选择：寒冰预设、自定义英雄；技能名称、等级及基础CD可编辑，自定义技能不限制为E/R。
- 通用急速：滑块（0–500）及数字输入（允许超过500）；独立急速分别输入。
- 海克斯：大法师、术士开关及百分比输入；关闭对应比例为0。
- 输出：每个技能的基础CD、有效急速、综合CDR、实际CD、获得返还、剩余CD；最低通用急速及差额；一键应用最低急速。
- 冷却条：冷却缩减部分、有效返还部分（不超过实际CD）、剩余CD；图例及数值。理论达标用绿色，未达标用橙色。
- ER 双向流程图，明确释放E返还R、释放R返还E。
- 加点对照表、公式说明、机制免责声明。显示小数两位，计算过程不提前舍入。
- Infinity 显示“无有限急速解”，禁用一键应用；拒绝空值、负数、零基础CD及非法比例，不显示 NaN。

## 8. 验收测试
- 80/80，M=.3，S=.1，H=150：CD=24/24，返还24/24，剩余0/0，最低150，达标。
- 同上 H=149：未达标；S=0 时 H=233 未达标，234 达标。
- 60/60，M=.3，S=.1，H=150：CD=18/18，剩余0/0。
- 80/60，M=.3，S=.1：最低208；交换A/B阈值不变。
- 80/80，M=.3，S=.1，X_A=0，X_B=50：最低仍150；两者均50则最低100。
- M=0、S=0：无有限急速解；非法输入给出明确错误。
- 所有表格组合：最低整数急速应达标，低1点应未达标。

## 9. 后续扩展与边界
英雄数据与海克斯配置使用独立对象，便于新增版本、来源和验证状态。未来可加入多个技能、返还目标选择、施法耗时、充能恢复、最短施放间隔及事件驱动时间轴模拟；这些不属于首期静态双技能计算模型。E的5秒施放间隔、Q/W可能抢占返还、实际冷却返还目标和游戏版本均需实测，不能由本公式推断。

## 10. 给 Codex 的执行要求
以本文为计算与验收规范，先实现纯函数和测试，再实现 UI 和 Worker 入口。若现有项目已存在，先检查目录与配置，复用可用代码，不覆盖无关配置。完成后运行测试及本地 Wrangler 调试，给出变更清单、启动和部署命令。未经用户确认不直接部署生产环境。
