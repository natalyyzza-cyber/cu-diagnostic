// Методика выдачи результата диагностики городского проекта.
// Итоговый балл остаётся техническим ориентиром. Главный результат —
// ограничение следующего шага, его доказательства и одно действие для проверки.

import { QUESTIONS, MAX_SCORE, SEGMENTS, getQuestion, optionLabel } from '../public/js/questions.js';

export const SCORED_IDS = ['q5','q6','q7','q8','q9','q10','q11','q12','q13','q14'];

const clip = (s,n) => String(s ?? '').trim().slice(0,n);

export function normalizeAnswers(raw = {}) {
  const answers = {};
  const errors = [];
  for (const q of QUESTIONS) {
    const v = raw[q.id];
    if (q.type === 'single') {
      if (!q.options.some(o => o.id === v)) { errors.push(q.id); continue; }
      answers[q.id] = v;
      const opt = q.options.find(o => o.id === v);
      if (opt.withText) answers[q.id + '_other'] = clip(raw[q.id + '_other'], 200);
    } else if (q.type === 'multi') {
      const ids = Array.isArray(v) ? [...new Set(v)].filter(id => q.options.some(o => o.id === id)) : [];
      if (!ids.length) { errors.push(q.id); continue; }
      const exclusive = ids.find(id => q.options.find(o => o.id === id)?.exclusive);
      answers[q.id] = exclusive ? [exclusive] : ids;
      if (answers[q.id].includes('other')) answers[q.id + '_other'] = clip(raw[q.id + '_other'], 200);
    } else if (q.type === 'text') {
      const text = clip(v, q.maxLength);
      if (text.length < (q.minLength || 1)) { errors.push(q.id); continue; }
      answers[q.id] = text;
    } else if (q.type === 'matrix') {
      const out = {};
      let ok = true;
      for (const row of q.rows) {
        if (!q.columns.some(c => c.id === v?.[row.id])) { ok = false; break; }
        out[row.id] = v[row.id];
      }
      if (!ok) errors.push(q.id); else answers[q.id] = out;
    }
  }
  return { answers, errors };
}

export function scoreQ7(selected = []) {
  const q = getQuestion('q7');
  const groups = new Set(selected.map(id => q.options.find(o => o.id === id)?.group).filter(Boolean));
  if (!groups.size) return 0;
  if (selected.includes('all_myself')) return groups.size >= 3 ? 1 : 0;
  if (groups.size >= 3) return 2;
  return 1;
}

export function modelCoverage(matrix = {}) {
  const groups = {
    value: ['audience','value'],
    delivery: ['participants','partners','resources'],
    sustainability: ['funding','costs','revenue'],
  };
  return Object.fromEntries(Object.entries(groups).map(([id, rows]) => {
    const yes = rows.filter(row => matrix?.[row] === 'yes');
    return [id, { id, yes: yes.length, total: rows.length, complete: yes.length === rows.length, missing: rows.filter(row => matrix?.[row] !== 'yes') }];
  }));
}

export function scoreQ8(matrix = {}) {
  const coverage = modelCoverage(matrix);
  const blocks = Object.values(coverage).filter(Boolean);
  const domains = blocks.filter(x => x.yes > 0).length;
  const yes = blocks.reduce((sum, x) => sum + x.yes, 0);
  if (domains === 3 && yes >= 6) return 1;
  if (domains >= 2 && yes >= 3) return 0.5;
  return 0;
}

export function scoreQ13(selected = []) {
  const count = selected.filter(id => id !== 'none').length;
  return count >= 5 ? 2 : count >= 2 ? 1 : 0;
}

export function computeScores(answers) {
  const scores = {};
  for (const id of SCORED_IDS) {
    const q = getQuestion(id);
    scores[id] = id === 'q7' ? scoreQ7(answers.q7) :
      id === 'q8' ? scoreQ8(answers.q8) :
      id === 'q13' ? scoreQ13(answers.q13) :
      q.options.find(o => o.id === answers[id])?.score ?? 0;
  }
  return { scores, total: Math.min(Object.values(scores).reduce((a,b)=>a+b,0), MAX_SCORE) };
}

