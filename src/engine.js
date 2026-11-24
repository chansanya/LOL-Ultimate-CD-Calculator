import { HEROES } from './data/heroes.js';
import { AUGMENTS } from './data/augments.js';
import { ITEMS } from './data/items.js';

function validateOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new RangeError('计算参数必须是对象。');
  }
}

function validateNumber(value, name, minimum, maximum = Infinity) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    const range = maximum === Infinity ? `不小于 ${minimum}` : `在 ${minimum} 到 ${maximum} 之间`;
    throw new RangeError(`${name}必须是${range}的有限数值。`);
  }
}

function finiteResult(value, name) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name}超出有限数值计算范围，请调整输入。`);
  }
  return value;
}

export function hasteToCdr(haste) {
  validateNumber(haste, '技能急速', 0);
  return finiteResult(haste / (100 + haste), '急速换算冷却缩减');
}

export function cdrToHaste(cdr) {
  if (!Number.isFinite(cdr) || cdr < 0 || cdr >= 1) {
    throw new RangeError('冷却缩减必须是大于等于 0 且小于 1 的有限数值。');
  }
  return finiteResult(100 * cdr / (1 - cdr), '冷却缩减换算急速');
}

export function calculateCooldown(options = {}) {
  validateOptions(options);
  const {
    baseA = 80,
    baseB = 80,
    haste = 150,
    extraHasteA = 0,
    extraHasteB = 0,
    archmage = AUGMENTS.archmage.defaultRatio,
    sorcerer = AUGMENTS.sorcerer.defaultRatio,
  } = options;

  for (const [name, value] of [['技能 A 基础冷却', baseA], ['技能 B 基础冷却', baseB]]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name}必须是大于 0 的有限数值。`);
    }
  }
  validateNumber(haste, '通用技能急速', 0);
  validateNumber(extraHasteA, '技能 A 独立急速', 0);
  validateNumber(extraHasteB, '技能 B 独立急速', 0);
  validateNumber(archmage, '大法师返还比例', 0, 1);
  validateNumber(sorcerer, '术士冷却缩减比例', 0, 1);

  const effectiveHasteA = finiteResult(haste + extraHasteA, '技能 A 有效急速');
  const effectiveHasteB = finiteResult(haste + extraHasteB, '技能 B 有效急速');
  const cdr = (effectiveHaste) => Math.max(0,
    Math.min(1, effectiveHaste / (100 + effectiveHaste) + sorcerer));
  const cdrA = cdr(effectiveHasteA);
  const cdrB = cdr(effectiveHasteB);
  const cdA = baseA * (1 - cdrA);
  const cdB = baseB * (1 - cdrB);
  const refundA = baseB * archmage;
  const refundB = baseA * archmage;
  const remainA = Math.max(0, cdA - refundA);
  const remainB = Math.max(0, cdB - refundB);

  function need(base, refund, extra) {
    const q = finiteResult(1 - refund / base - sorcerer, '最低急速阈值计算');
    if (q <= 0) return 0;
    if (q >= 1) return Infinity;
    return Math.max(0, finiteResult(100 * q / (1 - q) - extra, '最低急速阈值计算'));
  }

  // 与参考引擎保持相同容差，避免整数阈值被浮点误差进位。
  const minHaste = Math.max(0, Math.ceil(Math.max(
    need(baseA, refundA, extraHasteA),
    need(baseB, refundB, extraHasteB),
  ) - 1e-9));

  const result = {
    cdrA, cdrB, cdA, cdB, refundA, refundB, remainA, remainB, minHaste,
    theoreticalLoop: remainA <= 1e-8 && remainB <= 1e-8,
  };
  // 仅 minHaste 的 Infinity 是规范允许的“无有限急速解”标记。
  for (const [field, value] of Object.entries(result)) {
    if (typeof value === 'number' && !(field === 'minHaste' && value === Infinity)) {
      finiteResult(value, '冷却计算结果');
    }
  }
  return result;
}

