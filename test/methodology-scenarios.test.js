import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResult } from '../src/scoring.js';

const base = {
  q1:'first_steps', q2:'event', q3:['residents'],
  q4:'Помогаем жителям района регулярно встречаться и решать общие локальные задачи.',
  q5:'b', q6:'helpers',
  q7:['concept','audience','launch'],
  q8:{audience:'yes',value:'yes',participants:'yes',partners:'no',resources:'no',funding:'no',costs:'no',revenue:'no'},
  q9:'started', q10:'no_analysis', q11:'unknown', q12:'none',
  q13:['audience'], q14:'stops', q15:'unknown'
};

const scenario = (name, overrides, expected, why) => {
  const answers = {...base, ...overrides, q8:{...base.q8,...(overrides.q8||{})}};
  return {name, answers, expected, why};
};

const cases = [
  scenario('1. Идея без проверки спроса',
    {q1:'idea',q9:'thinking',q10:'none',q11:'unknown',q12:'none',q13:['none'],q14:'stops',q15:'audience_needs'},
    'q12','На стадии идеи хотим прежде всего получить подтверждение востребованности.'),
  scenario('2. Идея с неясной связью проблемы и решения',
    {q1:'idea',q5:'a',q9:'thinking',q10:'none',q11:'who',q12:'talks',q13:['audience'],q14:'stops',q15:'concept'},
    'q5','Главный пробел — нельзя уверенно объяснить, что именно меняет проект.'),
  scenario('3. Первые шаги без извлечения опыта',
    {q1:'first_steps',q9:'started',q10:'no_analysis',q11:'who',q12:'research',q13:['audience','venue'],q14:'stops',q15:'pilot'},
    'q10','Действия уже начались, но опыт ещё не превращается в решения.'),
  scenario('4. Пилот есть, спрос есть, ресурсная модель не собрана',
    {q1:'pilot',q9:'tested',q10:'analyzed',q11:'unknown',q12:'demand',q13:['audience','venue','experience'],q14:'partly',q15:'funding'},
    'q11','Практика и спрос подтверждены; слабое место — за счёт чего продолжать работу.'),
  scenario('5. Пилот есть, ресурсы есть, спрос не подтверждён',
    {q1:'pilot',q9:'tested',q10:'analyzed',q11:'model',q12:'none',q13:['audience','venue','partners','experience'],q14:'partly',q15:'audience_needs'},
    'q12','Ресурсная база уже есть, но нет доказательства востребованности.'),
  scenario('6. Работающий проект держится на авторе',
    {q1:'working',q9:'regular',q10:'changed',q11:'sources',q12:'demand',q13:['audience','venue','partners','funding','experience'],q14:'stops',q6:'alone',q15:'scaling'},
    'q14','Для работающего проекта зависимость от автора — ключевое ограничение следующего этапа.'),
  scenario('7. Работающий проект с хорошим спросом, но слабой ресурсной моделью',
    {q1:'working',q9:'regular',q10:'changed',q11:'unknown',q12:'demand',q13:['audience','venue','experience'],q14:'directions',q6:'gathering',q15:'funding'},
    'q11','Спрос и практика есть, но устойчивость ресурсов не определена.'),
  scenario('8. Некоммерческое сообщество: команда слабая, спрос сильный',
    {q1:'working',q2:'community',q9:'regular',q10:'changed',q11:'who',q12:'demand',q13:['audience','venue','partners','experience'],q14:'partly',q6:'helpers',q15:'team'},
    'q6','Для этого проекта деньги не должны автоматически стать главным ограничением; ответственность людей важнее.'),
  scenario('9. Проект заявлен работающим, но действий не было',
    {q1:'working',q9:'thinking',q10:'none',q11:'sources',q12:'demand',q13:['audience','partners','funding'],q14:'autonomous',q6:'alone',q15:'scaling'},
    'q9','Здесь ожидаем противоречие и предварительную надёжность; фактическая проверка практикой важнее заявления о стадии.'),
  scenario('10. Идея с почти полной моделью, но без аудитории',
    {q1:'idea',q5:'b',q9:'thinking',q10:'none',q11:'model',q12:'none',q13:['partners','venue','experts'],q14:'stops',q3:['unknown'],
     q8:{audience:'no',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'yes',costs:'yes',revenue:'yes'},q15:'packaging'},
    'q12','Проверяем, не переоценивает ли система проработку модели при отсутствии реального подтверждения спроса.')
];

test('методологический прогон 10 синтетических профилей', () => {
  const report = cases.map(c => {
    const r = buildResult({answers:c.answers, segment:'private'});
    return {
      name:c.name,
      expected:c.expected,
      actual:r.bottleneck,
      focus:r.focus,
      confidence:r.confidence.id,
      contradictions:r.contradictions,
      growth:r.growthZones.map(x=>x.id),
      score:r.total,
      why:c.why
    };
  });
  console.log('\nMETHODOLOGY_SCENARIOS\n'+JSON.stringify(report,null,2));
  assert.equal(report.length, 10);
});
