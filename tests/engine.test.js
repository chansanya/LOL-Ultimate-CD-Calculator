import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCooldown,
  hasteToCdr,
  cdrToHaste,
  getAsheRecommendations,
  calculateMayhemHaste,
  calculateEquipmentStats,
  calculateUltimateDamage,
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

describe('海克斯大乱斗强化与装备联动计算', () => {
  test('纯粹主义者 - 术师：攻速按 0.65 换算为急速，并获得 10% 加算 CDR', () => {
    // 纳什之牙提供 50% 攻速
    const res = calculateMayhemHaste({ puristCaster: true, attackSpeed: 50 });
    assert.equal(res.bonusHaste, 32.5);
    assert.equal(res.bonusCdr, 0.1);
    assert.equal(res.totalHaste, 32.5);
  });

  test('尤里卡：法术强度 AP × 30% 转化为急速', () => {
    const res = calculateMayhemHaste({ eureka: true, ap: 200 });
    assert.equal(res.bonusHaste, 60);
    assert.equal(res.totalHaste, 60);
  });

  test('缩小引擎：每层击杀获得 10 急速', () => {
    const res = calculateMayhemHaste({ shrinkEngine: true, shrinkStacks: 6 });
    assert.equal(res.bonusHaste, 60);
  });

  test('无限循环往复：基准 +60 急速，每次击杀 +3 急速', () => {
    const res = calculateMayhemHaste({ infiniteRecursion: true, kills: 10 });
    assert.equal(res.bonusHaste, 90);
  });

  test('全海克斯叠加联动与装备基础急速池正确累加', () => {
    // 基础 60 AH (装备残疫20+星界驱驰25+纳什15) + 纳什50%攻速转 32.5 AH + 300AP转 90 AH + 5层缩小50 AH + 往复(60+30) AH
    const res = calculateMayhemHaste({
      baseHaste: 60,
      puristCaster: true,
      attackSpeed: 50,
      eureka: true,
      ap: 300,
      shrinkEngine: true,
      shrinkStacks: 5,
      infiniteRecursion: true,
      kills: 10,
    });
    // bonusHaste = 32.5 + 90 + 50 + 90 = 262.5
    // totalHaste = 60 + 262.5 = 322.5
    assert.equal(res.bonusHaste, 262.5);
    assert.equal(res.totalHaste, 322.5);
    assert.equal(res.bonusCdr, 0.1);
  });

  test('装备库属性汇总：残疫、纳什、帽子与咒刃激活联动', () => {
    // 装备纳什(15 AH, 80 AP, 50% AS) + 残疫(15 AH, 90 AP, 20 Ult AH) + 巫妖(10 AH, 100 AP)
    const stats1 = calculateEquipmentStats(['nashor', 'malignance', 'lichBane'], { lichBaneActive: false });
    assert.equal(stats1.baseAh, 40); // 15 + 15 + 10
    assert.equal(stats1.totalAp, 270); // 80 + 90 + 100
    assert.equal(stats1.totalAs, 50); // 50% from nashor
    assert.equal(stats1.ultAh, 20); // 20 from malignance

    // 激活巫妖咒刃爆发：+50% 攻速
    const stats2 = calculateEquipmentStats(['nashor', 'malignance', 'lichBane'], { lichBaneActive: true });
    assert.equal(stats2.totalAs, 100); // 50 + 50

    // 装备帽子：AP 增幅 30% (S14.23 官方数值)
    const stats3 = calculateEquipmentStats(['nashor', 'rabadon'], { lichBaneActive: false });
    // AP = (80 + 130) * 1.30 = 210 * 1.30 = 273
    assert.equal(stats3.totalAp, 273);
    assert.equal(stats3.hasRabadon, true);
  });

  test('黯炎火炬与物理转魔法：被动法强放大与物转法联动', () => {
    // 黯炎火炬(80 AP, 20 AH) + 3 层命中 (+12% AP)
    const statsTorch = calculateEquipmentStats(['blackfireTorch'], { torchStacks: 3 });
    assert.equal(statsTorch.baseAh, 20);
    // 80 * 1.12 = 89.6 -> 90
    assert.equal(statsTorch.totalAp, 90);

    // 装备大天使之杖(25 AH, 70 AP) + 兰德里的折磨(60 AP, 0 AH)
    const statsMage = calculateEquipmentStats(['archangelStaff', 'liandry']);
    assert.equal(statsMage.baseAh, 25);
    assert.equal(statsMage.totalAp, 130);

    // 装备公理圆弧(55 AD) + 朔极之矛(45 AD) = 100 AD
    // 开启物理转魔法：100 AD 100% 转化为 100 AP，且额外提升 15% AP
    const statsAdapt = calculateEquipmentStats(['axiomArc', 'shojin'], { adaptActive: true });
    assert.equal(statsAdapt.totalAd, 0); // AD 被转化为 AP
    // AP = 100 * 1.15 = 115
    assert.equal(statsAdapt.totalAp, 115);

    // 装备朔极之矛：不加大招急速，仅提供 25 基础技能急速 (basicAh)
    const statsShojin = calculateEquipmentStats(['shojin']);
    assert.equal(statsShojin.baseAh, 0); // 通用急速为 0
    assert.equal(statsShojin.basicAh, 25); // 基础小技能急速 +25
    assert.equal(statsShojin.ultAh, 0); // 大招急速 +0

    // 装备帝国指令 (60 AP, 15 AH)：寒冰大招定身控制触发协同特化，额外提供 20 AH
    const statsMandateOn = calculateEquipmentStats(['imperialMandate'], { heroKey: 'ashe', mandateCcActive: true });
    assert.equal(statsMandateOn.hasImperialMandate, true);
    assert.equal(statsMandateOn.mandateCcActive, true);
    assert.equal(statsMandateOn.mandateCcBonus, 20);
    assert.equal(statsMandateOn.baseAh, 35); // 15 基础 + 20 控制特化协同
    assert.equal(statsMandateOn.totalAp, 60);

    // 未触发控制协同（或死歌/船长大招无定身控制）：仅提供基础 15 AH，不享受定身缩短
    const statsMandateOff = calculateEquipmentStats(['imperialMandate'], { heroKey: 'ashe', mandateCcActive: false });
    assert.equal(statsMandateOff.mandateCcActive, false);
    assert.equal(statsMandateOff.mandateCcBonus, 0);
    assert.equal(statsMandateOff.baseAh, 15);

    const statsMandateKarthus = calculateEquipmentStats(['imperialMandate'], { heroKey: 'karthus' });
    assert.equal(statsMandateKarthus.mandateCcActive, false);
    assert.equal(statsMandateKarthus.mandateCcBonus, 0);
    assert.equal(statsMandateKarthus.baseAh, 15);
  });

  test('海斗锻体额外属性：额外法强与攻击力同样受到帽子火炬与符文的被动放大增强', () => {
    // 装备纳什 (80 AP) + 锻体额外法强 120 AP = 200 基础法强
    // 装备帽子 (+30% AP)：(80 + 120) * 1.30 = 260 AP
    const stats1 = calculateEquipmentStats(['nashor', 'rabadon'], { anvilAp: 120 });
    assert.equal(stats1.rawAp, 210); // 80 (nashor) + 130 (rabadon)
    assert.equal(stats1.anvilAp, 120);
    assert.equal(stats1.totalRawAp, 330);
    // 330 * 1.30 = 429
    assert.equal(stats1.totalAp, 429);

    // 锻体额外攻速 50% + 纳什 50% = 100% AS
    const statsAs = calculateEquipmentStats(['nashor'], { anvilAs: 50 });
    assert.equal(statsAs.totalAs, 100);

    // 锻体额外攻击力 50 AD + 锻体额外法强 50 AP + 物转法 (+15%)
    const statsAnvilAdapt = calculateEquipmentStats([], { anvilAd: 50, anvilAp: 50, adaptActive: true });
    // 50 AD 转为 50 AP，加上 50 锻体 AP = 100 基础 AP
    // 放大 15%：100 * 1.15 = 115 AP
    assert.equal(statsAnvilAdapt.totalAp, 115);
  });

  test('海克斯强化【王冠之重】：加3属性（AD/AP/AS）并按层数叠加，与海克斯质变联动', () => {
    // 装备纳什 (80 AP, 50% AS) + 朔极之矛 (45 AD)
    // 启用王冠之重：10 层背负（每层 +5% ➔ 提升 50%）
    const statsCrown = calculateEquipmentStats(['nashor', 'shojin'], {
      heavyCrownActive: true,
      heavyCrownStacks: 10,
    });
    // 基础: 45 AD, 80 AP, 50% AS
    // 提升 50%:
    // AD = 45 * 1.5 = 67.5 -> Math.round = 68
    // AP = 80 * 1.5 = 120
    // AS = 50 * 1.5 = 75
    assert.equal(statsCrown.totalAd, 68);
    assert.equal(statsCrown.totalAp, 120);
    assert.equal(statsCrown.totalAs, 75);

    // 质变联动 1：王冠之重 + 纯粹术师 (AS -> AH)
    // 75% AS 经纯粹术师 0.65 换算：75 * 0.65 = 48.75 AH (未启用王冠时仅 50 * 0.65 = 32.5 AH)
    const hasteWithPurist = calculateMayhemHaste({
      puristCaster: true,
      attackSpeed: statsCrown.totalAs,
    });
    assert.equal(hasteWithPurist.bonusHaste, 48.75);

    // 质变联动 2：王冠之重 + 物理转魔法 + 尤里卡 (AD -> AP -> AH)
    // 装备 100 AD, 100 AP
    // 王冠 20 层 (+100% 提升)：
    // AD 变为 200, 基础 AP 变为 200
    // 物理转魔法：200 AD 转化为 200 AP，再获 15% 放大
    // 最终 AP = (200 + 200) * 1.15 = 460 AP
    const statsSynergy = calculateEquipmentStats([], {
      anvilAd: 100,
      anvilAp: 100,
      heavyCrownActive: true,
      heavyCrownStacks: 20,
      adaptActive: true,
    });
    assert.equal(statsSynergy.totalAd, 0);
    assert.equal(statsSynergy.totalAp, 460);

    // 尤里卡 (AP × 30%): 460 * 0.3 = 138 AH!
    const hasteEureka = calculateMayhemHaste({
      eureka: true,
      ap: statsSynergy.totalAp,
    });
    assert.equal(hasteEureka.bonusHaste, 138);
  });

  test('终极大招伤害计算：艾希、死歌与船长大招加成与基础伤害', () => {
    // 艾希 2 级大招 (400 基础 + 100% AP)，AP = 300
    const asheDmg = calculateUltimateDamage({ heroKey: 'ashe', rank: 2, ap: 300 });
    assert.equal(asheDmg.totalDamage, 700);

    // 死歌 3 级大招 (500 基础 + 75% AP)，AP = 400
    const karthusDmg = calculateUltimateDamage({ heroKey: 'karthus', rank: 3, ap: 400 });
    assert.equal(karthusDmg.totalDamage, 800);
    assert.equal(karthusDmg.totalTeamDamage, 4000);

    // 船长 3 级大招 (单波 100 基础 + 10% AP，12 波全中 1200 基础 + 120% AP)，AP = 200
    const gpDmg = calculateUltimateDamage({ heroKey: 'gangplank', rank: 3, ap: 200 });
    assert.equal(gpDmg.totalDamage, 120);
    assert.equal(gpDmg.total12WaveDamage, 1440);
  });
});

