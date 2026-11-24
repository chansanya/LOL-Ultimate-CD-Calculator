import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCooldown,
  hasteToCdr,
  cdrToHaste,
  getAsheRecommendations,
} from '../src/engine.js';
import { HEROES } from '../src/data/heroes.js';
import { AUGMENTS } from '../src/data/augments.js';

const closeTo = (actual, expected, epsilon = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `预期 ${expected}，实际 ${actual}`);
};
const chineseRangeError = (error) =>
  error instanceof RangeError && /[\u4e00-\u9fff]/u.test(error.message);

// 规范第 6 节的独立验收数据：E、R、基础 CD、无术士阈值、有术士阈值。
const combinations = [
  [1, 1, 90, 100, 271, 171],
  [1, 2, 90, 80, 275, 173],
  [1, 3, 90, 60, 400, 234],
  [2, 1, 80, 100, 317, 195],
  [2, 2, 80, 80, 234, 150],
  [2, 3, 80, 60, 345, 208],
  [3, 1, 70, 100, 377, 223],
  [3, 2, 70, 80, 281, 176],
  [3, 3, 70, 60, 289, 180],
  [4, 1, 60, 100, 456, 258],
  [4, 2, 60, 80, 345, 208],
  [4, 3, 60, 60, 234, 150],
  [5, 1, 50, 100, 567, 300],
  [5, 2, 50, 80, 434, 248],
  [5, 3, 50, 60, 300, 186],
];

// 规范第 5 节参考函数快照，独立于生产实现用于逐字段差分验证。
function referenceCooldown({ baseA = 80, baseB = 80, haste = 150,
  extraHasteA = 0, extraHasteB = 0, archmage = 0.3, sorcerer = 0.1 } = {}) {
  const vals = [baseA, baseB, haste, extraHasteA, extraHasteB, archmage, sorcerer];
  if (!vals.every(Number.isFinite) || baseA <= 0 || baseB <= 0 ||
      [haste, extraHasteA, extraHasteB].some((x) => x < 0) ||
      [archmage, sorcerer].some((x) => x < 0 || x > 1)) {
    throw new RangeError('Invalid input');
  }
  const cdr = (x) => Math.min(1, x / (100 + x) + sorcerer);
  const cdrA = cdr(haste + extraHasteA), cdrB = cdr(haste + extraHasteB);
  const cdA = baseA * (1 - cdrA), cdB = baseB * (1 - cdrB);
  const refundA = baseB * archmage, refundB = baseA * archmage;
  const remainA = Math.max(0, cdA - refundA), remainB = Math.max(0, cdB - refundB);
  function need(base, refund, extra) {
    const q = 1 - refund / base - sorcerer;
    return q <= 0 ? 0 : q >= 1 ? Infinity : Math.max(0, 100 * q / (1 - q) - extra);
  }
  const minHaste = Math.ceil(Math.max(need(baseA, refundA, extraHasteA),
    need(baseB, refundB, extraHasteB)) - 1e-9);
  return { cdrA, cdrB, cdA, cdB, refundA, refundB, remainA, remainB, minHaste,
    theoreticalLoop: remainA <= 1e-8 && remainB <= 1e-8 };
}

