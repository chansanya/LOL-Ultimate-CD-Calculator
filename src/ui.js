import { createElement, Snowflake, ArrowUpRight, CodeXml, FlaskConical, BowArrow, SlidersHorizontal, RotateCcw, PencilRuler, ShieldCheck, Activity, CircleAlert, CircleCheck, Crosshair, ChartNoAxesCombined, Info, GitCompareArrows, TriangleAlert, Gauge, Repeat2, BookOpen, ChevronDown, Sparkles, WandSparkles, Target, Flag } from 'lucide';
import { calculateCooldown, getAsheRecommendations } from './engine.js';
import { HEROES } from './data/heroes.js';
import { AUGMENTS } from './data/augments.js';

const icons = { snowflake: Snowflake, 'arrow-up-right': ArrowUpRight, github: CodeXml, 'flask-conical': FlaskConical, 'bow-arrow': BowArrow, 'sliders-horizontal': SlidersHorizontal, 'rotate-ccw': RotateCcw, 'pencil-ruler': PencilRuler, 'shield-check': ShieldCheck, activity: Activity, 'circle-alert': CircleAlert, 'circle-check': CircleCheck, crosshair: Crosshair, 'chart-no-axes-combined': ChartNoAxesCombined, info: Info, 'git-compare-arrows': GitCompareArrows, 'triangle-alert': TriangleAlert, gauge: Gauge, 'repeat-2': Repeat2, 'book-open': BookOpen, 'chevron-down': ChevronDown, sparkles: Sparkles, 'wand-sparkles': WandSparkles, target: Target, flag: Flag };
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = (value) => value.toFixed(2);
const threshold = (value) => Number.isFinite(value) ? String(value) : '无有限急速解';
let mode = 'ashe';
let currentResult = null;
let lastAnnouncement = '';
const savedModes = {};
const defaultSkills = () => ({ A: { key: 'E', rank: 2, name: HEROES.ashe.skills.E.name, base: 80, extra: 0 }, B: { key: 'R', rank: 2, name: HEROES.ashe.skills.R.name, base: 80, extra: 0 } });
let skills = defaultSkills();

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const icon = icons[element.dataset.icon];
    if (icon && !element.firstElementChild) element.replaceChildren(createElement(icon, { 'aria-hidden': 'true', focusable: 'false' }));
  });
}

function renderSkillFields() {
  $('skills-fields').innerHTML = ['A', 'B'].map((side) => {
    const skill = skills[side];
    const rankCount = mode === 'ashe' ? HEROES.ashe.skills[skill.key].baseCooldowns.length : 5;
    return `<div class="skill-field"><div class="skill-field-head"><span class="skill-key ${side === 'B' ? 'r-key' : ''}">${escapeHtml(mode === 'ashe' ? skill.key : side)}</span><span>技能 ${side}</span>${mode === 'ashe' ? `<select id="key-${side}" data-side="${side}" aria-label="技能 ${side} 选择">${['W', 'E', 'R'].map((key) => `<option value="${key}" ${key === skill.key ? 'selected' : ''}>${key}</option>`).join('')}</select>` : ''}</div>
      <label for="name-${side}">技能名称</label><input id="name-${side}" type="text" maxlength="32" value="${escapeHtml(skill.name)}" required>
      <label for="rank-${side}">技能等级</label>${mode === 'ashe' ? `<select id="rank-${side}" data-side="${side}">${Array.from({ length: rankCount }, (_, index) => `<option value="${index + 1}" ${index + 1 === Number(skill.rank) ? 'selected' : ''}>${index + 1} 级</option>`).join('')}</select>` : `<input id="rank-${side}" type="number" min="1" max="99" step="1" value="${escapeHtml(skill.rank)}" inputmode="numeric">`}
      <label for="base-${side}">基础冷却</label><div class="input-with-unit"><input id="base-${side}" type="number" min="0" step="any" value="${escapeHtml(skill.base)}" inputmode="decimal" aria-describedby="base-hint-${side}"><span>秒</span></div><span class="sr-only" id="base-hint-${side}">基础冷却必须大于 0；寒冰预设也可编辑</span>
      <label for="extra-${side}">独立技能急速</label><div class="input-with-unit"><input id="extra-${side}" type="number" min="0" step="any" value="${escapeHtml(skill.extra)}" inputmode="decimal"><span>AH</span></div>
    </div>`;
  }).join('');
}