/** 海克斯大乱斗增益急速与加算 CDR 计算 */
export function calculateMayhemHaste({
  baseHaste = 0,
  puristCaster = false,
  attackSpeed = 0,
  eureka = false,
  ap = 0,
  shrinkEngine = false,
  shrinkStacks = 0,
  infiniteRecursion = false,
  kills = 0,
} = {}) {
  let bonusHaste = 0;
  let bonusCdr = 0;

  if (puristCaster) {
    bonusCdr += AUGMENTS.sorcerer.defaultRatio;
    bonusHaste += Math.max(0, attackSpeed) * AUGMENTS.sorcerer.asRatio;
  }
  if (eureka) {
    bonusHaste += Math.max(0, ap) * AUGMENTS.eureka.defaultRatio;
  }
  if (shrinkEngine) {
    bonusHaste += Math.max(0, shrinkStacks) * AUGMENTS.shrinkEngine.stackHaste;
  }
  if (infiniteRecursion) {
    bonusHaste += AUGMENTS.infiniteRecursion.baseHaste + Math.max(0, kills) * AUGMENTS.infiniteRecursion.killHaste;
  }
  const totalHaste = Math.max(0, baseHaste) + bonusHaste;
  return { bonusHaste, totalHaste, bonusCdr };
}

/** 计算已选装备提供的基础属性与专属联动 */
export function calculateEquipmentStats(selectedItemIds = [], options = {}) {
  let baseAh = 0;
  let rawAp = 0;
  let rawAd = 0;
  let rawAs = 0;
  let ultAh = 0;
  let hasRabadon = false;
  let hasLichBane = false;
  let hasTorch = false;

  for (const id of selectedItemIds) {
    const item = ITEMS[id];
    if (!item) continue;
    baseAh += item.ah || 0;
    rawAp += item.ap || 0;
    rawAd += item.ad || 0;
    rawAs += item.as || 0;
    ultAh += item.ultAh || 0;
    if (item.isRabadon) hasRabadon = true;
    if (item.hasTorch || id === 'blackfireTorch') hasTorch = true;
    if (id === 'lichBane') hasLichBane = true;
  }

  // 巫妖之祸咒刃被动：释放技能获得 +50% 攻速
  if (hasLichBane && options.lichBaneActive) {
    rawAs += 50;
  }

  // 局内锻体额外属性（海斗属性铁砧）
  const anvilAs = Math.max(0, Number(options.anvilAs ?? options.extraAs) || 0);
  const anvilAp = Math.max(0, Number(options.anvilAp ?? options.extraAp) || 0);
  const anvilAd = Math.max(0, Number(options.anvilAd ?? options.extraAd) || 0);

  const totalRawAs = rawAs + anvilAs;
  const totalRawAd = rawAd + anvilAd;

  // 王冠之重 (Heavy is the Crown)：每层使额外攻击力、额外法术强度和总攻击速度提升 5%
  const heavyCrownActive = Boolean(options.heavyCrownActive ?? options.crownActive);
  const heavyCrownStacks = Math.max(0, Number(options.heavyCrownStacks ?? options.crownStacks) || 0);
  const heavyCrownBonusRatio = heavyCrownActive ? heavyCrownStacks * (AUGMENTS.heavyCrown?.bonusPerStack || 0.05) : 0;
  const crownMultiplier = 1 + heavyCrownBonusRatio;

  const totalAs = heavyCrownActive ? totalRawAs * crownMultiplier : totalRawAs;
  const boostedRawAd = heavyCrownActive ? totalRawAd * crownMultiplier : totalRawAd;
  const boostedRawAp = heavyCrownActive ? (rawAp + anvilAp) * crownMultiplier : (rawAp + anvilAp);

  // 物理转魔法 (ADAPt)：额外攻击力 100% 转化为法强，并提供 15% 总法强加成
  const adapt = Boolean(options.adaptActive);
  let effectiveAp = boostedRawAp;
  let adConvertedAp = 0;
  if (adapt) {
    adConvertedAp = boostedRawAd;
    effectiveAp += adConvertedAp;
  }

  // 计算法强百分比放大倍率
  let apMultiplier = 1.0;
  if (hasRabadon) {
    apMultiplier += 0.30;
  }
  const torchStacks = hasTorch ? (typeof options.torchStacks === 'number' ? options.torchStacks : 3) : 0;
  if (hasTorch && torchStacks > 0) {
    apMultiplier += torchStacks * 0.04;
  }
  if (adapt) {
    apMultiplier += 0.15;
  }

  const totalAp = Math.round(effectiveAp * apMultiplier);

  return {
    baseAh,
    rawAp,
    anvilAp,
    totalRawAp: rawAp + anvilAp,
    boostedRawAp,
    totalAp,
    rawAd,
    anvilAd,
    totalRawAd,
    boostedRawAd,
    totalAd: adapt ? 0 : Math.round(boostedRawAd),
    adConvertedAp,
    rawAs,
    anvilAs,
    totalRawAs,
    totalAs: Math.round(totalAs * 10) / 10,
    ultAh,
    hasRabadon,
    hasLichBane,
    hasTorch,
    torchStacks,
    apMultiplier,
    heavyCrownActive,
    heavyCrownStacks,
    heavyCrownBonusRatio,
  };
}

