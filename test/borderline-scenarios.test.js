import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResult } from '../src/scoring.js';

const base = {
  q1:'pilot', q2:'event', q3:['residents'],
  q4:'Проект помогает жителям регулярно участвовать в локальных событиях.',
  q5:'b', q6:'helpers',
  q7:['concept','audience','partners','resources'],
  q8:{audience:'yes',value:'yes',participants:'yes',partners:'yes',resources:'yes',funding:'yes',costs:'no',revenue:'no'},
  q9:'tested', q10:'analyzed', q11:'who', q12:'data',
  q13:['audience','venue','partners'], q14:'partly', q15:'unknown'
};

const cases = [
  {name:'Пилот: Q10 и Q12 почти равны, но опыт слабее', overrides:{q10:'no_analysis',q12:'demand'}, expected:'q10'},
  {name:'Пилот: Q11 и Q12 почти равны, спрос уже подтверждён', overrides:{q11:'unknown',q12:'demand',q10:'changed'}, expected:'q11'},
  {name:'Пилот: Q11 и Q13 почти равны', overrides:{q11:'unknown',q12:'demand',q13:['audience']}, expected:'q11'},
  {name:'Пилот: Q6 и Q14 почти равны', overrides:{q6:'alone',q14:'stops',q11:'sources',q12:'demand'}, expected:'q6'},
  {name:'Работающий: Q14 против Q11', overrides:{q1:'working',q9:'regular',q10:'changed',q11:'unknown',q12:'demand',q13:['audience','venue','partners'],q14:'stops',q6:'helpers'}, expected:'q14'},
  {name:'Работающий: Q11 против Q12, оба слабые', overrides:{q1:'working',q9:'regular',q10:'changed',q11:'unknown',q12:'none',q13:['audience','venue','partners','experience'],q14:'directions',q6:'gathering'}, expected:'q11'},
  {name:'Первые шаги: Q9 против Q12', overrides:{q1:'first_steps',q9:'started',q10:'feedback',q11:'who',q12:'research',q13:['audience','venue'],q14:'stops'}, expected:'q9'},
];

test('пограничные профили: система выбирает ограничение не случайно', () => {
  const report = cases.map(c => {
    const answers = {...base,...c.overrides};
    const r = buildResult({answers,segment:'private'});
    return {name:c.name,expected:c.expected,actual:r.bottleneck,confidence:r.confidence.id,contradictions:r.contradictions};
  });
  console.log('\nBORDERLINE_SCENARIOS\n'+JSON.stringify(report,null,2));
  for (const row of report) assert.equal(row.actual,row.expected,row.name);
});
