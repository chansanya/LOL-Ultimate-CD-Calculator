export const AUGMENTS = {
  archmage: {
    id: 'archmage',
    name: '大法师',
    defaultRatio: 0.3,
    source: 'LOL-Ultimate-Calculator-Spec.md 第 3 节：按释放技能基础 CD 返还给另一技能的讨论模型，未独立核验。',
    version: null,
    versionVerified: false,
    verified: false,
    notes: '返还比例使用小数；返还目标与实际游戏机制仍需实测。',
  },
  sorcerer: {
    id: 'sorcerer',
    name: '术士',
    defaultRatio: 0.1,
    source: 'LOL-Ultimate-Calculator-Spec.md 第 3 节：用户确认采用加算冷却缩减，未独立核验。',
    version: null,
    versionVerified: false,
    verified: false,
    notes: '在急速换算的冷却缩减上加算，综合冷却缩减上限为 100%。',
  },
};