function renderAugments() {
  $('augment-fields').innerHTML = Object.values(AUGMENTS).map((augment) => {
    const isArchmage = augment.id === 'archmage';
    return `<div class="augment"><span class="augment-icon" data-icon="${isArchmage ? 'sparkles' : 'wand-sparkles'}"></span><div><div class="augment-name">${escapeHtml(augment.name)}</div><div class="augment-copy">${isArchmage ? '向另一技能返还基础 CD' : '在急速 CDR 上加算冷却缩减'}</div></div><label class="switch"><input type="checkbox" id="${augment.id}-enabled" checked aria-label="启用${escapeHtml(augment.name)}"><span class="switch-track"></span></label><div class="augment-bottom"><label for="${augment.id}">${isArchmage ? '基础 CD 返还比例' : '加算冷却缩减'}</label><div class="input-with-unit"><input type="number" id="${augment.id}" min="0" max="100" step="any" value="${augment.defaultRatio * 100}" inputmode="decimal"><span>%</span></div></div></div>`;
  }).join('');
}

function captureSkills() {
  ['A', 'B'].forEach((side) => {
    skills[side] = { key: $(`key-${side}`)?.value ?? skills[side].key, rank: $(`rank-${side}`).value, name: $(`name-${side}`).value, base: $(`base-${side}`).value, extra: $(`extra-${side}`).value };
  });
}

function setMode(nextMode) {
  if (nextMode === mode) return;
  captureSkills();
  savedModes[mode] = structuredClone(skills);
  skills = savedModes[nextMode] ? structuredClone(savedModes[nextMode]) : structuredClone(skills);
  if (nextMode === 'ashe' && !savedModes.ashe) skills = defaultSkills();
  mode = nextMode;
  updateModePresentation();
  renderSkillFields();
  update();
}

function updateModePresentation() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('custom-hero-field').hidden = mode !== 'custom';
  $('hero-note').textContent = mode === 'ashe' ? '艾希 · 技能数据来自需求文档，游戏版本未核验' : '自定义双技能 · 名称、等级与基础 CD 均可编辑';
  $('skill-note').textContent = mode === 'ashe' ? 'E 为充能恢复时间，最多 2 层；5 秒施放间隔未计入模型。Q 依赖普攻层数，不纳入普通 CD 互刷。' : '输入任意两个技能的基础 CD；等级仅作标记，不自动改变自定义基础 CD。';
}

function inputError(element, message) {
  element.setAttribute('aria-invalid', 'true');
  element.setCustomValidity(message);
  throw new RangeError(message);
}

function readNumber(id, label, { positive = false, max = Infinity, integer = false } = {}) {
  const element = $(id);
  const value = element.value.trim() === '' ? NaN : Number(element.value);
  if (!Number.isFinite(value)) inputError(element, `${label}不能为空，且必须为有限数值。`);
  if (value < 0 || (positive && value === 0)) inputError(element, `${label}必须${positive ? '大于 0' : '大于等于 0'}。`);
  if (value > max) inputError(element, `${label}不能超过 ${max}。`);
  if (integer && !Number.isInteger(value)) inputError(element, `${label}必须为整数。`);
  return value;
}

function readName(id, label) {
  const element = $(id);
  const value = element.value.trim();
  if (!value) inputError(element, `${label}不能为空。`);
  return value;
}

function readConfiguration() {
  $('config-form').querySelectorAll('[aria-invalid]').forEach((element) => { element.removeAttribute('aria-invalid'); element.setCustomValidity(''); });
  if (mode === 'custom') readName('hero-name', '英雄名称');
  const names = { A: readName('name-A', '技能 A 名称'), B: readName('name-B', '技能 B 名称') };
  const ranks = { A: readNumber('rank-A', '技能 A 等级', { positive: true, integer: true, max: 99 }), B: readNumber('rank-B', '技能 B 等级', { positive: true, integer: true, max: 99 }) };
  const input = {
    baseA: readNumber('base-A', '技能 A 基础冷却', { positive: true }),
    baseB: readNumber('base-B', '技能 B 基础冷却', { positive: true }),
    haste: readNumber('haste', '通用技能急速'),
    extraHasteA: readNumber('extra-A', '技能 A 独立急速'),
    extraHasteB: readNumber('extra-B', '技能 B 独立急速'),
    archmage: $('archmage-enabled').checked ? readNumber('archmage', '大法师比例', { max: 100 }) / 100 : 0,
    sorcerer: $('sorcerer-enabled').checked ? readNumber('sorcerer', '术士比例', { max: 100 }) / 100 : 0,
  };
  return { input, names, ranks, keys: { A: mode === 'ashe' ? $('key-A').value : 'A', B: mode === 'ashe' ? $('key-B').value : 'B' } };
}