export const RESULT_STAGES = [
  { min:0,max:4,id:'forming',title:'Проект формируется',text:'Проект пока формируется: сейчас важнее всего прояснить основу и получить первые данные из практики.' },
  { min:4.5,max:8,id:'transition',title:'Переход к реализации',text:'Отдельные элементы уже есть; следующий шаг — связать их и проверить на реальных участниках.' },
  { min:8.5,max:12,id:'foundation',title:'Есть основа для развития',text:'У проекта уже есть несколько работающих элементов; важно укрепить главное ограничение следующего шага.' },
  { min:12.5,max:17,id:'sustainable',title:'Собрана устойчивая основа',text:'Проект имеет сильную основу; следующий фокус — устойчивость, распределение ролей и развитие.' },
];
export function resultStage(total) { return RESULT_STAGES.find(s=>total>=s.min&&total<=s.max) ?? RESULT_STAGES[0]; }

export const INDICATORS = {
 q5:{name:'Связь проблемы, решения и результата',strengthTitle:'Понятна связь проблемы и решения',growthTitle:'Уточнить связь проблемы и решения',growthText:{0:'Пока трудно точно объяснить, как проект решает проблему. Сформулируйте для кого проект, что именно изменится и как это можно будет заметить.'},strengthText:'Вы можете объяснить связь между проблемой, действием проекта и результатом для людей.'},
 q6:{name:'Ответственность команды',strengthTitle:'Другие люди уже отвечают за части проекта',growthTitle:'Передать ответственность за часть проекта',growthText:{0:'Сейчас ответственность за важные части проекта в основном остаётся у вас. Выберите одну повторяющуюся задачу или направление и передайте его конкретному человеку.',1:'Другие люди уже отвечают за отдельные части проекта. Следующий шаг — закрепить самостоятельную ответственность за направление с понятным результатом.'},strengthText:'Другие люди уже отвечают за отдельные задачи или направления проекта.'},
 q7:{name:'Охват управленческих ролей автора',strengthTitle:'Видите проект как целое',growthTitle:'Выделить время на развитие проекта',growthText:{0:'Сейчас в ответах преобладают текущие задачи. Выделите регулярное время на аудиторию, партнёров, ресурсы и анализ результатов.',1:'Вы уже работаете с развитием проекта, но пока не все его части связаны. Сверьте на одной странице аудиторию, ценность, людей, ресурсы и результаты.'},strengthText:'Вы работаете не только с текущими задачами, но и с несколькими связанными сторонами развития проекта.'},
 q8:{name:'Целостность модели проекта',strengthTitle:'Модель проекта собрана по основным блокам',growthTitle:'Собрать недостающую часть модели',growthText:{0:'Пока не собрана связная картина проекта. Отдельно зафиксируйте ценность, способ реализации и то, за счёт чего проект сможет продолжать работу.',0.5:'Основные элементы уже видны, но один из блоков модели остаётся неполным. Сверьте ценность, реализацию и устойчивость и закройте самый важный пробел.'},strengthText:'Вы можете уверенно ответить на большинство вопросов о ценности, реализации и устойчивости проекта.'},
 q9:{name:'Практическая проверка',strengthTitle:'Идея уже проверяется практикой',growthTitle:'Получить следующий практический опыт',growthText:{0:'Пока не было конкретных действий. Проведите небольшой тест для реальных людей и заранее решите, что хотите проверить.',0.5:'Первые действия уже есть. Следующий запуск сделайте именно проверкой гипотезы: определите критерий успеха и соберите факты.'},strengthText:'Проект уже прошёл практическую проверку через встречи, мероприятия, пилот или регулярную работу.'},
 q10:{name:'Обучение на опыте',strengthTitle:'Опыт превращается в изменения',growthTitle:'Превращать опыт в решения',growthText:{0:'Опыт ещё не превращается в выводы. После следующего действия зафиксируйте: что получилось, что нет и что меняете.',0.5:'Обратная связь уже есть, но её можно сильнее связывать с решениями. Выберите 1–2 повторяющихся сигнала и проверьте изменения на следующем запуске.'},strengthText:'Вы анализируете опыт и обратную связь и меняете проект по их итогам.'},
 q11:{name:'Модель ресурсов и финансирования',strengthTitle:'Понятно, за счёт чего проект может работать',growthTitle:'Проработать модель ресурсов',growthText:{0:'Пока неясно, кто получает пользу, какие ресурсы нужны и за счёт чего проект сможет продолжать работу. Составьте карту источников денег, времени, площадок, людей и других ресурсов.',1:'Потенциальные источники поддержки уже понятны, но модель не определена. Опишите хотя бы один сценарий: кто даёт какие ресурсы, на каких условиях и какие расходы это покрывает.',2:'Уже понятны основные источники поддержки и затраты. Следующий шаг — проверить альтернативный источник или снизить зависимость от одного канала.'},strengthText:'Понятно, кто получает пользу, какие ресурсы и затраты нужны и за счёт чего проект может продолжать работу.'},
 q12:{name:'Подтверждение востребованности',strengthTitle:'Востребованность подтверждена действиями людей',growthTitle:'Получить доказательство востребованности',growthText:{0:'Пока востребованность не проверялась. Поговорите с представителями аудитории об их опыте и проблеме, а затем проверьте действие: участие, запись, повторный приход, рекомендацию или оплату.',0.5:'Есть первые разговоры, но пока мало независимых данных. Проведите структурированные интервью или наблюдение.',1:'Данные уже собираются. Следующий шаг — проверить поведение людей: возвращаются ли они, участвуют ли регулярно, рекомендуют ли проект или готовы поддерживать его ресурсами.'},strengthText:'Востребованность подтверждается реальным поведением участников: участием, возвращением, рекомендациями, заказами или другими действиями.'},
 q13:{name:'Ресурсная база',strengthTitle:'У проекта есть несколько подтверждённых ресурсов',growthTitle:'Закрыть критический ресурс следующего шага',growthText:{0:'Сейчас ресурсная база узкая. Определите, без какого ресурса не получится ближайшее действие, и найдите конкретного владельца этого ресурса.',1:'У проекта уже есть несколько видов ресурсов. Теперь важно не собирать их количество, а закрыть тот ресурс, который критичен для ближайшего запуска.'},strengthText:'У проекта уже есть несколько видов ресурсов, на которые можно опираться.'},
 q14:{name:'Зависимость от автора',strengthTitle:'Проект не полностью зависит от автора',growthTitle:'Передать одну ответственность',growthText:{0:'Если вы перестанете заниматься проектом, он остановится. Выберите одну задачу и передайте её другому человеку с понятным результатом.',1:'Часть работы уже можно передать. Закрепите за другим человеком одно направление и проверьте, сможет ли он вести его самостоятельно.',2:'Отдельные направления уже продолжаются без вас. Следующий шаг — распределить ответственность так, чтобы проект сохранял работу без постоянного участия автора.'},strengthText:'В проекте уже есть люди, партнёры или сообщество, которые берут на себя часть работы без постоянного участия автора.'},
};

