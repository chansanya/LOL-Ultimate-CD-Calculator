import { createElement, Snowflake, RotateCcw, Zap, Shield, Sparkles, SlidersHorizontal } from 'lucide';
import { calculateCooldown, calculateMayhemHaste, calculateEquipmentStats, calculateUltimateDamage } from './engine.js';
import { HEROES } from './data/heroes.js';
import { ITEMS, ITEM_CATEGORIES } from './data/items.js';

const icons = {
  snowflake: Snowflake,
  'rotate-ccw': RotateCcw,
  zap: Zap,
  shield: Shield,
  sparkles: Sparkles,
  'sliders-horizontal': SlidersHorizontal,
};

const $ = (id) => document.getElementById(id);

let heroKey = 'ashe';
let rankA = 2; // 艾希 E
let rankB = 2; // 艾希 R
let rankUlt = 3; // 死歌 / 船长 默认 3 级大招
let selectedItems = [];
let activeItemCategory = 'all';
let isAllItemsCollapsed = false;
const collapsedItemIds = new Set();
let isAllAugmentsCollapsed = false;

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const icon = icons[element.dataset.icon];
    if (icon && !element.firstElementChild) {
      element.replaceChildren(createElement(icon, { 'aria-hidden': 'true', focusable: 'false' }));
    }
  });
}

function getHero() {
  return HEROES[heroKey] || HEROES.ashe;
}

function renderHeroUI() {
  const isAshe = heroKey === 'ashe';
  const hero = getHero();

  // 更新导航 Tabs 状态
  document.querySelectorAll('.hero-tab').forEach((tab) => {
    const active = tab.dataset.hero === heroKey;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  $('archmage-bar').hidden = !isAshe;
  $('preset-chips').hidden = !isAshe;
  $('ashe-skills-grid').hidden = !isAshe;
  $('ult-focus-grid').hidden = isAshe;
  $('breakdown-malignance-row').hidden = isAshe;

  if (isAshe) {
    const contA = $('ranks-skill-a');
    const contB = $('ranks-skill-b');
    const cdsE = hero.skills.E.baseCooldowns;
    const cdsR = hero.skills.R.baseCooldowns;

    $('disp-skill-a-cd').textContent = String(cdsE[rankA - 1] || cdsE[0]);
    $('disp-skill-b-cd').textContent = String(cdsR[rankB - 1] || cdsR[0]);

    contA.innerHTML = cdsE.map((_, idx) => {
      const r = idx + 1;
      return `<button type="button" data-rank="${r}" class="rank-pill ${r === rankA ? 'active' : ''}">${r}</button>`;
    }).join('');

    contB.innerHTML = cdsR.map((_, idx) => {
      const r = idx + 1;
      return `<button type="button" data-rank="${r}" class="rank-pill ${r === rankB ? 'active' : ''}">${r}</button>`;
    }).join('');

    contA.querySelectorAll('.rank-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        rankA = Number(btn.dataset.rank);
        renderHeroUI();
        update();
      });
    });

    contB.querySelectorAll('.rank-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        rankB = Number(btn.dataset.rank);
        renderHeroUI();
        update();
      });
    });

    $('chip-2e2r')?.classList.toggle('active', rankA === 2 && rankB === 2);
    $('chip-4e3r')?.classList.toggle('active', rankA === 4 && rankB === 3);
  } else {
    // 死歌 / 船长 聚焦大招 R 选择
    $('ult-hero-tag').textContent = hero.name;
    $('disp-ult-name').textContent = `R ${hero.skills.R.name}`;
    const cdsR = hero.skills.R.baseCooldowns;
    const contUlt = $('ranks-ult-only');
    const currentR = cdsR[Math.min(rankUlt - 1, cdsR.length - 1)] || cdsR[0];
    $('disp-ult-base-cd').textContent = String(currentR);

    contUlt.innerHTML = cdsR.map((cd, idx) => {
      const r = idx + 1;
      return `<button type="button" data-rank="${r}" class="rank-pill ${r === rankUlt ? 'active' : ''}">${r} 级 · ${cd}s</button>`;
    }).join('');

    contUlt.querySelectorAll('.rank-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        rankUlt = Number(btn.dataset.rank);
        renderHeroUI();
        update();
      });
    });
  }

  $('hero-tip-note').textContent = hero.tip || '';
}

