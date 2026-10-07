import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResult } from '../src/scoring.js';

/*
 * Стресс-тест самооценки:
 * один и тот же проект получает более осторожные и более уверенные ответы
 * там, где человек легко может переоценить себя. Фактические признаки опыта
 * (Q9/Q10/Q12) в паре не меняются.
 *
 * Методический принцип: самооценка может менять детализацию результата, но не
 * должна без достаточных данных превращать результат в «высокую надёжность»
 * или уводить главное ограничение на другой индикатор.
 */

const ideaBase = {
  q1:'idea', q2:'community', q3:['residents'],
  q4:'Помогаем жителям района регулярно встречаться и решать общие локальные задачи.',
  q6:'alone', q7:['concept','audience','launch'],
  q9:'thinking', q10:'none', q12:'none', q15:'audience_needs'
};

const pilotBase = {
  q1:'pilot', q2:'event', q3:['residents'],
  q4:'Проводим локальные события и хотим понять, как сделать формат устойчивым.',
  q6:'helpers', q7:['concept','audience','partners','resources'],
  q9:'tested', q10:'analyzed', q11:'unknown', q12:'demand',
  q13:['audience','venue','partners'], q14:'partly', q15:'funding'
};

const workingBase = {
  q1:'working', q2:'community', q3:['residents','community'],
  q4:'Развиваем постоянное сообщество жителей вокруг регулярной программы.',
  q6:'team', q7:['concept','audience','team','partners','resources','analysis'],
  q9:'regular', q10:'changed', q11:'sources', q12:'demand',
  q13:['audience','venue','partners','experts','funding'],
  q14:'stops', q15:'scaling'
};

test('стресс-тест: ранняя идея не становится «высоконадёжной» от оптимистичной самооценки', () => {
  const cautious = {
    ...ideaBase,
    q5:'a',
    q8:{audience:'no',value:'no',participants:'no',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'},
    q11:'unknown', q13:['none'], q14:'stops'
  };
  const optimistic = {
    ...ideaBase,
    q5:'b',
    q8:{audience:'yes',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'yes',costs:'yes',revenue:'yes'},
    q11:'sources',
    q13:['audience','venue','partners','experts','funding'],
    q14:'autonomous'
  };

  const a = buildResult({answers:cautious,segment:'private'});
  const b = buildResult({answers:optimistic,segment:'private'});

  assert.equal(a.bottleneck,'q12');
  assert.equal(b.bottleneck,'q12');
  assert.equal(a.confidence.id,'preliminary');
  assert.equal(b.confidence.id,'preliminary');
});

test('стресс-тест: на пилоте изменение самооценки Q5/Q8 не уводит фокус от ресурсной модели', () => {
  const cautious = {
    ...pilotBase,
    q5:'a',
    q8:{audience:'yes',value:'no',participants:'no',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'}
  };
  const confident = {
    ...pilotBase,
    q5:'b',
    q8:{audience:'yes',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'no',costs:'no',revenue:'no'}
  };

  const a = buildResult({answers:cautious,segment:'private'});
  const b = buildResult({answers:confident,segment:'private'});

  assert.equal(a.bottleneck,'q11');
  assert.equal(b.bottleneck,'q11');
  assert.equal(a.confidence.id,'medium');
  assert.equal(b.confidence.id,'high');
});

test('стресс-тест: у работающего проекта переоценка Q5 не отменяет зависимость от автора', () => {
  const cautious = {...workingBase, q5:'a', q8:{audience:'no',value:'no',participants:'no',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'}};
  const confident = {...workingBase, q5:'b', q8:{audience:'yes',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'yes',costs:'yes',revenue:'yes'}};

  const a = buildResult({answers:cautious,segment:'private'});
  const b = buildResult({answers:confident,segment:'private'});

  assert.equal(a.bottleneck,'q14');
  assert.equal(b.bottleneck,'q14');
  assert.equal(a.confidence.id,'medium');
  assert.equal(b.confidence.id,'medium');
});

test('стресс-тест: осторожная и уверенная оценка востребованности на первых шагах не меняет следующий практический порог', () => {
  const cautious = {
    q1:'first_steps', q2:'event', q3:['residents'],
    q4:'Помогаем жителям района регулярно встречаться и решать общие локальные задачи.',
    q5:'a', q6:'helpers', q7:['concept','audience','launch'],
    q8:{audience:'yes',value:'no',participants:'no',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'},
    q9:'started', q10:'feedback', q11:'who', q12:'research',
    q13:['audience','venue'], q14:'stops', q15:'pilot'
  };
  const confident = {...cautious, q5:'b', q12:'demand'};

  const a = buildResult({answers:cautious,segment:'private'});
  const b = buildResult({answers:confident,segment:'private'});

  assert.equal(a.bottleneck,'q9');
  assert.equal(b.bottleneck,'q9');
  assert.ok(b.contradictions.length >= a.contradictions.length);
  assert.equal(b.confidence.id,'medium');
});

test('стресс-тест: самооценка влияет на надёжность только там, где это уместно', () => {
  const base = {
    q1:'working', q2:'community', q3:['residents'],
    q4:'Развиваем постоянное сообщество жителей.',
    q6:'team', q7:['concept','audience','team','partners','resources','analysis'],
    q9:'regular', q10:'changed', q11:'sources', q12:'demand',
    q13:['audience','venue','partners','experts','funding'], q14:'stops', q15:'scaling'
  };

  const cautious = {...base, q5:'a', q8:{audience:'no',value:'no',participants:'no',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'}};
  const confident = {...base, q5:'b', q8:{audience:'yes',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'yes',costs:'yes',revenue:'yes'}};

  const a = buildResult({answers:cautious,segment:'private'});
  const b = buildResult({answers:confident,segment:'private'});

  assert.equal(a.bottleneck,b.bottleneck);
  assert.equal(a.bottleneck,'q14');
  assert.equal(a.confidence.id,'medium');
  assert.equal(b.confidence.id,'medium');
});
