import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResult, scoreQ8, modelCoverage } from '../src/scoring.js';

const q8 = (state) => Object.fromEntries(
  ['audience','value','participants','partners','resources','funding','costs','revenue'].map((key) => [key, state])
);

const common = {
  q2:'community', q3:['residents'],
  q4:'Помогаем жителям района регулярно встречаться и решать общие локальные задачи.',
  q5:'a', q6:'alone', q7:['concept','audience','launch'],
  q8:q8('unknown'), q9:'thinking', q10:'none', q11:'unknown',
  q12:'none', q13:['none'], q14:'stops', q15:'unknown'
};

test('контрольный профиль 1: самоуверенный новичок не получает подтверждённую модель из одной самооценки', () => {
  const answers = {
    ...common, q1:'idea', q5:'b', q8:q8('defined'),
    q11:'sources', q13:['audience','venue','partners','experts','funding'], q14:'autonomous'
  };
  const result = buildResult({ answers, segment:'private' });
  assert.equal(scoreQ8(answers.q8, answers), 0.5);
  assert.equal(result.bottleneck, 'q12');
  assert.equal(result.confidence.id, 'preliminary');
  assert.equal(result.contradictions.length, 0, 'оптимизм сам по себе не должен автоматически считаться противоречием');
});

test('контрольный профиль 2: самокритичный руководитель работающего проекта не обнуляет практические сигналы', () => {
  const answers = {
    ...common, q1:'working', q2:'community', q3:['residents','community'],
    q5:'a', q6:'team', q7:['concept','audience','team','partners','resources','analysis'],
    q8:q8('unknown'), q9:'regular', q10:'changed', q11:'sources', q12:'demand',
    q13:['audience','venue','partners','experts','funding'], q14:'stops', q15:'scaling'
  };
  const result = buildResult({ answers, segment:'private' });
  assert.equal(result.bottleneck, 'q14');
  assert.equal(result.scores.find(x => x.id === 'q8').score, 0);
  assert.ok(['medium','high'].includes(result.confidence.id));
  assert.ok(result.diagnosis.summary.length > 40);
});

test('контрольный профиль 3: предположения без практики остаются гипотезами', () => {
  const answers = {
    ...common, q1:'pilot', q2:'event', q6:'helpers',
    q7:['concept','audience','partners','resources'], q8:q8('assumption'),
    q9:'thinking', q10:'none', q11:'unknown', q12:'none',
    q13:['venue'], q14:'partly', q15:'pilot'
  };
  const result = buildResult({ answers, segment:'private' });
  assert.equal(scoreQ8(answers.q8, answers), 0);
  assert.equal(result.confidence.id, 'preliminary');
  assert.ok(result.diagnosis.openQuestion.length > 20);
  assert.ok(result.diagnosis.nextTest.length > 30);
});

test('контрольный профиль 4: проект с практикой может получить высокий Q8, но уверенность требует согласованности ответов', () => {
  const answers = {
    ...common, q1:'pilot', q2:'event', q6:'helpers',
    q7:['concept','audience','partners','resources'], q8:q8('tested'),
    q9:'tested', q10:'analyzed', q11:'model', q12:'demand',
    q13:['audience','venue','partners'], q14:'partly', q15:'pilot'
  };
  const result = buildResult({ answers, segment:'private' });
  assert.equal(scoreQ8(answers.q8, answers), 1);
  assert.ok(['medium','high'].includes(result.confidence.id));
  assert.ok(result.diagnosis.nextTest.length > 30);
});

test('контрольный профиль 5: небольшой некоммерческий проект может исключить ненужную коммерческую устойчивость', () => {
  const answers = {
    ...common, q1:'pilot', q2:'community', q3:['residents'],
    q5:'b', q6:'helpers', q7:['concept','audience','partners'],
    q8:{audience:'defined',value:'tested',participants:'defined',partners:'tested',resources:'defined',funding:'not_needed',costs:'not_needed',revenue:'not_needed'},
    q9:'tested', q10:'feedback', q11:'unknown', q12:'demand',
    q13:['venue','partners'], q14:'partly', q15:'unknown'
  };
  const result = buildResult({ answers, segment:'nko' });
  const coverage = modelCoverage(answers.q8, answers);
  assert.equal(coverage.sustainability.applicable, 0);
  assert.equal(coverage.sustainability.average, null);
  assert.ok(result.bottleneck);
  assert.ok(result.diagnosis.headline.length > 10);
  assert.ok(!result.contradictions.some(x => /финансирован|доход/i.test(x)), 'отсутствие коммерческого дохода не должно само по себе считаться противоречием');
});