// 渲染 6 格已装备栏
function renderInventorySlots() {
  const container = $('inventory-slots');
  const countEl = $('disp-item-count');
  countEl.textContent = selectedItems.length >= 6
    ? '已选 6 / 6 件 · 已满含鞋子'
    : `已选 ${selectedItems.length} / 6 件含鞋子`;
  countEl.classList.toggle('text-amber', selectedItems.length >= 6);

  const slotsHtml = [];
  for (let i = 0; i < 6; i += 1) {
    const itemId = selectedItems[i];
    if (itemId && ITEMS[itemId]) {
      const item = ITEMS[itemId];
      slotsHtml.push(`
        <div class="inv-slot filled" data-index="${i}" data-id="${itemId}" title="点击卸下 ${item.name}">
          <img class="inv-slot-img" src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';">
          <span class="inv-slot-icon" style="display:none">${item.icon}</span>
          <span class="inv-slot-name">${item.name.split(' ')[0]}</span>
          <span class="inv-slot-remove-badge">✕</span>
        </div>
      `);
    } else {
      slotsHtml.push(`
        <div class="inv-slot empty" title="空装备槽位">
          <span>+ 空格</span>
        </div>
      `);
    }
  }
  container.innerHTML = slotsHtml.join('');

  container.querySelectorAll('.inv-slot.filled').forEach((slot) => {
    slot.addEventListener('click', () => {
      const idx = Number(slot.dataset.index);
      selectedItems.splice(idx, 1);
      renderInventorySlots();
      renderItemsPicker();
      update();
    });
  });
}

