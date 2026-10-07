import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { QUESTIONS, SEGMENTS, MAX_SCORE, optionLabel } from '../public/js/questions.js';
import { normalizeAnswers, buildResult, computeScores } from '../src/scoring.js';
import { personalize, aiEnabled } from '../src/ai.js';

// Все варианты ответа для вопросов, где они есть. Для multi берём неэксклюзивные
// варианты, чтобы «нет ресурсов» / «пока не знаю» не вытесняли остальные.
const choices = (q) => (q.options ?? []).filter((o) => !o.exclusive).map((o) => o.id);
const exclusive = (q) => (q.options ?? []).filter((o) => o.exclusive).map((o) => o.id);

// По одному ответу каждого формата: single, multi, text, matrix.
const sampleByType = {
  single: (q, i = 0) => q.options[i % q.options.length].id,
  multi: (q) => [choices(q)[0] ?? exclusive(q)[0]],
  text: (q) => 'Проект помогает жителям района находить занятия рядом с домом.',
  matrix: (q, i = 0) => Object.fromEntries(q.rows.map((r, n) => [r.id, q.columns[(n + i) % q.columns.length].id])),
};

function otherText(q) {
  return q.options?.some((o) => o.withText) ? { [q.id + '_other']: 'Свой вариант ответа' } : {};
}

// Полный набор ответов: для single/multi берём вариант с индексом i (по кругу),
// чтобы разные сценарии давали разные баллы.
function answersFor(index) {
  const raw = {};
  for (const q of QUESTIONS) {
    if (q.type === 'single') raw[q.id] = sampleByType.single(q, index);
    else if (q.type === 'multi') raw[q.id] = [choices(q)[index % choices(q).length]];
    else if (q.type === 'matrix') raw[q.id] = sampleByType.matrix(q, index);
    else raw[q.id] = sampleByType[q.type](q);
    Object.assign(raw, otherText(q));
  }
  return raw;
}

function run(raw, segment = 'private') {
  const { answers, errors } = normalizeAnswers(raw);
  assert.deepEqual(errors, [], `ответы не прошли проверку: ${errors.join(', ')}`);
  const result = buildResult({ answers, segment });
  const { total } = computeScores(answers);
  assert.equal(result.total, total);
  assert.ok(result.total >= 0 && result.total <= MAX_SCORE);
  assert.ok(result.resultStage?.title);
  assert.ok(result.strengths.length <= 3 && result.growthZones.length <= 3);
  assert.ok(result.growthZones.every((g) => g.text));
  assert.ok(result.roadmap.length >= 5 && result.roadmap.length <= 8);
  assert.ok(result.potential.length > 50 && result.nextStep.length > 50);
  assert.ok(['high', 'medium', 'preliminary'].includes(result.confidence.id));
  assert.equal(result.segment?.profile, SEGMENTS.find((s) => s.id === segment).profile);
  return result;
}

const SCENARIOS = 8;
const scenarios = Array.from({ length: SCENARIOS }, (_, i) => {
  const raw = answersFor(i);
  const segment = SEGMENTS[i % SEGMENTS.length];
  return { index: i + 1, raw, segment, result: run(raw, segment.id) };
});

const label = (id, value) => optionLabel(id, value) || value;