function renderMetrics(config, result) {
  const { input, names, ranks, keys } = config;
  $('skill-metrics').innerHTML = ['A', 'B'].map((side) => {
    const other = side === 'A' ? 'B' : 'A';
    const effectiveHaste = input.haste + input[`extraHaste${side}`];
    const remaining = result[`remain${side}`];
    return `<article class="metric-skill"><div class="metric-skill-title"><span class="skill-key ${side === 'B' ? 'r-key' : ''}">${escapeHtml(keys[side])}</span><h3>${escapeHtml(names[side])}<small>${ranks[side]} 级${mode === 'ashe' && keys[side] === 'E' ? ' · 充能恢复模型' : ' · 普通冷却模型'}</small></h3></div>
      <div class="metric-row"><span>基础冷却</span><strong>${fmt(input[`base${side}`])} 秒</strong></div>
      <div class="metric-row"><span>有效技能急速</span><strong>${fmt(effectiveHaste)} AH</strong></div>
      <div class="metric-row"><span>综合冷却缩减</span><strong class="ice-value">${fmt(result[`cdr${side}`] * 100)}%</strong></div>
      <div class="metric-row"><span>实际冷却</span><strong>${fmt(result[`cd${side}`])} 秒</strong></div>
      <div class="metric-row"><span>来自 ${escapeHtml(keys[other])} 的返还</span><strong class="gold-value">${fmt(result[`refund${side}`])} 秒</strong></div>
      <div class="metric-row final-row"><span>剩余冷却</span><strong class="${remaining <= 1e-8 ? 'success-value' : 'warning-value'}">${fmt(remaining)}<small> 秒</small></strong></div></article>`;
  }).join('');
}

function renderCooldown(config, result) {
  const { input, names, keys } = config;
  $('cooldown-bars').innerHTML = ['A', 'B'].map((side) => {
    const base = input[`base${side}`];
    const cd = result[`cd${side}`];
    const refund = Math.min(cd, result[`refund${side}`]);
    const remaining = result[`remain${side}`];
    const reduced = base - cd;
    const descriptions = `冷却缩减 ${fmt(reduced)} 秒，有效返还 ${fmt(refund)} 秒，剩余冷却 ${fmt(remaining)} 秒`;
    return `<div><div class="bar-heading"><span>${escapeHtml(keys[side])} · ${escapeHtml(names[side])}</span><span>基础 CD ${fmt(base)} 秒</span></div><div class="cooldown-track" role="img" aria-label="${escapeHtml(keys[side])}：${descriptions}"><span class="cooldown-segment segment-cdr" style="width:${result[`cdr${side}`] * 100}%" title="冷却缩减 ${fmt(reduced)} 秒"></span><span class="cooldown-segment segment-refund" style="width:${refund / base * 100}%" title="有效返还 ${fmt(refund)} 秒"></span><span class="cooldown-segment segment-remain" style="width:${remaining / base * 100}%" title="剩余冷却 ${fmt(remaining)} 秒"></span></div><div class="bar-values"><span>缩减 ${fmt(reduced)} 秒</span><span>有效返还 ${fmt(refund)} 秒</span><span>剩余 ${fmt(remaining)} 秒</span></div></div>`;
  }).join('');
  const flowSide = (side) => `<div class="flow-skill"><span class="skill-key ${side === 'B' ? 'r-key' : ''}">${escapeHtml(keys[side])}</span><span>${escapeHtml(names[side])}</span></div>`;
  $('refund-flow').innerHTML = `${flowSide('A')}<div class="flow-paths"><div class="flow-path">释放 ${escapeHtml(keys.A)} → 返还 ${escapeHtml(keys.B)} <strong>${fmt(result.refundB)} 秒</strong></div><div class="flow-path reverse">返还 ${escapeHtml(keys.A)} <strong>${fmt(result.refundA)} 秒</strong> ← 释放 ${escapeHtml(keys.B)}</div></div>${flowSide('B')}`;
}