describe('规范第 8 节验收', () => {
  test('默认 80/80、150 急速：24 秒 CD、24 秒返还，最低 150', () => {
    const result = calculateCooldown();
    assert.deepEqual(Object.keys(result).sort(), [
      'cdrA', 'cdrB', 'cdA', 'cdB', 'refundA', 'refundB',
      'remainA', 'remainB', 'minHaste', 'theoreticalLoop',
    ].sort());
    for (const key of ['cdrA', 'cdrB']) closeTo(result[key], 0.7);
    for (const key of ['cdA', 'cdB', 'refundA', 'refundB']) {
      closeTo(result[key], 24);
    }
    for (const key of ['remainA', 'remainB']) closeTo(result[key], 0);
    assert.equal(result.minHaste, 150);
    assert.equal(result.theoreticalLoop, true);
    assert.deepEqual(calculateCooldown({}), result);
    assert.deepEqual(calculateCooldown({ haste: undefined }), result);
  });

  test('149 未达标；关闭术士时 233 未达标、234 达标', () => {
    assert.equal(calculateCooldown({ haste: 149 }).theoreticalLoop, false);
    assert.equal(calculateCooldown({ haste: 233, sorcerer: 0 }).theoreticalLoop, false);
    const result = calculateCooldown({ haste: 234, sorcerer: 0 });
    assert.equal(result.minHaste, 234);
    assert.equal(result.theoreticalLoop, true);
  });

  test('60/60、150 急速：18 秒 CD、剩余为零', () => {
    const result = calculateCooldown({ baseA: 60, baseB: 60 });
    closeTo(result.cdA, 18);
    closeTo(result.cdB, 18);
    closeTo(result.remainA, 0);
    closeTo(result.remainB, 0);
    assert.equal(result.minHaste, 150);
    assert.equal(result.theoreticalLoop, true);
  });

  test('80/60 最低 208，交换双方保持阈值并交换全部方向性输出', () => {
    const forward = calculateCooldown({ baseA: 80, baseB: 60 });
    const reverse = calculateCooldown({ baseA: 60, baseB: 80 });
    assert.equal(forward.minHaste, 208);
    assert.equal(reverse.minHaste, 208);
    for (const field of ['cdr', 'cd', 'refund', 'remain']) {
      closeTo(forward[`${field}A`], reverse[`${field}B`]);
      closeTo(forward[`${field}B`], reverse[`${field}A`]);
    }
    assert.equal(forward.theoreticalLoop, reverse.theoreticalLoop);
  });

  test('只有 B 加 50 独立急速仍需 150；双方加 50 则只需 100', () => {
    const one = calculateCooldown({ extraHasteB: 50 });
    assert.equal(one.minHaste, 150);
    closeTo(one.cdrA, 0.7);
    closeTo(one.cdrB, 23 / 30);
    assert.equal(calculateCooldown({ extraHasteA: 50, extraHasteB: 50 }).minHaste, 100);
    assert.equal(calculateCooldown({ haste: 100, extraHasteA: 50,
      extraHasteB: 50 }).theoreticalLoop, true);
    assert.equal(calculateCooldown({ haste: 99, extraHasteA: 50,
      extraHasteB: 50 }).theoreticalLoop, false);
  });

  test('M=0、S=0 时无有限急速解，当前不达标', () => {
    const result = calculateCooldown({ archmage: 0, sorcerer: 0 });
    assert.equal(result.minHaste, Infinity);
    assert.equal(result.theoreticalLoop, false);
    assert.equal(result.refundA, 0);
    assert.equal(result.refundB, 0);
  });

  for (const [eRank, rRank, baseA, baseB, without, withSorcerer] of combinations) {
    for (const [sorcerer, minimum] of [[0, without], [0.1, withSorcerer]]) {
      test(`${eRank}E/${rRank}R，S=${sorcerer}：最低 ${minimum} 达标，低 1 未达标`, () => {
        const result = calculateCooldown({ baseA, baseB, sorcerer, haste: minimum });
        assert.equal(result.minHaste, minimum);
        assert.equal(result.theoreticalLoop, true);
        assert.equal(calculateCooldown({ baseA, baseB, sorcerer,
          haste: minimum - 1 }).theoreticalLoop, false);
      });
    }
  }
});