const STAGE_PRIORITY = {
 idea:['q12','q5','q8','q9','q10','q6','q13','q11','q7','q14'],
 first_steps:['q9','q12','q10','q5','q6','q8','q13','q11','q7','q14'],
 pilot:['q10','q12','q11','q13','q6','q14','q7','q8','q5','q9'],
 working:['q14','q11','q12','q13','q6','q10','q7','q8','q5','q9'],
};
const STAGE_WEIGHT = {
 idea:{q5:3,q12:3,q8:2,q9:2,q10:1,q13:1,q6:1,q7:1,q11:1,q14:0.5},
 first_steps:{q9:3,q12:3,q10:2,q5:2,q6:2,q8:1,q13:1,q11:1,q7:1,q14:1},
 pilot:{q10:3,q12:3,q11:2,q13:2,q6:2,q14:2,q7:1,q8:1,q5:1,q9:1},
 working:{q14:3,q11:3,q12:3,q13:2,q6:2,q10:2,q7:2,q8:1,q5:1,q9:1},
};

function isRelevant(id,stage) { return (STAGE_WEIGHT[stage]?.[id] ?? 1) >= 2; }
function normalizedGap(id,scores) {
  const q=getQuestion(id); const max=q?.max||1; return Math.max(0,1-(scores[id]??0)/max);
}

