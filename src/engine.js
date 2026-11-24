import { HEROES } from './data/heroes.js';
import { AUGMENTS } from './data/augments.js';

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

/** 按 E 等级优先、R 等级次之返回 15 种组合；达标状态基于当前输入急速。 */
export function getAsheRecommendations(options = {}) {
  validateOptions(options);
  const {
    haste, extraHasteA, extraHasteB, archmage, sorcerer,
  } = options;
  return HEROES.ashe.skills.E.baseCooldowns.flatMap((baseA, eIndex) =>
    HEROES.ashe.skills.R.baseCooldowns.map((baseB, rIndex) => {
      const { minHaste, theoreticalLoop } = calculateCooldown({
        baseA, baseB, haste, extraHasteA, extraHasteB, archmage, sorcerer,
      });
      return { eRank: eIndex + 1, rRank: rIndex + 1, baseA, baseB,
        minHaste, theoreticalLoop };
    }));
}