describe('公式边界与精度', () => {
  test('返还来源是另一技能基础 CD，不能使用实际 CD 或本技能基础 CD', () => {
    const result = calculateCooldown({ baseA: 100, baseB: 50, haste: 0,
      archmage: 0.3, sorcerer: 0 });
    assert.equal(result.refundA, 15);
    assert.equal(result.refundB, 30);
    assert.equal(result.remainA, 85);
    assert.equal(result.remainB, 20);
    const faster = calculateCooldown({ baseA: 100, baseB: 50, haste: 500 });
    assert.equal(faster.refundA, 15);
    assert.equal(faster.refundB, 30);
  });

  test('术士采用加算 CDR；综合 CDR 钳制到 1，剩余 CD 不为负', () => {
    const result = calculateCooldown({ haste: 400, sorcerer: 0.5 });
    assert.equal(result.cdrA, 1);
    assert.equal(result.cdrB, 1);
    assert.equal(result.cdA, 0);
    assert.equal(result.cdB, 0);
    assert.equal(result.remainA, 0);
    assert.equal(result.remainB, 0);
    assert.equal(result.theoreticalLoop, true);
    const zero = calculateCooldown({ haste: 0, archmage: 0, sorcerer: 0 });
    assert.equal(zero.cdrA, 0);
    assert.equal(zero.cdrB, 0);
    const all = calculateCooldown({ haste: 0, archmage: 0, sorcerer: 1 });
    assert.equal(all.minHaste, 0);
    assert.equal(all.theoreticalLoop, true);
  });

  test('q<=0 和独立急速覆盖全部需求时阈值为正零', () => {
    for (const options of [{ archmage: 1 }, { sorcerer: 1 },
      { extraHasteA: 500, extraHasteB: 500 }]) {
      const result = calculateCooldown({ ...options, haste: 0 });
      assert.equal(result.minHaste, 0);
      assert.equal(result.theoreticalLoop, true);
    }
  });

  test('非对称独立急速作用于指定技能，交换完整参数仍对称', () => {
    const first = calculateCooldown({ baseA: 80, baseB: 60, extraHasteA: 50,
      extraHasteB: 0, haste: 158 });
    const second = calculateCooldown({ baseA: 60, baseB: 80, extraHasteA: 0,
      extraHasteB: 50, haste: 158 });
    assert.equal(first.minHaste, 158);
    assert.equal(first.theoreticalLoop, true);
    assert.equal(second.minHaste, first.minHaste);
    closeTo(first.cdrA, second.cdrB);
    closeTo(first.cdrB, second.cdrA);
    assert.equal(calculateCooldown({ baseA: 80, baseB: 60,
      extraHasteA: 50, haste: 157 }).theoreticalLoop, false);
  });

  test('保留计算精度：允许超过 500 和小数急速，不提前显示舍入', () => {
    const result = calculateCooldown({ haste: 123.456, sorcerer: 0 });
    closeTo(result.cdA, 35.80123156236575);
    assert.notEqual(result.cdA, Number(result.cdA.toFixed(2)));
    assert.equal(calculateCooldown({ haste: 1000 }).theoreticalLoop, true);
  });

  test('阈值取整保留 1e-9 容差，不能把微小浮点误差进位', () => {
    const result = calculateCooldown({ archmage: 0.25 - 1e-13, sorcerer: 0,
      haste: 300 });
    assert.equal(result.minHaste, 300);
    assert.equal(result.theoreticalLoop, true);
  });

  test('达标使用剩余 CD 的 1e-8 容差，不将剩余值提前归零', () => {
    const within = calculateCooldown({ baseA: 1, baseB: 1, haste: 0,
      sorcerer: 0, archmage: 1 - 5e-9 });
    assert.ok(within.remainA > 0);
    assert.equal(within.theoreticalLoop, true);
    assert.equal(calculateCooldown({ baseA: 1, baseB: 1, haste: 0,
      sorcerer: 0, archmage: 1 - 2e-8 }).theoreticalLoop, false);
  });

  test('纯函数不修改输入，重复调用返回独立结果', () => {
    const options = Object.freeze({ baseA: 80, baseB: 60, haste: 208 });
    const first = calculateCooldown(options);
    const second = calculateCooldown(options);
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    first.minHaste = -1;
    assert.equal(calculateCooldown(options).minHaste, 208);
  });
});