function renderSummary(config, result) {
  const finite = Number.isFinite(result.minHaste);
  const gap = finite ? Math.max(0, result.minHaste - config.input.haste) : Infinity;
  $('min-haste').textContent = threshold(result.minHaste);
  $('threshold-unit').hidden = !finite;
  $('min-haste').parentElement.classList.toggle('no-solution', !finite);
  $('threshold-gap').textContent = !finite ? '当前返还与术士配置无法给出有限阈值' : gap > 0 ? `距离最低整数阈值还差 ${fmt(gap)} 急速` : `当前急速 ${fmt(config.input.haste)}，已达到理论阈值`;
  $('threshold-gap').classList.toggle('warning', !result.theoreticalLoop);
  $('loop-status').className = `status-pill ${result.theoreticalLoop ? 'success' : 'warning'}`;
  $('loop-status').innerHTML = `<span data-icon="${result.theoreticalLoop ? 'circle-check' : 'circle-alert'}"></span>${result.theoreticalLoop ? '理论条件已达成' : '理论条件未达成'}`;
  $('loop-status').nextElementSibling.innerHTML = result.theoreticalLoop ? '一次对向释放后，<br>两技能剩余冷却均归零。' : '一次对向释放后，<br>仍有技能存在剩余冷却。';
  $('apply-min').disabled = !finite;
  $('apply-min').title = finite ? `将通用急速设为 ${result.minHaste}` : '无有限急速解，无法应用';
}

function renderLeveling(config) {
  const options = { haste: config.input.haste, extraHasteA: config.input.extraHasteA, extraHasteB: config.input.extraHasteB, archmage: config.input.archmage, sorcerer: config.input.sorcerer };
  const rows = getAsheRecommendations(options);
  const isStandardER = mode === 'ashe' && config.keys.A === 'E' && config.keys.B === 'R';
  $('table-context').textContent = isStandardER ? '当前配置列实时使用海克斯及独立急速' : '寒冰 ER 参考表；A 独立急速映射 E，B 映射 R';
  $('level-table').innerHTML = rows.map((row) => {
    const reference = { baseA: row.baseA, baseB: row.baseB, archmage: .3, extraHasteA: 0, extraHasteB: 0 };
    const without = calculateCooldown({ ...reference, sorcerer: 0 }).minHaste;
    const withSorcerer = calculateCooldown({ ...reference, sorcerer: .1 }).minHaste;
    const isCurrent = isStandardER && config.ranks.A === row.eRank && config.ranks.B === row.rRank && config.input.baseA === row.baseA && config.input.baseB === row.baseB;
    const recommended = (row.eRank === 2 && row.rRank === 2) || (row.eRank === 4 && row.rRank === 3);
    return `<tr class="${isCurrent ? 'current-row ' : ''}${recommended ? 'recommended-row' : ''}"><td><span class="table-rank">${row.eRank}</span></td><td><span class="table-rank r-rank">${row.rRank}</span></td><td>${fmt(row.baseA)} 秒</td><td>${fmt(row.baseB)} 秒</td><td>${without} AH</td><td>${withSorcerer} AH</td><td class="table-status ${row.theoreticalLoop ? '' : 'warning'}">${Number.isFinite(row.minHaste) ? `${row.minHaste} AH` : '无有限急速解'}</td><td><button type="button" class="row-apply" data-preset="${row.eRank},${row.rRank}" aria-label="应用 ${row.eRank}E 加 ${row.rRank}R 加点">${isCurrent ? '已选加点' : '应用加点'}</button></td></tr>`;
  }).join('');
  $('recommendations').innerHTML = [{ e: 2, r: 2, label: '中期成型', icon: 'target' }, { e: 4, r: 3, label: '后期进阶', icon: 'flag' }].map(({ e, r, label, icon }) => {
    const row = rows.find((item) => item.eRank === e && item.rRank === r);
    return `<article class="recommendation"><span class="recommendation-icon" data-icon="${icon}"></span><div><h3>${e}E + ${r}R<small>${label}</small></h3><p>基础 CD ${row.baseA} / ${row.baseB} 秒 · ${threshold(row.minHaste)}${Number.isFinite(row.minHaste) ? ' 急速' : ''}</p></div><button type="button" data-preset="${e},${r}" aria-label="应用 ${label} ${e}E 加 ${r}R 加点">应用加点</button></article>`;
  }).join('');
}