export function pickStrengths(scores,stage='working') {
  return SCORED_IDS.filter(id=>scores[id]===getQuestion(id).max)
    .sort((a,b)=>(STAGE_PRIORITY[stage]?.indexOf(a)??99)-(STAGE_PRIORITY[stage]?.indexOf(b)??99))
    .slice(0,3);
}

export function pickGrowthZones(scores,stage='working',need='unknown') {
  const candidates=SCORED_IDS.filter(id=>scores[id]<getQuestion(id).max && isRelevant(id,stage));
  candidates.sort((a,b)=>{
    const ga=normalizedGap(a,scores)*((STAGE_WEIGHT[stage]?.[a]??1));
    const gb=normalizedGap(b,scores)*((STAGE_WEIGHT[stage]?.[b]??1));
    if (gb!==ga) return gb-ga;
    const needIds=NEED_TO_INDICATORS[need]??[];
    const na=needIds.includes(a)?-1:0, nb=needIds.includes(b)?-1:0;
    if (na!==nb) return na-nb;
    return (STAGE_PRIORITY[stage]?.indexOf(a)??99)-(STAGE_PRIORITY[stage]?.indexOf(b)??99);
  });
  return candidates.slice(0,3);
}

const NEED_TO_INDICATORS = {
 audience_needs:['q12','q5','q8'],
 concept:['q5','q8','q7'],
 team:['q6','q14'],
 partners:['q13','q6'],
 pilot:['q9','q10','q12'],
 packaging:['q5','q8'],
 economics:['q11','q8'],
 city:['q13','q7'],
 funding:['q11','q13'],
 promotion:['q12','q5'],
 scaling:['q14','q11','q13'],
 unknown:[],
};

const STAGE_BOTTLENECKS = {
 idea:['q12','q5','q8','q9'],
 first_steps:['q9','q12','q10','q5','q6'],
 pilot:['q10','q12','q11','q13','q6','q14'],
 working:['q14','q11','q12','q13','q6','q10'],
};

function bottleneckEvidencePenalty(id, answers) {
  if (id==='q12') return answers.q12==='demand' ? 0 : answers.q12==='data' ? 0.15 : answers.q12==='research' ? 0.35 : 0.55;
  if (id==='q9') return ['tested','regular'].includes(answers.q9) ? 0 : answers.q9==='started' ? 0.25 : 0.5;
  if (id==='q10') return ['analyzed','changed'].includes(answers.q10) ? 0 : answers.q10==='feedback' ? 0.25 : 0.5;
  if (id==='q5') return answers.q5==='b' ? 0 : 0.45;
  if (id==='q8') return 0;
  if (id==='q11') return answers.q11==='sources' ? 0 : answers.q11==='model' ? 0.15 : answers.q11==='who' ? 0.3 : 0.5;
  if (id==='q13') return (answers.q13??[]).includes('none') ? 0.5 : 0;
  if (id==='q6') return ['gathering','team'].includes(answers.q6) ? 0 : 0.35;
  if (id==='q14') return answers.q14==='autonomous' ? 0 : 0.1;
  return 0;
}

export function selectBottleneck(scores,answers,stage) {
  const ids=STAGE_BOTTLENECKS[stage]??SCORED_IDS;
  const candidates=ids.filter(id=>scores[id]<getQuestion(id).max);
  if (!candidates.length) return null;
  candidates.sort((a,b)=>{
    const selfAssessmentFactor = id => ['q5','q6','q8'].includes(id) ? 0.7 : 1;
    const ga=normalizedGap(a,scores)*(STAGE_WEIGHT[stage]?.[a]??1)*selfAssessmentFactor(a)+bottleneckEvidencePenalty(a,answers);
    const gb=normalizedGap(b,scores)*(STAGE_WEIGHT[stage]?.[b]??1)*selfAssessmentFactor(b)+bottleneckEvidencePenalty(b,answers);
    // Если ограничения практически равны, приоритет стадии должен быть
    // сильнее небольшой разницы в самооценке/доказательствах. Это не даёт
    // пограничным профилям «скакать» между соседними индикаторами.
    if (Math.abs(gb-ga) > 0.5) return gb-ga;
    return (STAGE_PRIORITY[stage]?.indexOf(a)??99)-(STAGE_PRIORITY[stage]?.indexOf(b)??99);
  });
  return candidates[0];
}