describe('非有限运算防护', () => {
  const max = Number.MAX_VALUE;

  for (const extras of [{ extraHasteA: max }, { extraHasteB: max },
    { extraHasteA: max, extraHasteB: max }]) {
    test(`有限急速相加溢出应拒绝：${Object.keys(extras).join('/')}`, () => {
      for (const sorcerer of [0, 0.1, 1]) {
        const options = { haste: max, sorcerer, ...extras };
        assert.throws(() => calculateCooldown(options), (error) =>
          chineseRangeError(error) && /有效急速/.test(error.message));
        assert.throws(() => getAsheRecommendations(options), chineseRangeError);
      }
    });
  }

  test('有限返还与极小基础 CD 的比值溢出时明确拒绝', () => {
    for (const [baseA, baseB] of [[Number.MIN_VALUE, max], [max, Number.MIN_VALUE]]) {
      assert.throws(() => calculateCooldown({ baseA, baseB }), (error) =>
        chineseRangeError(error) && /阈值/.test(error.message));
    }
  });

  test('接近数值上限但未溢出的急速与基础 CD 仍可计算', () => {
    for (const options of [
      { haste: max, extraHasteA: 0, extraHasteB: 0 },
      { haste: max / 2, extraHasteA: max / 2, extraHasteB: max / 4 },
      { baseA: max, baseB: max },
      { baseA: Number.MIN_VALUE, baseB: Number.MIN_VALUE },
    ]) {
      const result = calculateCooldown(options);
      const expected = referenceCooldown(options);
      // 公开接口将参考函数的 -0 规范化为 0。
      expected.minHaste = Math.max(0, expected.minHaste);
      assert.deepEqual(result, expected);
      for (const [field, value] of Object.entries(result)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), field);
      }
    }
    assert.ok(Number.isFinite(hasteToCdr(max)));
    assert.ok(Number.isFinite(cdrToHaste(1 - Number.EPSILON / 2)));
  });

  test('无有限解的 Infinity 标记保留，其余数值返回量必须有限', () => {
    for (const options of [{}, { baseA: max, baseB: max },
      { baseA: Number.MIN_VALUE, baseB: Number.MIN_VALUE }]) {
      const result = calculateCooldown({ ...options, archmage: 0, sorcerer: 0 });
      assert.equal(result.minHaste, Infinity);
      for (const [field, value] of Object.entries(result)) {
        if (typeof value === 'number' && field !== 'minHaste') {
          assert.ok(Number.isFinite(value), field);
        }
      }
    }
  });
});

describe('全部表格组合与规范参考函数等价', () => {
  for (const [eRank, rRank, baseA, baseB, without, withSorcerer] of combinations) {
    for (const [sorcerer, minimum] of [[0, without], [0.1, withSorcerer]]) {
      test(`${eRank}E/${rRank}R，S=${sorcerer}：多组急速及独立急速逐字段一致`, () => {
        for (const haste of [0, 150, minimum - 1, minimum, minimum + 1, 1000]) {
          for (const [extraHasteA, extraHasteB] of [[0, 0], [50, 0], [0, 50], [12.5, 76.25]]) {
            const options = { baseA, baseB, haste, extraHasteA, extraHasteB, sorcerer };
            assert.deepEqual(calculateCooldown(options), referenceCooldown(options));
          }
        }
      });
    }
  }
});

describe('输入校验与急速换算', () => {
  for (const field of ['baseA', 'baseB', 'haste', 'extraHasteA', 'extraHasteB',
    'archmage', 'sorcerer']) {
    test(`${field} 拒绝非数值、非有限值和负数，并返回中文 RangeError`, () => {
      for (const value of ['', ' ', '150', null, true, false, [], {},
        NaN, Infinity, -Infinity, -1, 1n, Symbol('非法值')]) {
        assert.throws(() => calculateCooldown({ [field]: value }), chineseRangeError);
      }
    });
  }

  test('零基础 CD、超范围比例和非法参数对象均被拒绝', () => {
    for (const options of [{ baseA: 0 }, { baseB: 0 }, { baseA: -0 },
      { archmage: 1.001 }, { sorcerer: 1.001 }, null, [], '', 10, true]) {
      assert.throws(() => calculateCooldown(options), chineseRangeError);
    }
  });

  test('换算函数保留精度，0 有效，CDR=1 没有合法逆变换', () => {
    assert.equal(hasteToCdr(0), 0);
    assert.equal(cdrToHaste(0), 0);
    closeTo(hasteToCdr(150), 0.6);
    closeTo(cdrToHaste(0.7), 233.33333333333333);
    closeTo(cdrToHaste(hasteToCdr(123.456)), 123.456);
    for (const value of [undefined, null, '', '0.5', false, NaN, Infinity, -1]) {
      assert.throws(() => hasteToCdr(value), chineseRangeError);
      assert.throws(() => cdrToHaste(value), chineseRangeError);
    }
    assert.throws(() => cdrToHaste(1), chineseRangeError);
    assert.throws(() => cdrToHaste(1.1), chineseRangeError);
  });
});

