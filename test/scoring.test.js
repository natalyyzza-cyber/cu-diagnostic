import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, MAX_SCORE } from '../public/js/questions.js';
import {
  normalizeAnswers, computeScores, buildResult, scoreQ7, scoreQ8, scoreQ13,
  pickGrowthZones, pickFocus, resultStage, INDICATORS, SCORED_IDS, modelCoverage, selectBottleneck,
} from '../src/scoring.js';

const allYes = { audience: 'yes', value: 'yes', participants: 'yes', partners: 'yes', resources: 'yes', funding: 'yes', costs: 'yes', revenue: 'yes' };
const allNo = Object.fromEntries(Object.keys(allYes).map((k) => [k, 'no']));

const minimal = {
  q1: 'idea', q2: 'community', q3: ['kids'], q4: 'Помогаем подросткам находить сообщества по интересам в своём районе.',
  q5: 'a', q6: 'alone', q7: ['all_myself'], q8: allNo, q9: 'thinking', q10: 'none',
  q11: 'unknown', q12: 'none', q13: ['none'], q14: 'stops', q15: 'unknown',
};
const maximal = {
  q1: 'working', q2: 'place', q3: ['residents', 'families'], q4: 'Создаём соседский центр, где жители района сами организуют досуг.',
  q5: 'b', q6: 'team', q7: ['concept', 'team', 'resources', 'analysis'], q8: allYes, q9: 'regular', q10: 'changed',
  q11: 'sources', q12: 'demand', q13: ['audience', 'venue', 'partners', 'experts', 'funding'], q14: 'autonomous', q15: 'scaling',
};

test('максимальная сумма баллов — 17', () => {
  assert.equal(MAX_SCORE, 17);
  assert.equal(QUESTIONS.length, 15);
});

test('минимальные и максимальные ответы', () => {
  assert.equal(computeScores(normalizeAnswers(minimal).answers).total, 0);
  assert.equal(computeScores(normalizeAnswers(maximal).answers).total, 17);
});

test('Q7: роль автора', () => {
  assert.equal(scoreQ7(['launch', 'manage']), 0);
  assert.equal(scoreQ7(['all_myself']), 0);
  assert.equal(scoreQ7(['concept']), 1);
  assert.equal(scoreQ7(['concept', 'audience', 'product']), 1); // одна группа
  assert.equal(scoreQ7(['concept', 'partners', 'city']), 2);
  assert.equal(scoreQ7(['concept', 'partners', 'city', 'all_myself']), 1);
});

test('Q8: покрывает три блока модели, а не только количество «Да»', () => {
  const valueOnly = { audience: 'yes', value: 'yes', participants: 'no', partners: 'no', resources: 'no', funding: 'no', costs: 'no', revenue: 'no' };
  const balanced = { audience: 'yes', value: 'yes', participants: 'yes', partners: 'yes', resources: 'yes', funding: 'no', costs: 'no', revenue: 'no' };
  assert.equal(scoreQ8(valueOnly), 0);
  assert.equal(scoreQ8(balanced), 0.5);
  assert.equal(scoreQ8(allYes), 1);
  assert.equal(modelCoverage(balanced).value.complete, true);
  assert.equal(modelCoverage(balanced).sustainability.yes, 0);
});

test('Q13: виды ресурсов, «нет ресурсов» исключает остальные', () => {
  assert.equal(scoreQ13(['none']), 0);
  assert.equal(scoreQ13(['venue']), 0);
  assert.equal(scoreQ13(['venue', 'media']), 1);
  assert.equal(scoreQ13(['venue', 'media', 'tech', 'city', 'experts']), 2);
  const { answers } = normalizeAnswers({ ...minimal, q13: ['venue', 'none'] });
  assert.deepEqual(answers.q13, ['none']);
});

test('валидация: незаполненные и «Другое» с текстом', () => {
  const { errors } = normalizeAnswers({ ...minimal, q5: undefined, q4: 'а' });
  assert.deepEqual(errors.sort(), ['q4', 'q5']);
  const { answers } = normalizeAnswers({ ...minimal, q2: 'other', q2_other: 'Фестиваль-лаборатория' });
  assert.equal(answers.q2_other, 'Фестиваль-лаборатория');
});

test('интерпретация общего балла', () => {
  assert.equal(resultStage(0).id, 'forming');
  assert.equal(resultStage(4).id, 'forming');
  assert.equal(resultStage(4.5).id, 'transition');
  assert.equal(resultStage(8).id, 'transition');
  assert.equal(resultStage(8.5).id, 'foundation');
  assert.equal(resultStage(12).id, 'foundation');
  assert.equal(resultStage(12.5).id, 'sustainable');
  assert.equal(resultStage(17).id, 'sustainable');
});