export function pickFocus(growthZones,need,answers,scores,stage) {
  const bottleneck=selectBottleneck(scores,answers,stage);
  const ids=NEED_TO_INDICATORS[need]??[];
  const requested=ids.find(id=>growthZones.includes(id)) ?? null;
  const focus=bottleneck ?? requested ?? growthZones[0] ?? null;
  return {focus, bottleneck, requested, needMatched:Boolean(requested&&requested===focus)};
}

function expectedResources(format,stage) {
  const map={
    event:['audience','venue','partners'],
    community:['audience','partners','venue'],
    place:['venue','partners','funding'],
    service:['audience','partners','tech'],
    education:['audience','experts','venue'],
    culture:['audience','venue','partners'],
    business:['audience','partners','funding'],
    research:['experts','partners','funding'],
  };
  const base=map[format]??['audience','partners'];
  if(stage==='idea') return base.slice(0,2);
  if(stage==='first_steps') return base;
  return base;
}

export function resourceGaps(answers,stage,formatId) {
  const have=new Set(answers.q13??[]);
  if(have.has('none')) return expectedResources(formatId,stage);
  return expectedResources(formatId,stage).filter(id=>!have.has(id));
}

export function modelGaps(answers) {
  return Object.values(modelCoverage(answers.q8)).filter(Boolean).filter(x=>x.yes===0).map(x=>x.id);
}

export function pickResourceFocus(answers,stage,formatId) {
  return resourceGaps(answers,stage,formatId)[0] ?? null;
}

const STAGE_NEXT_LEVEL = {
 idea:{title:'Подготовить проект к первому запуску',text:'К концу года иметь проверенную идею, первых участников и партнёров и понятный план регулярной работы.'},
 first_steps:{title:'Выйти на регулярную работу',text:'К концу года перейти от разовых действий к повторяющемуся формату с постоянными участниками.'},
 pilot:{title:'Сделать проект устойчивее',text:'К концу года закрепить формат, ресурсы и роли так, чтобы проект мог работать регулярно.'},
 working:{title:'Подготовить следующий этап развития',text:'К концу года проверить новое направление или аудиторию и укрепить модель проекта перед дальнейшим развитием.'},
};

const NEXT_STEPS = {
 q5:{early:'Сформулируйте на одной странице: для кого проект, какую проблему решает, что именно изменится и как это можно заметить. Проверьте формулировку на 3–5 людях из аудитории.',late:'Сверьте обещание проекта с реальным опытом участников: что изменилось для них и какие признаки результата можно регулярно отслеживать.'},
 q6:{early:'Выберите одну повторяющуюся задачу или направление, которое сейчас держится на вас, и передайте его конкретному человеку с понятным результатом на ближайшем запуске.',late:'Передайте одному участнику самостоятельную зону ответственности на ближайший цикл работы и договоритесь, какой результат он должен получить без постоянного контроля.'},
 q7:{early:'Выделите два часа в неделю не на текущие задачи, а на аудиторию, партнёров, ресурсы и анализ результатов. Зафиксируйте решения на одной странице.',late:'Передайте часть операционной работы и освободившееся время направьте на развитие: партнёрства, новые форматы и анализ результатов.'},
 q8:{early:'Соберите модель проекта на одной странице: аудитория, ценность, участники, партнёры, ресурсы, затраты и возможные источники поддержки.',late:'Обновите модель проекта по реальным данным: кто участвует, что получает, какие ресурсы расходуются и за счёт чего проект продолжает работу.'},
 q9:{early:'Проведите небольшой тест для реальных участников и заранее определите 1–2 критерия успеха. Важно получить данные, а не просто провести мероприятие.',late:'Проведите следующий запуск как проверку одной конкретной гипотезы и сравните результат с предыдущим опытом.'},
 q10:{early:'После ближайшего действия соберите обратную связь и запишите три вывода: что получилось, что нет и что меняете. Одно изменение внесите до следующего запуска.',late:'Возьмите последние данные проекта, выберите 1–2 повторяющихся сигнала и внесите изменения в формат. Проверьте их на следующем запуске.'},
 q11:{early:'Составьте карту того, кто получает пользу и кто может поддержать проект деньгами, временем, площадкой, людьми или другими ресурсами. Выберите один вариант для проверки.',late:'Определите два возможных источника поддержки и проверьте один на практике: кто даёт ресурс, на каких условиях и какие расходы или задачи он покрывает.'},
 q12:{early:'Проведите 5–7 разговоров с людьми из аудитории, которые не являются близкими знакомыми. Спрашивайте об их опыте и трудностях, а не о вашей идее.',late:'Проверьте востребованность действием: повторным участием, записью, рекомендацией, заказом или другим поведением, подходящим вашему формату.'},
 q13:{early:'Определите один критический ресурс для ближайшего шага и составьте список из пяти потенциальных владельцев этого ресурса. Договоритесь хотя бы с одним.',late:'Закройте один критический ресурс для следующего этапа и зафиксируйте договорённость с партнёром или поставщиком ресурса.'},
 q14:{early:'Выберите одну задачу, которую сейчас делаете только вы, и передайте её другому человеку с понятным результатом.',late:'Выберите одно направление и договоритесь, что его ведёт другой человек или партнёр без вашего постоянного участия.'},
 none:{early:'Сделайте ближайшее действие как небольшой эксперимент: заранее определите, что хотите проверить и какое решение примете по его результату.',late:'Выберите одно ограничение проекта и проведите небольшой эксперимент, который даст данные для следующего решения.'},
};