// 渲染可选装备卡片库
function renderItemsPicker() {
  const container = $('items-picker-grid');
  const items = Object.values(ITEMS);
  const filtered = activeItemCategory === 'all'
    ? items
    : items.filter((it) => it.category === activeItemCategory);

  container.innerHTML = filtered.map((item) => {
    const isEquipped = selectedItems.includes(item.id);
    const isCollapsed = isAllItemsCollapsed || collapsedItemIds.has(item.id);
    const statTags = [];
    if (item.ah) statTags.push(`<span class="stat-tag tag-ah">+${item.ah} AH</span>`);
    if (item.basicAh) statTags.push(`<span class="stat-tag tag-basic">+${item.basicAh} 基础AH</span>`);
    if (item.mandateCcAh) statTags.push(`<span class="stat-tag tag-ah">控制协同 +${item.mandateCcAh} AH</span>`);
    if (item.as) statTags.push(`<span class="stat-tag tag-as">+${item.as}% 攻速</span>`);
    if (item.ap) statTags.push(`<span class="stat-tag tag-ap">+${item.ap} AP</span>`);
    if (item.ad) statTags.push(`<span class="stat-tag tag-ad">+${item.ad} AD</span>`);
    if (item.ultAh) statTags.push(`<span class="stat-tag tag-ult">+${item.ultAh} 大招AH</span>`);

    return `
      <div class="item-card ${isEquipped ? 'equipped' : ''} ${isCollapsed ? 'collapsed' : ''}" data-id="${item.id}" role="button" tabindex="0">
        <div class="item-card-top">
          <div class="item-card-header">
            <img class="item-card-img" src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';">
            <span class="item-card-icon" style="display:none">${item.icon}</span>
            <span class="item-card-title">${item.name}</span>
          </div>
          <div class="item-card-actions">
            <span class="item-card-badge">${isEquipped ? '已穿戴' : '穿戴'}</span>
            <button type="button" class="btn-item-fold" data-id="${item.id}" aria-label="折叠或展开装备卡片" title="折叠或展开">▾</button>
          </div>
        </div>
        <div class="item-card-stats">
          ${statTags.join('')}
        </div>
        <p class="item-card-note">${item.note}</p>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-item-fold').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (collapsedItemIds.has(id)) {
        collapsedItemIds.delete(id);
      } else {
        collapsedItemIds.add(id);
      }
      const card = btn.closest('.item-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  container.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-item-fold')) return;
      const id = card.dataset.id;
      const itemToEquip = ITEMS[id];
      const idx = selectedItems.indexOf(id);
      if (idx >= 0) {
        selectedItems.splice(idx, 1);
      } else {
        // 如果是鞋子，英雄只能穿戴一双鞋，自动替换已有鞋子
        if (itemToEquip?.category === 'boots') {
          const existingBootIdx = selectedItems.findIndex((itId) => ITEMS[itId]?.category === 'boots');
          if (existingBootIdx >= 0) {
            selectedItems[existingBootIdx] = id;
            renderInventorySlots();
            renderItemsPicker();
            update();
            return;
          }
        }
        // 加鞋子在内严格只能选 6 件
        if (selectedItems.length >= 6) {
          const invContainer = document.querySelector('.inventory-slots-container');
          if (invContainer) {
            invContainer.classList.remove('flash-full');
            void invContainer.offsetWidth;
            invContainer.classList.add('flash-full');
          }
          const countEl = $('disp-item-count');
          countEl.textContent = '已满 6 件含鞋子 · 请点击格位卸下';
          countEl.classList.add('text-amber');
          return;
        }
        selectedItems.push(id);
      }
      renderInventorySlots();
      renderItemsPicker();
      update();
    });
  });
}

let lastAnnouncement = '';
let currentCalcResult = null;

function update() {
  try {
    const hero = getHero();

    // 1. 装备属性与海斗锻体属性汇总计算与被动联动
    const isLichActive = $('chk-lich-spellblade')?.checked || false;
    const isAdaptActive = $('chk-adapt')?.checked || false;
    const isCrownActive = $('chk-crown')?.checked || false;
    const crownStacks = Math.max(0, Number($('num-crown-stacks')?.value) || 0);
    const torchStacks = Math.max(0, Math.min(5, Number($('num-torch-stacks')?.value) || 0));

    // 读取海斗锻体与海克斯滑块属性并同步显示数值
    const sliderIds = ['num-extra-as', 'num-extra-ap', 'num-extra-ad', 'num-shrink-stacks', 'num-recursion-kills', 'num-crown-stacks'];
    sliderIds.forEach((id) => {
      const el = $(id);
      const disp = $(`disp-${id}`);
      if (el && disp) disp.textContent = el.value;
    });

    const anvilAs = Math.max(0, Number($('num-extra-as')?.value) || 0);
    const anvilAp = Math.max(0, Number($('num-extra-ap')?.value) || 0);
    const anvilAd = Math.max(0, Number($('num-extra-ad')?.value) || 0);

    const isCcHero = heroKey === 'ashe';
    const isMandateCcActive = isCcHero && ($('chk-mandate-cc') ? $('chk-mandate-cc').checked : true);

    const equipStats = calculateEquipmentStats(selectedItems, {
      heroKey,
      lichBaneActive: isLichActive,
      adaptActive: isAdaptActive,
      heavyCrownActive: isCrownActive,
      heavyCrownStacks: crownStacks,
      torchStacks,
      mandateCcActive: isMandateCcActive,
      anvilAs,
      anvilAp,
      anvilAd,
    });

    // 显示/隐藏巫妖之祸咒刃开关
    $('lich-spellblade-box').hidden = !equipStats.hasLichBane;

    // 显示/隐藏黯炎火炬被动开关
    if ($('torch-stacks-box')) {
      $('torch-stacks-box').hidden = !equipStats.hasTorch;
      if ($('disp-torch-ap-bonus')) {
        $('disp-torch-ap-bonus').textContent = `+${torchStacks * 4}% 法强`;
      }
    }

    // 显示/隐藏帝国指令寒冰控制特化开关（死歌与船长大招无控制，不显示亦不触发）
    if ($('mandate-cc-box')) {
      $('mandate-cc-box').hidden = !equipStats.hasImperialMandate || !isCcHero;
    }

    // 更新装备汇总条
    $('sum-item-ah').textContent = `+${equipStats.baseAh} AH`;
    $('sum-item-as').textContent = `+${equipStats.totalAs}% AS`;
    $('sum-item-ap').textContent = `+${equipStats.totalAp} AP`;
    $('sum-item-ult-ah').textContent = `+${equipStats.ultAh} AH`;

    // 2. 读取海克斯机制并进行转化计算
    const puristCaster = $('chk-purist').checked;
    const totalAs = equipStats.totalAs;

    const eureka = $('chk-eureka').checked;
    const totalAp = equipStats.totalAp;

    const shrinkEngine = $('chk-shrink').checked;
    const shrinkStacks = Math.max(0, Number($('num-shrink-stacks').value) || 0);

    const infiniteRecursion = $('chk-recursion').checked;
    const kills = Math.max(0, Number($('num-recursion-kills').value) || 0);

    const archmage = heroKey === 'ashe' && $('chk-archmage').checked;

    // 基础技能急速严格来自装备，无需额外手动滑块补偿
    const baseHaste = Math.min(500, equipStats.baseAh);

    // 动态标签更新（详细展示装备、锻体与符文装备被动放大明细）
    if ($('tag-purist-bonus')) {
      $('tag-purist-bonus').textContent = anvilAs > 0 || (isCrownActive && crownStacks > 0)
        ? `装备 ${equipStats.rawAs}% + 锻体 ${anvilAs}%${isCrownActive && crownStacks > 0 ? ` · 王冠 +${(crownStacks * 5)}%` : ''} ➔ 攻速 ${equipStats.totalAs}% ➔ 转化 +${(totalAs * 0.65).toFixed(1)} AH`
        : `装备攻速 ${equipStats.totalAs}% ➔ 转化 +${(totalAs * 0.65).toFixed(1)} AH`;
    }
    if ($('tag-eureka-bonus')) {
      $('tag-eureka-bonus').textContent = equipStats.apMultiplier > 1 || anvilAp > 0 || (isCrownActive && crownStacks > 0)
        ? `基础 ${equipStats.totalRawAp} AP${isCrownActive && crownStacks > 0 ? ` · 王冠 +${(crownStacks * 5)}%` : ''} · 放大 ${equipStats.apMultiplier.toFixed(2)}x ➔ 最终 ${totalAp} AP ➔ 转化 +${(totalAp * 0.3).toFixed(1)} AH`
        : `装备法强 ${totalAp} AP ➔ 转化 +${(totalAp * 0.3).toFixed(1)} AH`;
    }
    $('tag-shrink-bonus').textContent = `当前层数提供: +${shrinkStacks * 10} AH`;
    $('tag-recursion-bonus').textContent = `当前提供: +${infiniteRecursion ? 60 + kills * 3 : 0} AH`;
    if ($('tag-adapt-bonus')) {
      $('tag-adapt-bonus').textContent = anvilAd > 0 || (isCrownActive && crownStacks > 0)
        ? `装备 ${equipStats.rawAd} AD + 锻体 ${anvilAd} AD${isCrownActive && crownStacks > 0 ? ` · 王冠 +${(crownStacks * 5)}%` : ''} ➔ 转为法强 +${Math.round(equipStats.adConvertedAp)} AP`
        : `装备攻击力 ${equipStats.rawAd} AD ➔ 转为法强 +${Math.round(equipStats.adConvertedAp)} AP`;
    }
    if ($('tag-crown-bonus')) {
      const pct = (crownStacks * 5).toFixed(0);
      $('tag-crown-bonus').textContent = isCrownActive
        ? `【背负】${crownStacks} 层 ➔ 额外3属性提升 +${pct}% (AD/AP/AS)`
        : `未启用 · 每层击杀参与 +5% 额外3属性`;
    }

    // 3. 计算海克斯大乱斗增益急速与加算 CDR
    const asHaste = puristCaster ? totalAs * 0.65 : 0;
    const apHaste = eureka ? totalAp * 0.3 : 0;
    const shrinkHaste = shrinkEngine ? shrinkStacks * 10 : 0;
    const recursionHaste = infiniteRecursion ? 60 + kills * 3 : 0;

    const { bonusHaste, totalHaste: rawTotalHaste, bonusCdr } = calculateMayhemHaste({
      baseHaste,
      puristCaster,
      attackSpeed: totalAs,
      eureka,
      ap: totalAp,
      shrinkEngine,
      shrinkStacks,
      infiniteRecursion,
      kills,
    });

    // 技能急速最大值限制为 500 AH
    const totalHaste = Math.min(500, rawTotalHaste);
    const totalUltHaste = Math.min(500, totalHaste + equipStats.ultAh);

    $('lbl-aug-bonus').textContent = `+${Math.round(bonusHaste)} 强化急速注入`;

    // 全息急速池分解更新
    $('breakdown-base-val').textContent = `${Math.round(baseHaste)} AH · 装备提供基础急速`;
    $('breakdown-as-val').textContent = `+${asHaste.toFixed(1)} AH`;
    $('breakdown-ap-val').textContent = `+${apHaste.toFixed(1)} AH`;
    $('breakdown-shrink-val').textContent = `+${shrinkHaste.toFixed(1)} AH`;
    $('breakdown-recursion-val').textContent = `+${recursionHaste.toFixed(1)} AH`;
    $('breakdown-malignance-val').textContent = `+${equipStats.ultAh.toFixed(1)} AH`;
    $('breakdown-malignance-row').hidden = equipStats.ultAh <= 0;
    if ($('breakdown-mandate-row')) {
      $('breakdown-mandate-row').hidden = !equipStats.mandateCcActive || !isCcHero;
      if ($('breakdown-mandate-val')) {
        $('breakdown-mandate-val').textContent = `+${(equipStats.mandateCcBonus || 0).toFixed(1)} AH`;
      }
    }
    if ($('breakdown-basic-row')) {
      $('breakdown-basic-row').hidden = equipStats.basicAh <= 0;
      if ($('breakdown-basic-val')) {
        $('breakdown-basic-val').textContent = `+${equipStats.basicAh.toFixed(1)} AH`;
      }
    }
    $('breakdown-total-val').textContent = `${Math.round(totalHaste)} AH`;
    $('breakdown-ult-val').textContent = `${Math.round(totalUltHaste)} AH`;

    const card = $('card-verdict');
    const badge = $('status-badge');
    const statusText = $('status-text');

    if (heroKey === 'ashe') {
      // 1. 寒冰射手：双技能对向互刷推演
      const cdsE = hero.skills.E.baseCooldowns;
      const cdsR = hero.skills.R.baseCooldowns;
      const baseA = cdsE[rankA - 1] || cdsE[0];
      const baseB = cdsR[rankB - 1] || cdsR[0];

      const archRatio = archmage ? 0.3 : 0;
      const calcResult = calculateCooldown({
        baseA,
        baseB,
        haste: totalHaste,
        extraHasteA: equipStats.basicAh || 0,
        extraHasteB: equipStats.ultAh || 0,
        archmage: archRatio,
        sorcerer: bonusCdr,
      });

      currentCalcResult = calcResult;
      const isLoop = calcResult.theoreticalLoop;
      const isFinite = Number.isFinite(calcResult.minHaste);
      // 技能急速最大值为 500 AH，超过 500 AH 则判定为当前机制下不可达成
      const isAchievable = isFinite && calcResult.minHaste <= 500;

      $('disp-total-cdr-badge').textContent = `综合 CDR: ${(calcResult.cdrA * 100).toFixed(1)}%`;
      if ($('disp-entry-sub')) {
        const parts = [];
        if (equipStats.basicAh > 0) parts.push(`E基础 +${equipStats.basicAh} AH`);
        if (equipStats.ultAh > 0) parts.push(`大招 +${Math.round(totalUltHaste)} AH`);
        const partText = parts.length > 0 ? ` · ${parts.join(' · ')}` : ` · 大招 ${Math.round(totalUltHaste)} AH`;
        $('disp-entry-sub').textContent = `当前常规 ${Math.round(totalHaste)} AH${partText} · 综合 CDR ${(calcResult.cdrA * 100).toFixed(1)}%`;
      }

      if (!archmage) {
        // 未勾选大法师：不进行互刷返还，直接展示当前急速下的双技能最终实际冷却与压缩幅度
        $('label-stat-1').textContent = '当前技能急速 / 大招急速';
        $('val-stat-1').innerHTML = `<span class="dual-haste">${Math.round(totalHaste)} / ${Math.round(totalUltHaste)}</span><span class="number-unit">AH</span>`;
        $('sub-stat-1').className = 'block-sub text-muted';
        const parts = [];
        if (equipStats.basicAh > 0) parts.push(`E基础专属 +${equipStats.basicAh} AH`);
        if (equipStats.ultAh > 0) parts.push(`大招专属 +${equipStats.ultAh} AH`);
        $('sub-stat-1').textContent = parts.length > 0
          ? `常规 ${Math.round(totalHaste)} AH · ${parts.join(' · ')}`
          : '常规急速与大招急速一致';

        $('label-stat-2').textContent = 'E 鹰击长空 最终冷却';
        $('val-stat-2').innerHTML = `${calcResult.cdA.toFixed(1)}<span class="number-unit">s</span>`;
        $('sub-stat-2').className = 'block-sub text-emerald';
        $('sub-stat-2').textContent = `原基础 ${baseA}s ➔ 压缩 ${(baseA - calcResult.cdA).toFixed(1)}s`;

        $('label-stat-3').textContent = 'R 魔法水晶箭 最终冷却';
        $('val-stat-3').innerHTML = `${calcResult.cdB.toFixed(1)}<span class="number-unit">s</span>`;
        $('sub-stat-3').className = 'block-sub text-emerald';
        $('sub-stat-3').textContent = `原基础 ${baseB}s ➔ 压缩 ${(baseB - calcResult.cdB).toFixed(1)}s`;

        card.className = 'deck-card verdict-telemetry-card state-success';
        badge.className = 'verdict-status-pill pure-haste';
        statusText.textContent = `常规冷却模式 · 技能冷却压缩 ${(calcResult.cdrA * 100).toFixed(1)}%`;
      } else {
        // 勾选大法师：互刷对向返还推演模式
        // 指标 1：理论最低急速
        $('label-stat-1').textContent = '理论互刷最低急速';
        if (!isFinite) {
          $('val-stat-1').innerHTML = '无有限解';
        } else if (!isAchievable) {
          $('val-stat-1').innerHTML = '<span class="text-amber">无法达成</span>';
        } else {
          $('val-stat-1').innerHTML = `${calcResult.minHaste}<span class="number-unit">AH</span>`;
        }

        // 指标 2：E 剩余 CD
        $('label-stat-2').textContent = 'E 鹰击长空 互刷剩余';
        $('val-stat-2').innerHTML = `${calcResult.remainA.toFixed(1)}<span class="number-unit">s</span>`;
        $('sub-stat-2').className = 'block-sub text-muted';
        $('sub-stat-2').textContent = `实际 ${calcResult.cdA.toFixed(1)}s · 返还 ${(calcResult.refundA).toFixed(0)}s`;

        // 指标 3：R 剩余 CD
        $('label-stat-3').textContent = 'R 水晶箭 互刷剩余';
        $('val-stat-3').innerHTML = `${calcResult.remainB.toFixed(1)}<span class="number-unit">s</span>`;
        $('sub-stat-3').className = 'block-sub text-muted';
        $('sub-stat-3').textContent = `实际 ${calcResult.cdB.toFixed(1)}s · 返还 ${(calcResult.refundB).toFixed(0)}s`;

        if (isLoop) {
          card.className = 'deck-card verdict-telemetry-card state-success';
          badge.className = 'verdict-status-pill success';
          statusText.textContent = '已达成理论无限互刷！';
          $('sub-stat-1').className = 'block-sub text-emerald';
          $('sub-stat-1').textContent = `当前常规 ${Math.round(totalHaste)} AH · 大招 ${Math.round(totalUltHaste)} AH`;
        } else if (!isAchievable) {
          card.className = 'deck-card verdict-telemetry-card state-warning';
          badge.className = 'verdict-status-pill warning';
          statusText.textContent = '无法达成互刷 · 超出 500 急速上限';
          $('sub-stat-1').className = 'block-sub text-amber';
          $('sub-stat-1').textContent = isFinite ? `理论需 ${calcResult.minHaste} AH · 上限 500` : '无有限解';
        } else {
          const gap = Math.max(0, calcResult.minHaste - Math.round(totalHaste));
          card.className = 'deck-card verdict-telemetry-card state-warning';
          badge.className = 'verdict-status-pill warning';
          statusText.textContent = `未达成互刷 · 还差 ${gap} 急速`;
          $('sub-stat-1').className = 'block-sub text-amber';
          $('sub-stat-1').textContent = `常规 ${Math.round(totalHaste)} AH · 差 ${gap} AH 达成归零`;
        }
      }
    } else {
      // 2. 死歌 / 船长：专注大招 R 极限压缩
      const cdsR = hero.skills.R.baseCooldowns;
      const baseR = cdsR[Math.min(rankUlt - 1, cdsR.length - 1)] || cdsR[0];
      $('disp-ult-base-cd').textContent = String(baseR);

      // 终极技能专属急速（装备如残疫 +20 终极急速）
      const ultHaste = Math.min(500, totalHaste + equipStats.ultAh);
      const cdrUlt = Math.min(0.999, Math.max(0, ultHaste / (100 + ultHaste) + bonusCdr));
      const cdUlt = baseR * (1 - cdrUlt);
      const reducedSeconds = baseR - cdUlt;

      $('disp-total-cdr-badge').textContent = `大招综合 CDR: ${(cdrUlt * 100).toFixed(1)}%`;
      if ($('disp-entry-sub')) {
        $('disp-entry-sub').textContent = `当前常规 ${Math.round(totalHaste)} AH · 大招 ${Math.round(ultHaste)} AH · 综合 CDR ${(cdrUlt * 100).toFixed(1)}%`;
      }
      $('breakdown-total-val').textContent = `${Math.round(totalHaste)} AH`;
      $('breakdown-ult-val').textContent = `${Math.round(ultHaste)} AH`;

      card.className = 'deck-card verdict-telemetry-card state-success';
      badge.className = 'verdict-status-pill pure-haste';
      statusText.textContent = `大招冷却压缩 ${(cdrUlt * 100).toFixed(1)}%`;

      // 指标 1：当前技能急速 与 大招急速
      $('label-stat-1').textContent = '当前技能急速 / 大招急速';
      $('val-stat-1').innerHTML = `<span class="dual-haste">${Math.round(totalHaste)} / ${Math.round(ultHaste)}</span><span class="number-unit">AH</span>`;
      $('sub-stat-1').className = 'block-sub text-muted';
      if (equipStats.ultAh > 0) {
        $('sub-stat-1').textContent = `常规 ${Math.round(totalHaste)} AH · 大招加算 +${equipStats.ultAh} AH`;
      } else if (equipStats.basicAh > 0) {
        $('sub-stat-1').textContent = `常规 ${Math.round(totalHaste)} AH · 朔极之矛仅加基础小技能，大招不生效`;
      } else {
        $('sub-stat-1').textContent = `常规急速 ${Math.round(totalHaste)} AH · 大招同享加算`;
      }

      // 指标 2 (核心主角)：R 技能实际冷却
      $('label-stat-2').textContent = `R ${hero.skills.R.name} 最终冷却`;
      $('val-stat-2').innerHTML = `${cdUlt.toFixed(1)}<span class="number-unit">s</span>`;
      $('sub-stat-2').className = 'block-sub text-emerald';
      $('sub-stat-2').textContent = `原基础 ${baseR}s ➔ 压缩 ${reducedSeconds.toFixed(1)}s`;

      // 指标 3：大招综合 CDR
      $('label-stat-3').textContent = '大招综合冷却缩减';
      $('val-stat-3').innerHTML = `${(cdrUlt * 100).toFixed(1)}<span class="number-unit">%</span>`;
      $('sub-stat-3').className = 'block-sub text-muted';
      $('sub-stat-3').textContent = puristCaster ? '含术师 +10% 突破上限 CDR' : '大招专属急速加算折算';
    }

    // 4. 终极大招全息伤害推演
    const ultRank = heroKey === 'ashe' ? rankB : rankUlt;
    const damageResult = calculateUltimateDamage({
      heroKey,
      rank: ultRank,
      ap: totalAp,
      ad: equipStats.totalAd,
    });

    if ($('card-damage')) {
      $('disp-total-ap-badge').textContent = `法术强度: ${Math.round(totalAp)} AP`;
      $('disp-dmg-hero-skill').textContent = `${damageResult.skillName} · 单次爆发`;
      $('disp-dmg-total').innerHTML = `${damageResult.totalDamage}<span class="number-unit">点${damageResult.damageType}</span>`;
      $('disp-dmg-summary').textContent = damageResult.summary;
      $('chip-dmg-base').textContent = `基础伤害: ${damageResult.baseDamage}`;
      $('chip-dmg-ratio').textContent = `加成: +${Math.round(damageResult.ratioBonus)}`;
      $('chip-dmg-mult').textContent = `法强倍率: ${equipStats.apMultiplier.toFixed(2)}x`;
    }

    const announce = `${hero.name}，当前总急速 ${Math.round(totalHaste)}`;
    if (announce !== lastAnnouncement) {
      $('announcement').textContent = announce;
      lastAnnouncement = announce;
    }
  } catch (error) {
    console.error('计算出错:', error);
  }
  hydrateIcons();
}

// 事件初始化
function initEvents() {
  document.querySelectorAll('.hero-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      heroKey = tab.dataset.hero;
      if (heroKey === 'ashe') {
        rankA = 2;
        rankB = 2;
        if ($('chk-mandate-cc')) $('chk-mandate-cc').checked = true;
      } else {
        rankUlt = 3;
        if ($('chk-mandate-cc')) $('chk-mandate-cc').checked = false;
      }
      renderHeroUI();
      update();
    });
  });

  // 装备分类选项卡
  document.querySelectorAll('.item-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.item-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeItemCategory = tab.dataset.cat;
      renderItemsPicker();
    });
  });

  // 清空装备按钮
  $('btn-clear-items').addEventListener('click', () => {
    selectedItems = [];
    renderInventorySlots();
    renderItemsPicker();
    update();
  });

  // 海克斯强化与装备被动事件
  ['chk-purist', 'chk-eureka', 'chk-shrink', 'chk-recursion', 'chk-archmage', 'chk-lich-spellblade', 'chk-adapt', 'chk-crown', 'chk-mandate-cc'].forEach((id) => {
    $(id)?.addEventListener('change', update);
  });
  ['num-extra-as', 'num-extra-ap', 'num-extra-ad', 'num-shrink-stacks', 'num-recursion-kills', 'num-torch-stacks', 'num-crown-stacks'].forEach((id) => {
    $(id)?.addEventListener('input', update);
  });

  // 艾希加点快捷预设
  $('chip-2e2r')?.addEventListener('click', () => {
    rankA = 2;
    rankB = 2;
    renderHeroUI();
    update();
  });
  $('chip-4e3r')?.addEventListener('click', () => {
    rankA = 4;
    rankB = 3;
    renderHeroUI();
    update();
  });

  // 侧边抽屉逻辑
  function openDrawer() {
    const backdrop = $('drawer-backdrop');
    const panel = $('drawer-panel');
    if (!panel) return;
    backdrop.hidden = false;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
  }
  function closeDrawer() {
    const backdrop = $('drawer-backdrop');
    const panel = $('drawer-panel');
    if (!panel) return;
    panel.classList.remove('open');
    setTimeout(() => {
      panel.hidden = true;
      backdrop.hidden = true;
    }, 280);
  }
  $('btn-open-drawer')?.addEventListener('click', openDrawer);
  $('btn-close-drawer')?.addEventListener('click', closeDrawer);
  $('btn-collapse-drawer-bottom')?.addEventListener('click', closeDrawer);
  $('drawer-backdrop')?.addEventListener('click', closeDrawer);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('drawer-panel')?.hidden) closeDrawer();
  });

  // 海克斯强化单卡折叠与展开
  document.querySelectorAll('.btn-toggle-fold').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const target = $(targetId);
      if (target) {
        target.classList.toggle('collapsed');
      }
    });
  });

  // 一键折叠全部海克斯卡片
  $('btn-toggle-all-augments')?.addEventListener('click', () => {
    isAllAugmentsCollapsed = !isAllAugmentsCollapsed;
    document.querySelectorAll('.aug-box').forEach((box) => {
      box.classList.toggle('collapsed', isAllAugmentsCollapsed);
    });
    const btn = $('btn-toggle-all-augments');
    if (btn) btn.textContent = isAllAugmentsCollapsed ? '一键展开' : '一键折叠';
  });

  // 收起/展开海克斯区整块
  $('btn-fold-sec-augments')?.addEventListener('click', () => {
    const sec = $('section-augments');
    if (sec) {
      sec.classList.toggle('section-collapsed');
      const btn = $('btn-fold-sec-augments');
      if (btn) btn.textContent = sec.classList.contains('section-collapsed') ? '展开' : '收起';
    }
  });

  // 一键折叠全部装备卡片
  $('btn-toggle-all-items')?.addEventListener('click', () => {
    isAllItemsCollapsed = !isAllItemsCollapsed;
    if (isAllItemsCollapsed) {
      Object.keys(ITEMS).forEach((id) => collapsedItemIds.add(id));
    } else {
      collapsedItemIds.clear();
    }
    const btn = $('btn-toggle-all-items');
    if (btn) btn.textContent = isAllItemsCollapsed ? '一键展开卡片' : '一键折叠卡片';
    renderItemsPicker();
  });

  // 收起/展开装备区整块
  $('btn-fold-sec-equipment')?.addEventListener('click', () => {
    const sec = $('section-equipment');
    if (sec) {
      sec.classList.toggle('section-collapsed');
      const btn = $('btn-fold-sec-equipment');
      if (btn) btn.textContent = sec.classList.contains('section-collapsed') ? '展开' : '收起';
    }
  });

  // 重置面板
  $('btn-reset').addEventListener('click', () => {
    heroKey = 'ashe';
    rankA = 2;
    rankB = 2;
    rankUlt = 3;
    selectedItems = [];
    activeItemCategory = 'all';
    $('chk-purist').checked = false;
    $('chk-eureka').checked = false;
    $('chk-shrink').checked = false;
    $('chk-recursion').checked = false;
    $('chk-archmage').checked = false;
    if ($('chk-adapt')) $('chk-adapt').checked = false;
    if ($('chk-crown')) $('chk-crown').checked = false;
    if ($('chk-lich-spellblade')) $('chk-lich-spellblade').checked = false;
    if ($('chk-mandate-cc')) $('chk-mandate-cc').checked = false;
    if ($('num-extra-as')) $('num-extra-as').value = '0';
    if ($('num-extra-ap')) $('num-extra-ap').value = '0';
    if ($('num-extra-ad')) $('num-extra-ad').value = '0';
    $('num-shrink-stacks').value = '0';
    $('num-recursion-kills').value = '0';
    if ($('num-crown-stacks')) $('num-crown-stacks').value = '0';
    if ($('num-torch-stacks')) $('num-torch-stacks').value = '0';

    document.querySelectorAll('.item-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.cat === 'all');
    });

    renderHeroUI();
    renderInventorySlots();
    renderItemsPicker();
    update();
  });
}

renderHeroUI();
renderInventorySlots();
renderItemsPicker();
initEvents();
update();