function answerLines(raw) {
  return QUESTIONS.map((q) => {
    let value;
    if (q.type === 'single') value = label(q.id, raw[q.id]);
    else if (q.type === 'multi') value = raw[q.id].map((id) => label(q.id, id)).join(', ');
    else if (q.type === 'matrix') {
      value = q.rows
        .map((r) => `${r.label.replace(/\?$/, '')}: ${q.columns.find((c) => c.id === raw[q.id][r.id]).label}`)
        .join(' · ');
    } else value = raw[q.id];
    return { title: q.title, type: q.type, value };
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const sourceLabel = process.env.DIAGNOSIS_LLM === '1' && aiEnabled
  ? `провайдер OpenAI, модель ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`
  : 'шаблонные тексты методики';

async function personalizeScenarios() {
  if (process.env.DIAGNOSIS_LLM !== '1') return;
  if (!aiEnabled) throw new Error('Для прогона через LLM задайте OPENAI_API_KEY (и OPENAI_BASE_URL, если провайдер не OpenAI).');
  for (const scenario of scenarios) {
    const personalized = await personalize({ answers: scenario.raw, result: scenario.result });
    if (!personalized?.personalized) throw new Error(`Сценарий ${scenario.index}: модель не вернула результат`);
    assert.equal(personalized.total, scenario.result.total, 'модель не должна менять балл');
    assert.deepEqual(personalized.growthZones.map((g) => g.id), scenario.result.growthZones.map((g) => g.id));
    scenario.result = personalized;
  }
}

function report() {
  const cards = scenarios.map(({ index, raw, segment, result: r }) => {
    const answers = answerLines(raw).map((a) =>
      `<li><span class="type">${esc(a.type)}</span><b>${esc(a.title)}</b><span>${esc(a.value)}</span></li>`).join('');
    const scores = r.scores.map((s) => {
      const width = Math.round((s.score / s.max) * 100);
      return `<div class="bar"><span>${esc(s.name)}</span><i style="width:${width}%"></i><em>${s.score}/${s.max}</em></div>`;
    }).join('');
    const list = (items, render) => items.length ? `<ul>${items.map(render).join('')}</ul>` : '<p class="empty">—</p>';
    return `
    <article id="s${index}">
      <header>
        <div>
          <p class="kicker">Сценарий ${index} · ${esc(segment.label)}</p>
          <h2>${esc(r.resultStage.title)}</h2>
          <p>${esc(r.resultStage.text)}</p>
        </div>
        <div class="score">${r.total}<small>из ${MAX_SCORE}</small></div>
      </header>
      <dl class="meta">
        <div><dt>Стадия проекта</dt><dd>${esc(r.stage.label)}</dd></div>
        <div><dt>Формат</dt><dd>${esc(r.format)}</dd></div>
        <div><dt>Аудитория</dt><dd>${esc(r.audience || '—')}</dd></div>
        <div><dt>Запрос</dt><dd>${esc(r.need.label)}</dd></div>
        <div><dt>Надёжность</dt><dd class="conf ${r.confidence.id}">${esc(r.confidence.label)}</dd></div>
        <div><dt>Сегмент</dt><dd>${esc(r.segment.profile)}</dd></div>
      </dl>
      ${r.contradictions.length ? `<p class="warn">Противоречия: ${r.contradictions.map(esc).join(' · ')}</p>` : ''}
      <h3>Баллы</h3>
      <div class="bars">${scores}</div>
      <div class="cols">
        <section><h3>Сильные стороны</h3>${list(r.strengths, (s) => `<li><b>${esc(s.title)}</b> <em>${s.score}/${s.max}</em><span>${esc(s.text)}</span></li>`)}</section>
        <section><h3>Зоны роста</h3>${list(r.growthZones, (g) => `<li><b>${esc(g.title)}</b> <em>${g.score}/${g.max}</em><span>${esc(g.text)}</span></li>`)}</section>
      </div>
      <h3>Потенциал</h3><p>${esc(r.potential)}</p>
      <h3>Ближайший шаг</h3><p>${esc(r.nextStep)}</p>
      ${r.subjectiveMismatch ? `<p class="warn">${esc(r.subjectiveMismatch.text)}</p>` : ''}
      <h3>Дорожная карта</h3>
      <ol>${r.roadmap.map((s) => `<li><b>${esc(s.title)}</b><span>${esc(s.text)}</span></li>`).join('')}</ol>
      <details><summary>Ответы, на которых построен результат</summary><ul class="answers">${answers}</ul></details>
    </article>`;
  }).join('');

  const nav = scenarios.map(({ index, result: r }) =>
    `<a href="#s${index}"><b>${index}</b> ${r.total}/${MAX_SCORE}<span>${esc(r.resultStage.title)}</span></a>`).join('');

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Результаты диагностики — авто-тест</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f4ef; --card:#fff; --ink:#1d1a16; --muted:#6d675f; --line:#e4dfd6; --accent:#0f6e56; --warn:#8a4b08; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161411; --card:#211e1a; --ink:#f3efe8; --muted:#b3ab9f; --line:#3a342c; --accent:#7dcea0; --warn:#e6b15c; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  main { max-width:960px; margin:0 auto; padding:32px 20px 80px; }
  h1 { font-size:28px; margin:0 0 4px; }
  .lead { color:var(--muted); margin:0 0 24px; }
  nav { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px; margin-bottom:28px; }
  nav a { display:block; padding:10px 12px; background:var(--card); border:1px solid var(--line); border-radius:10px; text-decoration:none; color:inherit; }
  nav a b { color:var(--accent); }
  nav a span { display:block; color:var(--muted); font-size:13px; }
  article { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:24px; margin-bottom:20px; }
  article header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
  .kicker { color:var(--muted); font-size:13px; margin:0; }
  h2 { margin:2px 0 6px; font-size:22px; }
  .score { font-size:40px; font-weight:700; color:var(--accent); line-height:1; text-align:right; }
  .score small { display:block; font-size:13px; font-weight:500; color:var(--muted); }
  .meta { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px 16px; margin:16px 0; }
  .meta div { border-top:1px solid var(--line); padding-top:6px; }
  dt { color:var(--muted); font-size:12px; }
  dd { margin:0; }
  .conf.high { color:var(--accent); } .conf.preliminary { color:var(--warn); }
  .warn { background:color-mix(in srgb, var(--warn) 12%, transparent); border-radius:8px; padding:8px 12px; }
  h3 { font-size:15px; margin:20px 0 8px; }
  .bar { display:grid; grid-template-columns:minmax(160px,1fr) 3fr auto; gap:10px; align-items:center; margin:4px 0; font-size:14px; }
  .bar i { display:block; height:8px; border-radius:4px; background:var(--line); position:relative; }
  .bar i::before { content:""; position:absolute; inset:0 auto 0 0; width:inherit; background:var(--accent); border-radius:4px; }
  .bar em { font-style:normal; color:var(--muted); font-size:13px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  ul, ol { margin:0; padding-left:18px; }
  li { margin:6px 0; }
  li span { display:block; color:var(--muted); }
  li em { font-style:normal; color:var(--accent); font-size:13px; }
  .empty { color:var(--muted); }
  details { margin-top:16px; }
  summary { cursor:pointer; color:var(--muted); }
  .answers .type { display:inline-block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); margin-right:6px; }
  @media (max-width:700px) { .cols, .bar { grid-template-columns:1fr; } }
</style></head>
<body><main>
  <h1>Результаты диагностики</h1>
  <p class="lead">${SCENARIOS} фиктивных сценариев: в каждом ответы сдвинуты на один вариант, поэтому покрыты все форматы — одиночный выбор, несколько вариантов, свободный текст и матрица. Тексты: ${esc(sourceLabel)}.</p>
  <nav>${nav}</nav>
  ${cards}
</main></body></html>`;
}

const REPORT = new URL('./diagnosis-report.html', import.meta.url);

test('все четыре формата ответов принимаются и дают результат', () => {
  const used = new Set(QUESTIONS.map((q) => q.type));
  assert.deepEqual([...used].sort(), ['matrix', 'multi', 'single', 'text']);
  const { result } = scenarios[0];
  assert.equal(typeof result.problem, 'string'); // свободный ответ (text)
  assert.ok(result.audience.includes('жители')); // множественный выбор (multi)
});

test('каждый вариант каждого формата даёт корректный результат', () => {
  const seen = new Set(scenarios.map(({ result }) => result.resultStage.id));
  const totals = new Set(scenarios.map(({ result }) => result.total));
  assert.ok(seen.size >= 3, `ожидалось несколько стадий результата, получено: ${[...seen].join(', ')}`);
  assert.ok(totals.size >= 4, 'разные ответы должны давать разные баллы');
});

test('«Другое» со свободным текстом попадает в результат', () => {
  const raw = answersFor(0);
  raw.q2 = 'other';
  raw.q2_other = 'Фестиваль-лаборатория';
  raw.q3 = ['other'];
  raw.q3_other = 'Ветераны района';
  const result = run(raw);
  assert.equal(result.format, 'Фестиваль-лаборатория');
  assert.equal(result.audience, 'Ветераны района');
});

test('эксклюзивный вариант вытесняет остальные в множественном выборе', () => {
  const raw = answersFor(0);
  raw.q13 = ['venue', 'funding', 'none'];
  const { answers } = normalizeAnswers(raw);
  assert.deepEqual(answers.q13, ['none']);
  const result = buildResult({ answers, segment: 'nko' });
  assert.equal(result.scores.find((s) => s.id === 'q13').score, 0);
});

test('неполный ответ любого формата отклоняется и не даёт результата', () => {
  const raw = answersFor(0);
  delete raw.q1; // single
  raw.q4 = 'коротко'; // text короче минимума
  raw.q7 = []; // multi без выбора
  delete raw.q8.costs; // matrix без строки
  const { errors } = normalizeAnswers(raw);
  assert.deepEqual([...errors].sort(), ['q1', 'q4', 'q7', 'q8']);
});

test('отчёт с результатами диагностики записывается для просмотра', async () => {
  await personalizeScenarios();
  const html = report();
  writeFileSync(REPORT, html);
  assert.ok(html.includes('Сценарий 1') && html.includes('Сценарий 8'));
  assert.equal(scenarios.length, SCENARIOS);
  if (process.env.DIAGNOSIS_LLM === '1') assert.ok(scenarios.every(({ result }) => result.personalized));
  console.log(`\nОтчёт (${sourceLabel}): ${REPORT.pathname}`);
});