test('главное ограничение учитывает стадию и фактические доказательства', () => {
  const answers = { ...minimal, q1: 'pilot', q9: 'tested', q10: 'feedback', q12: 'none', q11: 'model', q13: ['venue'], q15: 'scaling' };
  const scores = computeScores(answers).scores;
  const bottleneck = selectBottleneck(scores, answers, 'pilot');
  assert.equal(bottleneck, 'q12');
  const growth = pickGrowthZones(scores, 'pilot', 'scaling');
  const { focus, bottleneck: selected } = pickFocus(growth, 'scaling', answers, scores, 'pilot');
  assert.equal(selected, 'q12');
  assert.equal(focus, 'q12');
});

test('Q15 не переопределяет методический фокус', () => {
  const answers = { ...minimal, q1: 'pilot', q9: 'tested', q10: 'feedback', q12: 'none', q15: 'scaling' };
  const r = buildResult({ answers, segment: 'private' });
  assert.equal(r.focus, 'q12');
  assert.equal(r.needMatched, false);
});

test('у каждого возможного балла зоны роста есть текст', () => {
  for (const id of SCORED_IDS) {
    const q = QUESTIONS.find((x) => x.id === id);
    const possible = q.options?.filter((o) => 'score' in o).map((o) => o.score)
      ?? { q7: [0, 1, 2], q8: [0, 0.5, 1], q13: [0, 1, 2] }[id];
    for (const s of new Set(possible)) {
      if (s < q.max) assert.ok(INDICATORS[id].growthText[s], `${id}=${s}`);
    }
  }
});

test('полный результат: структура и ограничения', () => {
  for (const raw of [minimal, maximal]) {
    const { answers } = normalizeAnswers(raw);
    const r = buildResult({ answers, segment: 'nko' });
    assert.ok(r.total <= 17);
    assert.ok(r.strengths.length <= 3 && r.growthZones.length <= 3);
    assert.ok(r.bottleneck === null || SCORED_IDS.includes(r.bottleneck));
    assert.ok(r.modelCoverage && r.resourceGap !== undefined);
    assert.ok(r.strengths.every((s) => s.score === s.max));
    assert.ok(r.growthZones.every((g) => g.score < g.max && g.text));
    assert.ok(r.roadmap.length >= 5 && r.roadmap.length <= 8, `roadmap ${r.roadmap.length}`);
    assert.ok(r.potential.length > 100 && r.nextStep.length > 100);
    assert.equal(r.segment.profile, 'B2B');
  }
});

test('стадия «идея» не получает шагов про масштабирование', () => {
  const { answers } = normalizeAnswers({ ...minimal, q15: 'scaling' });
  const r = buildResult({ answers, segment: 'private' });
  assert.ok(!r.roadmap.some((s) => /тиражирован|масштаб/i.test(s.title)));
  assert.ok(!/масштаб/i.test(r.nextStep));
  // Запрос, не совпавший с зонами роста, упоминается в ближайшем шаге
  const r2 = buildResult({ answers: normalizeAnswers({ ...maximal, q1: 'pilot', q10: 'feedback', q15: 'promotion' }).answers, segment: 'private' });
  assert.equal(r2.focus, 'q10');
  assert.match(r2.nextStep, /научиться продвигать проект/);
});


test('стадийная интерпретация не считает нормальные для идеи дефициты проблемой', () => {
  const { answers } = normalizeAnswers(minimal);
  const r = buildResult({ answers, segment: 'private' });
  assert.ok(r.stageFit.some((x) => /стадии идеи/i.test(x)));
  assert.equal(r.confidence.id, 'preliminary');
  assert.equal(r.contradictions.length, 0);
});

test('противоречия снижают надёжность результата, но не ломают расчёт', () => {
  const raw = { ...minimal, q1: 'idea', q9: 'regular', q6: 'alone', q14: 'autonomous' };
  const { answers } = normalizeAnswers(raw);
  const r = buildResult({ answers, segment: 'private' });
  assert.ok(r.contradictions.length >= 2);
  assert.equal(r.confidence.id, 'preliminary');
  assert.equal(typeof r.total, 'number');
});

test('запрос участника может отличаться от диагностического фокуса', () => {
  const raw = { ...minimal, q15: 'scaling' };
  const { answers } = normalizeAnswers(raw);
  const r = buildResult({ answers, segment: 'private' });
  assert.ok(r.subjectiveMismatch);
  assert.equal(r.need.id, 'scaling');
});


test('Q15: любой пользовательский запрос безопасно проходит полный расчёт', () => {
  const needs = ['audience_needs','concept','team','partners','pilot','packaging','economics','city','funding','promotion','scaling','unknown'];
  for (const need of needs) {
    const { answers, errors } = normalizeAnswers({ ...maximal, q15: need });
    assert.deepEqual(errors, [], `q15=${need}`);
    const r = buildResult({ answers, segment: 'private' });
    assert.equal(r.need.id, need);
    assert.ok(r.nextStep.length > 100, `nextStep q15=${need}`);
    assert.ok(r.roadmap.length >= 5, `roadmap q15=${need}`);
  }
});