function stageGroup(stage){ return stage==='idea'||stage==='first_steps'?'early':'late'; }

const ROADMAP_POOL = {
 q5:[{stages:['idea','first_steps'],title:'Уточнить ценность проекта',text:'Проверить формулировку на представителях аудитории.'},{stages:['pilot','working'],title:'Определить признаки результата',text:'Выбрать 2–3 признака изменения для участников.'}],
 q6:[{stages:['idea','first_steps','pilot'],title:'Передать одну ответственность',text:'Определить роль и проверить самостоятельную работу другого человека.'},{stages:['working'],title:'Распределить ответственность',text:'Закрепить самостоятельные направления за участниками команды.'}],
 q7:[{stages:['idea','first_steps','pilot','working'],title:'Ввести регулярный разбор проекта',text:'Раз в месяц пересматривать аудиторию, ценность, людей, ресурсы и результаты.'}],
 q8:[{stages:['idea','first_steps','pilot','working'],title:'Собрать модель проекта на одной странице',text:'Обновлять её после важных запусков и решений.'}],
 q9:[{stages:['idea'],title:'Провести первый небольшой тест',text:'Проверить ключевую гипотезу на реальных участниках.'},{stages:['first_steps'],title:'Провести пилот с критериями успеха',text:'Собрать факты о поведении участников и результате.'},{stages:['pilot','working'],title:'Перевести опыт в повторяемый формат',text:'Провести серию запусков и сравнивать результаты.'}],
 q10:[{stages:['first_steps','pilot','working'],title:'Ввести разбор после каждого запуска',text:'Фиксировать обратную связь, выводы и изменения.'}],
 q11:[{stages:['idea','first_steps'],title:'Составить карту ресурсов проекта',text:'Разделить деньги, время, площадки, людей и другие источники поддержки.'},{stages:['pilot','working'],title:'Проверить второй источник поддержки',text:'Сравнить альтернативный канал дохода или финансирования.'}],
 q12:[{stages:['idea','first_steps'],title:'Провести исследование аудитории',text:'Провести серию интервью или наблюдений.'},{stages:['pilot','working'],title:'Измерять повторное участие',text:'Отслеживать возвращение, рекомендации, заказы или другое релевантное действие.'}],
 q13:[{stages:['idea','first_steps','pilot'],title:'Найти владельца критического ресурса',text:'Договориться о конкретном вкладе в следующий запуск.'},{stages:['working'],title:'Снизить зависимость от одного ресурса',text:'Добавить альтернативного партнёра или источник поддержки.'}],
 q14:[{stages:['idea','first_steps','pilot','working'],title:'Передать одно направление',text:'Проверить, может ли другой человек вести его самостоятельно.'}],
};