function renderInvalid(message) {
  currentResult = null;
  $('form-error').textContent = message;
  $('form-error').hidden = false;
  $('result-content').hidden = true;
  $('invalid-result').hidden = false;
  $('result-error').textContent = message;
  $('apply-min').disabled = true;
  $('cooldown-bars').innerHTML = '<p class="empty-chart">修正配置后显示冷却分解。</p>';
  $('refund-flow').replaceChildren();
  $('recommendations').replaceChildren();
  $('level-table').innerHTML = '<tr><td colspan="8">请先修正配置，随后恢复加点对照。</td></tr>';
}

function updateRange() {
  const value = Number($('haste').value);
  const position = Number.isFinite(value) ? Math.min(500, Math.max(0, value)) : 0;
  $('haste-range').value = String(position);
  $('haste-range').style.setProperty('--range-fill', `${position / 5}%`);
}

function update() {
  try {
    const config = readConfiguration();
    const result = calculateCooldown(config.input);
    currentResult = result;
    $('form-error').hidden = true;
    $('result-content').hidden = false;
    $('invalid-result').hidden = true;
    renderSummary(config, result);
    renderMetrics(config, result);
    renderCooldown(config, result);
    renderLeveling(config);
    const announcement = `${result.theoreticalLoop ? '理论互刷条件已达成' : '理论互刷条件未达成'}，最低通用急速：${threshold(result.minHaste)}`;
    if (announcement !== lastAnnouncement) { $('announcement').textContent = announcement; lastAnnouncement = announcement; }
  } catch (error) {
    renderInvalid(error instanceof RangeError ? error.message : '暂时无法计算，请重置配置后重试。');
    if (!(error instanceof RangeError)) console.error(error);
  }
  updateRange();
  hydrateIcons();
}

function applyPreset(eRank, rRank) {
  captureSkills();
  if (mode === 'custom') savedModes.custom = structuredClone(skills);
  const extraA = $('extra-A').value;
  const extraB = $('extra-B').value;
  mode = 'ashe';
  skills = { A: { key: 'E', rank: eRank, name: HEROES.ashe.skills.E.name, base: HEROES.ashe.skills.E.baseCooldowns[eRank - 1], extra: extraA }, B: { key: 'R', rank: rRank, name: HEROES.ashe.skills.R.name, base: HEROES.ashe.skills.R.baseCooldowns[rRank - 1], extra: extraB } };
  updateModePresentation();
  renderSkillFields();
  update();
  $('announcement').textContent = `已应用 ${eRank}E 加 ${rRank}R 加点，请检查当前急速是否达到理论阈值。`;
}

$('config-form').addEventListener('submit', (event) => event.preventDefault());
$('config-form').addEventListener('input', (event) => {
  const id = event.target.id;
  if (id === 'haste-range') $('haste').value = event.target.value;
  if (id === 'archmage-enabled' || id === 'sorcerer-enabled') $(id.replace('-enabled', '')).disabled = !event.target.checked;
  if (/^(key|rank)-[AB]$/.test(id) && mode === 'ashe') {
    captureSkills();
    const side = id.slice(-1);
    const key = $(`key-${side}`).value;
    const data = HEROES.ashe.skills[key];
    const rank = Math.max(1, Math.min(data.baseCooldowns.length, Number(skills[side].rank)));
    skills[side] = { ...skills[side], key, rank, name: data.name, base: data.baseCooldowns[rank - 1] };
    if (id.startsWith('key-')) renderSkillFields();
    else { $(`base-${side}`).value = String(data.baseCooldowns[rank - 1]); }
  }
  update();
});
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('apply-min').addEventListener('click', () => {
  if (!currentResult || !Number.isFinite(currentResult.minHaste)) return;
  $('haste').value = String(currentResult.minHaste);
  update();
});
$('leveling').addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  const [eRank, rRank] = button.dataset.preset.split(',').map(Number);
  applyPreset(eRank, rRank);
});
$('reset').addEventListener('click', () => {
  mode = 'ashe';
  skills = defaultSkills();
  delete savedModes.ashe;
  delete savedModes.custom;
  $('haste').value = '150';
  $('hero-name').value = '自定义英雄';
  renderAugments();
  renderSkillFields();
  updateModePresentation();
  update();
});

renderAugments();
renderSkillFields();
updateModePresentation();
update();