describe('寒冰预设、海克斯数据与 UI 推荐接口', () => {
  test('技能基础 CD、充能限制和来源版本未验证标注齐全', () => {
    const ashe = HEROES.ashe;
    assert.equal(ashe.name, '寒冰射手');
    assert.deepEqual(ashe.skills.Q.baseCooldowns, [0]);
    assert.equal(ashe.skills.Q.inCooldownModel, false);
    assert.deepEqual(ashe.skills.W.baseCooldowns, [18, 14.5, 11, 7.5, 4]);
    assert.deepEqual(ashe.skills.E.baseCooldowns, [90, 80, 70, 60, 50]);
    assert.equal(ashe.skills.E.maxCharges, 2);
    assert.equal(ashe.skills.E.castInterval, 5);
    assert.equal(ashe.skills.E.cooldownType, 'recharge');
    assert.deepEqual(ashe.skills.R.baseCooldowns, [100, 80, 60]);
    for (const item of [ashe, AUGMENTS.archmage, AUGMENTS.sorcerer]) {
      assert.equal(item.verified, false);
      assert.equal(item.versionVerified, false);
      assert.equal(item.version, null);
      assert.ok(item.source.includes('未独立核验'));
    }
    assert.equal(AUGMENTS.archmage.defaultRatio, 0.3);
    assert.equal(AUGMENTS.sorcerer.defaultRatio, 0.1);
  });

  for (const sorcerer of [0, 0.1]) {
    test(`推荐接口按 E/R 等级返回全部 15 行，S=${sorcerer}`, () => {
      const rows = getAsheRecommendations({ sorcerer });
      assert.equal(rows.length, 15);
      for (const [index, fixture] of combinations.entries()) {
        const [eRank, rRank, baseA, baseB, without, withSorcerer] = fixture;
        const minHaste = sorcerer === 0 ? without : withSorcerer;
        assert.deepEqual(rows[index], { eRank, rRank, baseA, baseB, minHaste,
          theoreticalLoop: minHaste <= 150 });
      }
    });
  }

  test('推荐接口默认 2E+2R 和 4E+3R 达标，支持所有当前 options', () => {
    const defaults = getAsheRecommendations();
    assert.deepEqual(getAsheRecommendations({}), defaults);
    assert.equal(defaults.filter((row) => row.theoreticalLoop).length, 2);
    const options = Object.freeze({ haste: 100, extraHasteA: 50, extraHasteB: 50,
      archmage: 0.3, sorcerer: 0.1 });
    const rows = getAsheRecommendations(options);
    assert.equal(rows[4].minHaste, 100);
    assert.equal(rows[4].theoreticalLoop, true);
    assert.equal(rows[11].minHaste, 100);
    assert.equal(rows[11].theoreticalLoop, true);
    assert.ok(getAsheRecommendations({ archmage: 0, sorcerer: 0 })
      .every((row) => row.minHaste === Infinity && !row.theoreticalLoop));
    assert.ok(getAsheRecommendations({ haste: 0, archmage: 1, sorcerer: 0 })
      .some((row) => row.minHaste === 0 && row.theoreticalLoop));
    assert.deepEqual(getAsheRecommendations(), defaults);
  });

  test('推荐接口校验 options，技能基础 CD 始终来自预设', () => {
    for (const options of [null, [], '', { haste: '' }, { extraHasteA: -1 },
      { extraHasteB: Infinity }, { archmage: 2 }, { sorcerer: null }]) {
      assert.throws(() => getAsheRecommendations(options), chineseRangeError);
    }
    assert.deepEqual(getAsheRecommendations({ baseA: 1, baseB: 1 }),
      getAsheRecommendations());
  });
});