function buildPotential({strengths,growthZones,stage,stageFit,confidence,bottleneckLabel}) {
  const strengthsText=strengths.slice(0,2).map(id=>INDICATORS[id].strengthTitle.toLowerCase());
  const parts=[];
  if (strengthsText.length) parts.push('Опоры уже есть: '+strengthsText.join('; ')+'.');
  else parts.push('Сейчас главная ценность диагностики — получить первые факты и уточнить основу проекта.');
  if (bottleneckLabel) parts.push('Главное ограничение следующего шага — '+bottleneckLabel.toLowerCase()+'.');
  else if (growthZones.length) parts.push('Сейчас сильнее всего ограничивают следующий шаг: '+growthZones.slice(0,2).map(id=>INDICATORS[id].name.toLowerCase()).join(' и ')+'.');
  if (stageFit?.length) parts.push(stageFit[0]);
  if (confidence==='preliminary') parts.push('Часть выводов пока основана на самооценке, поэтому её стоит уточнить практикой.');
  parts.push('Диагностика не сравнивает вас с абстрактным «идеальным проектом»: она помогает выбрать наиболее полезный следующий шаг именно для текущей стадии проекта.');
  return parts.join(' ');
}

function buildNextStep({focus,needMatched,need,stage}) {
  let text=NEXT_STEPS[focus??'none'][stageGroup(stage)];
  if (focus&&!needMatched&&need&&need!=='unknown'&&stage!=='idea') text += ' Ваш запрос «' + optionLabel('q15', need).toLowerCase() + '» тоже важен, но сначала полезно закрыть это более базовое ограничение.';
  return text;
}

function buildRoadmap({growthZones,focus,need,stage}) {
  const order=[]; if(focus) order.push(focus);
  for(const id of growthZones) if(!order.includes(id)) order.push(id);
  for(const id of NEED_TO_INDICATORS[need]??[]) if(!order.includes(id)) order.push(id);
  for(const id of STAGE_PRIORITY[stage]) if(!order.includes(id)) order.push(id);
  const steps=[];
  for(const id of order){
    if(steps.length>=6) break;
    for(const s of (ROADMAP_POOL[id]??[]).filter(x=>x.stages.includes(stage))){
      if(steps.length>=6) break;
      steps.push({title:s.title,text:s.text,indicator:id});
    }
  }
  steps.push({...STAGE_NEXT_LEVEL[stage],indicator:null});
  return steps;
}

function detectContradictions(a) {
  const out=[];
  if(a.q1==='idea' && ['tested','regular'].includes(a.q9)) out.push('Стадия проекта и описание уже сделанных действий не совпадают.');
  if(a.q1==='working' && a.q9==='thinking') out.push('Проект назван работающим, но конкретных действий пока не было.');
  if(a.q6==='alone' && a.q14==='autonomous') out.push('Вы указали, что за проект отвечаете только вы, но проект может продолжать работу без вас.');
  if(a.q6==='team' && a.q14==='stops') out.push('У проекта есть команда, но без вас проект, по ответам, остановится.');
  if(a.q3?.includes('unknown') && Object.values(a.q8??{}).filter(v=>v==='yes').length>=6) out.push('Аудитория пока не определена, но почти все элементы модели проекта названы понятными.');
  if(a.q12==='demand' && a.q9==='thinking') out.push('Есть заявленный повторный спрос, но по вопросу о действиях проект ещё не запускался.');
  if(a.q12==='demand' && ['none','no_analysis'].includes(a.q10)) out.push('Заявленный спрос есть, но опыт проекта пока не анализировался.');
  return out;
}

function stageFitNotes(a,scores) {
  const notes=[];
  if(a.q1==='idea') {
    if(scores.q9===0) notes.push('Для стадии идеи отсутствие регулярной работы и автономной команды не считается самостоятельной проблемой.');
    if(scores.q14===0) notes.push('На стадии идеи зависимость от автора естественна; важнее сначала проверить ценность и востребованность.');
  }
  if(a.q1==='first_steps' && scores.q9===0.5) notes.push('Первые действия уже есть — следующий диагностический порог для вас связан с получением проверяемого опыта.');
  if(a.q1==='pilot' && scores.q10<1) notes.push('После пилота особенно важен разбор опыта: он показывает, что именно стоит менять дальше.');
  if(a.q1==='working' && scores.q14<2) notes.push('Для работающего проекта зависимость от автора становится существенным ограничением следующего этапа.');
  return notes;
}

