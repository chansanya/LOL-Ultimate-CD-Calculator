export const HEROES = {
  ashe: {
    id: 'ashe',
    name: '寒冰射手',
    source: 'LOL-Ultimate-Calculator-Spec.md 第 3 节：讨论与用户提供的技能截图，未独立核验。',
    version: null,
    versionVerified: false,
    verified: false,
    notes: 'E 的充能恢复、5 秒施放间隔、返还目标与游戏版本仍需实测；静态理论达标不代表已验证无限施放。',
    skills: {
      Q: {
        id: 'Q',
        name: '射手的专注',
        baseCooldowns: [0],
        inCooldownModel: false,
        notes: '普攻叠满 4 层后释放，不纳入普通冷却互刷模型。',
      },
      W: {
        id: 'W',
        name: '万箭齐发',
        baseCooldowns: [18, 14.5, 11, 7.5, 4],
        inCooldownModel: true,
        cooldownType: 'normal',
      },
      E: {
        id: 'E',
        name: '鹰击长空',
        baseCooldowns: [90, 80, 70, 60, 50],
        inCooldownModel: true,
        cooldownType: 'recharge',
        maxCharges: 2,
        castInterval: 5,
      },
      R: {
        id: 'R',
        name: '魔法水晶箭',
        baseCooldowns: [100, 80, 60],
        inCooldownModel: true,
        cooldownType: 'normal',
      },
    },
  },
};