/** 计算英雄终极大招伤害 */
export function calculateUltimateDamage({
  heroKey = 'ashe',
  rank = 3,
  ap = 0,
  ad = 0,
} = {}) {
  if (heroKey === 'ashe') {
    // 艾希 R 魔法水晶箭：200 / 400 / 600 + 100% AP 魔法伤害
    const baseDamages = [200, 400, 600];
    const baseDamage = baseDamages[Math.min(rank - 1, baseDamages.length - 1)] || 200;
    const apRatio = 1.0;
    const apBonus = ap * apRatio;
    const totalDamage = Math.round(baseDamage + apBonus);
    return {
      skillName: 'R 魔法水晶箭',
      damageType: '魔法伤害',
      baseDamage,
      ratioDesc: '100% AP',
      ratioBonus: apBonus,
      totalDamage,
      summary: `基础 ${baseDamage} + AP加成 ${Math.round(apBonus)} = ${totalDamage} 魔法伤害`,
    };
  }

  if (heroKey === 'karthus') {
    // 死歌 R 安魂曲：200 / 350 / 500 + 75% AP 魔法伤害
    const baseDamages = [200, 350, 500];
    const baseDamage = baseDamages[Math.min(rank - 1, baseDamages.length - 1)] || 200;
    const apRatio = 0.75;
    const apBonus = ap * apRatio;
    const singleDamage = Math.round(baseDamage + apBonus);
    const totalTeamDamage = singleDamage * 5;
    return {
      skillName: 'R 安魂曲',
      damageType: '魔法伤害',
      baseDamage,
      ratioDesc: '75% AP',
      ratioBonus: apBonus,
      totalDamage: singleDamage,
      totalTeamDamage,
      summary: `单体 ${singleDamage} · 全图 5 人总和 ${totalTeamDamage}`,
    };
  }

  if (heroKey === 'gangplank') {
    // 船长 R 加农炮幕：12 波炮击，每波 40 / 70 / 100 + 10% AP 魔法伤害
    const baseWaveDamages = [40, 70, 100];
    const waveBase = baseWaveDamages[Math.min(rank - 1, baseWaveDamages.length - 1)] || 40;
    const waveApBonus = ap * 0.10;
    const singleWaveDamage = Math.round(waveBase + waveApBonus);
    const total12WaveDamage = singleWaveDamage * 12;
    return {
      skillName: 'R 加农炮幕',
      damageType: '魔法伤害',
      baseDamage: waveBase,
      ratioDesc: '每波 10% AP · 12 波共 120% AP',
      ratioBonus: waveApBonus,
      totalDamage: singleWaveDamage,
      total12WaveDamage,
      summary: `单波 ${singleWaveDamage} · 12 波全中 ${total12WaveDamage}`,
    };
  }

  return { totalDamage: 0, summary: '' };
}

/** 按 E 等级优先、R 等级次之返回 15 种组合；达标状态基于当前输入急速。 */
export function getAsheRecommendations(options = {}) {
  validateOptions(options);
  const {
    haste = 150,
    extraHasteA = 0,
    extraHasteB = 0,
    archmage = AUGMENTS.archmage.defaultRatio,
    sorcerer = AUGMENTS.sorcerer.defaultRatio,
  } = options;
  const eCds = HEROES.ashe.skills.E.baseCooldowns;
  const rCds = HEROES.ashe.skills.R.baseCooldowns;
  const list = [];
  for (let eIdx = 0; eIdx < eCds.length; eIdx += 1) {
    for (let rIdx = 0; rIdx < rCds.length; rIdx += 1) {
      const baseA = eCds[eIdx];
      const baseB = rCds[rIdx];
      const res = calculateCooldown({
        baseA,
        baseB,
        haste,
        extraHasteA,
        extraHasteB,
        archmage,
        sorcerer,
      });
      list.push({
        eRank: eIdx + 1,
        rRank: rIdx + 1,
        baseA,
        baseB,
        minHaste: res.minHaste,
        theoreticalLoop: res.theoreticalLoop,
      });
    }
  }
  return list;
}