function confidenceLevel(a,contradictions) {
  if(contradictions.length>=2) return 'preliminary';
  const evidence=Number(['tested','regular'].includes(a.q9))+
    Number(['analyzed','changed'].includes(a.q10))+
    Number(['research','data','demand'].includes(a.q12))+
    Number(a.q5==='b')+
    Number(['model','sources'].includes(a.q11));
  const realityEvidence=Number(['tested','regular'].includes(a.q9))+
    Number(['analyzed','changed'].includes(a.q10))+
    Number(['research','data','demand'].includes(a.q12));
  if(evidence>=4 && realityEvidence>=2 && !contradictions.length) return 'high';
  if(evidence>=2 && realityEvidence>=1 && contradictions.length<=1) return 'medium';
  return 'preliminary';
}

function confidenceLabel(c){return c==='high'?'Высокая':c==='medium'?'Средняя':'Предварительная';}

function subjectiveMismatch(need,focus) {
  if(!need||need==='unknown'||!focus) return null;
  const ids=NEED_TO_INDICATORS[need]??[];
  if(ids.includes(focus)) return null;
  return {need:optionLabel('q15',need),focus:INDICATORS[focus].growthTitle,text:'По ответам диагностики ваш запрос важен, но сейчас проект сильнее ограничивает другая задача. Сначала полезно закрыть её — это упростит следующий шаг.'};
}

export function buildResult({answers,segment}) {
  const {scores,total}=computeScores(answers);
  const stage=answers.q1, need=answers.q15;
  const contradictions=detectContradictions(answers);
  const stageFit=stageFitNotes(answers,scores);
  const confidence=confidenceLevel(answers,contradictions);
  const strengths=pickStrengths(scores,stage);
  const growthZones=pickGrowthZones(scores,stage,need);
  const {focus,bottleneck,requested,needMatched}=pickFocus(growthZones,need,answers,scores,stage);
  const seg=SEGMENTS.find(s=>s.id===segment);
  const coverage=modelCoverage(answers.q8);
  const resourceGap=pickResourceFocus(answers,stage,answers.q2);
  const gaps=modelGaps(answers);
  const bottleneckLabel=bottleneck?INDICATORS[bottleneck].growthTitle:null;
  return {
    total,max:MAX_SCORE,resultStage:resultStage(total),
    stage:{id:stage,label:optionLabel('q1',stage)},
    format:answers.q2==='other'?(answers.q2_other||'Другое'):optionLabel('q2',answers.q2),
    formatId:answers.q2,
    audience:(answers.q3??[]).filter(id=>id!=='unknown').map(id=>id==='other'?(answers.q3_other||''):optionLabel('q3',id).toLowerCase()).filter(Boolean).join(', '),
    problem:answers.q4,
    need:{id:need,label:optionLabel('q15',need)},
    segment:seg?{id:seg.id,label:seg.label,profile:seg.profile}:null,
    scores:SCORED_IDS.map(id=>({id,name:INDICATORS[id].name,score:scores[id],max:getQuestion(id).max})),
    strengths:strengths.map(id=>({id,title:INDICATORS[id].strengthTitle,score:scores[id],max:getQuestion(id).max,text:INDICATORS[id].strengthText})),
    growthZones:growthZones.map(id=>({id,title:INDICATORS[id].growthTitle,score:scores[id],max:getQuestion(id).max,text:INDICATORS[id].growthText[scores[id]]})),
    focus, bottleneck, requestedFocus:requested, needMatched,
    modelCoverage:coverage,
    modelGaps:gaps,
    resourceGap,
    confidence:{id:confidence,label:confidenceLabel(confidence)},
    contradictions,stageFit,subjectiveMismatch:subjectiveMismatch(need,focus),
    potential:buildPotential({strengths,growthZones,stage,stageFit,confidence,bottleneckLabel}),
    nextStep:buildNextStep({focus,needMatched,need,stage}),
    roadmap:buildRoadmap({growthZones,focus,need,stage}),
    personalized:false,
  };
}
