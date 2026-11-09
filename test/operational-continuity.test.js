import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResult, detectOperationalContinuity } from '../src/scoring.js';

const answers = {
  q1:'pilot',
  q2:'place',
  q3:['residents','children','families'],
  q4:'Мы вместе с жителями организовали несколько мероприятий во дворе. На них приходили люди, но посещаемость постепенно снижалась. Жители положительно отзываются об инициативе, однако регулярного расписания и распределения обязанностей нет. Хотим превратить разовые встречи в постоянно действующее пространство.',
  q5:'a',
  q6:'helpers',
  q7:['concept','audience','team','manage','launch','analysis','product'],
  q8:{audience:'assumption',value:'assumption',participants:'defined',partners:'defined',resources:'defined',funding:'unknown',costs:'unknown',revenue:'not_needed'},
  q9:'started',
  q10:'feedback',
  q11:'who',
  q12:'research',
  q13:['audience','venue','experience'],
  q14:'partly',
  q15:'audience_needs',
  q16:'Мы вместе с жителями организовали несколько мероприятий во дворе. На них приходили люди, но посещаемость постепенно снижалась. Жители положительно отзываются об инициативе, однако регулярного расписания и распределения обязанностей нет. Хотим превратить разовые встречи в постоянно действующее пространство.',
  q17:'Хочу понять, как привлечь аудиторию',
};

test('операционные препятствия в описании пространства меняют приоритет на регулярную организацию работы', () => {
  const signals = detectOperationalContinuity(answers);
  assert.equal(signals.active, true);
  assert.equal(signals.schedule, true);
  assert.equal(signals.responsibility, true);
  assert.equal(signals.attendance, true);

  const result = buildResult({answers,segment:'private'});
  assert.equal(result.bottleneck,'q6');
  assert.equal(result.focus,'q6');
  assert.equal(result.needMatched,true);
  assert.equal(result.subjectiveMismatch,null);
  assert.match(result.diagnosis.summary,/регулярн/iu);
  assert.match(result.diagnosis.nextTest,/расписан/iu);
  assert.match(result.diagnosis.nextTest,/обязанност/iu);
  assert.match(result.diagnosis.nextTest,/перестал|возвращ|приход/iu);
  assert.match(result.diagnosis.decisionAfterTest,/закрепите роли/iu);
});

test('снижение посещаемости без проблем с расписанием и ответственностью не форсирует приоритет Q6', () => {
  const lessSpecific = {
    ...answers,
    q4:'После нескольких мероприятий часть посетителей перестала приходить. Хотим понять, какие темы им интересны.',
    q16:'Провели мероприятие, часть людей не вернулась.',
  };
  assert.equal(detectOperationalContinuity(lessSpecific).active,false);
  assert.notEqual(buildResult({answers:lessSpecific,segment:'private'}).bottleneck,'q6');
});
