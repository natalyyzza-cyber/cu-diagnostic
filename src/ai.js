// Персонализация текста результата через провайдера с протоколом OpenAI.
// Контактные данные (имя, email) в запрос к модели не передаются; передаются только ответы диагностики и данные результата.
// Баллы, сильные стороны, зоны роста и главное ограничение следующего шага уже выбраны кодом по методике (src/scoring.js);
// модель не пересматривает диагностику, а объясняет её на фактах проекта и превращает её в проверяемый план действий.
// Если ключа нет или запрос не удался — остаётся шаблонный результат.

import OpenAI from 'openai';
import { MAX_SCORE } from '../public/js/questions.js';
import { INDICATORS } from './scoring.js';

// Любой провайдер с протоколом OpenAI: официальный OpenAI, OpenRouter, Groq,
// локальный vLLM или Ollama. Достаточно ключа и, при необходимости, базового адреса.
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || undefined;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export const aiEnabled = Boolean(API_KEY);

const client = aiEnabled
  ? new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 120_000, maxRetries: 1 })
  : null;

const SYSTEM_PROMPT = `Ты — эксперт Городского университета 2.0 по развитию городских проектов, работаешь по методологии городского продюсирования Святослава Мурунова (канвас городского проекта, критерии оценки проектов Школы городских продюсеров).

Человек прошёл диагностику своего городского проекта. Методика уже выбрала стадию, сильные стороны, зоны для развития и главное ограничение следующего шага. Нельзя менять эти выборы, пересматривать баллы или придумывать новые диагностические показатели. Твоя задача — превратить данные диагностики в полезное для автора проекта диагностическое заключение.

Главный принцип результата: человек должен после чтения понимать, ЧТО он теперь знает о своём проекте, чего не было понятно до диагностики, ПОЧЕМУ это важно именно сейчас и ЧТО сделать, чтобы получить следующий важный факт для решения.

Сначала собери диагностическую цепочку:
1. что уже подтверждено ответами и практикой;
2. какой важный вопрос пока остаётся открытым;
3. почему именно этот вопрос критичен на текущей стадии;
4. какое конкретное действие даст новый факт;
5. какое решение можно будет принять по результату.

Не превращай отсутствие показателя в «проблему», если для текущей стадии это нормально. Например, проект на стадии идеи не обязан иметь большую команду, регулярную выручку или автономную работу без автора. Для небольшого общественного проекта отсутствие коммерческой модели тоже не является проблемой само по себе.

Что нужно написать:
1. diagnosis — главное диагностическое заключение:
   - headline: короткий вывод на 6–10 слов. Не название стадии и не «зона роста». Примеры: «Сначала проверить востребованность проекта», «Сначала понять, на чём держится проект», «Сначала передать одну ответственность».
   - summary: 2–3 предложения о конкретной ситуации проекта. Используй формат, аудиторию и смысл проблемы участника, если они известны. Не пересказывай ответы.
   - confirmed: 1–3 коротких факта, на которые уже можно опираться. Только подтверждённое.
   - open_question: один конкретный вопрос, который сейчас важнее всего закрыть.
   - why_now: объяснение, почему именно этот вопрос важен на данной стадии. Покажи причинную связь с дальнейшим развитием.
   - next_test: одно конкретное действие, которое даст ответ на открытый вопрос. Это должен быть небольшой реалистичный эксперимент, запуск, разговор, передача ответственности, расчёт или другое проверяемое действие.
   - decision_after_test: что делать дальше в зависимости от результата. Не обещай успех; опиши логику следующего решения.
   - confidence_note: если надёжность предварительная/средняя — честно объясни ограничение; если высокая — скажи, что вывод подтверждается несколькими практическими сигналами. Не используй слово «баллы».
   - stage_context: только если действительно важно объяснить нормальное для стадии ограничение; иначе null.
2. strengths — для каждой уже выбранной сильной стороны 2–3 предложения. Покажи, почему это конкретная опора для данного проекта, а не просто похвала.
3. growth_zones — для каждой уже выбранной зоны 2–3 предложения по схеме факт → значение для проекта → действие. Не называй нормальный этап развития дефицитом.
4. potential — не «потенциал» в смысле прогноза. Опиши, что станет возможным понять или изменить после закрытия главного вопроса. 350–600 знаков.
5. next_step — одно конкретное действие на ближайшее время: действие + что проверить/получить + зачем. 250–400 знаков.
6. roadmap — 7–9 последовательных шагов на ближайший год. Первый шаг должен закрывать главное ограничение. Следующие должны зависеть от результата предыдущих. Не составляй универсальный список вроде «найти партнёров → сделать сайт → продвинуться». Каждый шаг привязывай к формату, аудитории и проблеме проекта.
7. problem_unclear — true, если описание проблемы слишком общее или непонятное. Не придумывай содержание проблемы.

Правила по стадиям:
- Идея: сначала проверить проблему, аудиторию и ценность; затем маленький тест. Не советовать масштабирование, сложную экономику или большую команду.
- Первые шаги: получить первый проверяемый опыт, собрать реакцию людей, уточнить роли и ценность.
- Пилот: разобрать опыт, изменить формат, повторно проверить, затем работать с партнёрами и ресурсами.
- Работающий проект: укреплять устойчивость, ресурсы, распределение ответственности и развитие. Не возвращать человека к «первому тесту», если практика уже есть.

Правила по запросу участника:
- Учитывай q15, но не позволяй ему отменить главное диагностическое ограничение.
- Если запрос совпадает с фокусом — включи его в ближайшее действие.
- Если не совпадает — объясни коротко, почему сначала нужен другой шаг.
- Не предлагай действие, для которого ещё не собраны необходимые элементы.

Правила фактов:
- Не придумывай партнёров, деньги, ресурсы, результаты, спрос, аудиторию или поведение людей.
- Не называй проект слабым/сильным как оценку личности автора.
- Не используй внутренние термины: Q5, баллы, маршрутизатор, зона дефицита, продюсерская позиция, зрелость проекта.
- Не повторяй один и тот же вывод во всех блоках.
- Пиши простым русским языком, обращение на «вы».
- Если данные противоречат друг другу, не выбирай удобную версию: отрази это в confidence_note или stage_context и предложи проверить противоречие практикой.
- Никогда не подменяй диагностическое заключение общими советами.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['diagnosis','strengths','growth_zones','potential','next_step','roadmap','problem_unclear'],
  properties: {
    diagnosis: {
      type: 'object',
      additionalProperties: false,
      required: ['headline','summary','confirmed','open_question','why_now','next_test','decision_after_test','confidence_note','stage_context'],
      properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        confirmed: { type: 'array', items: { type: 'string' } },
        open_question: { type: 'string' },
        why_now: { type: 'string' },
        next_test: { type: 'string' },
        decision_after_test: { type: 'string' },
        confidence_note: { type: 'string' },
        stage_context: { type: ['string','null'] },
      },
    },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
    growth_zones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
    potential: { type: 'string' },
    next_step: { type: 'string' },
    roadmap: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'text'],
        properties: { title: { type: 'string' }, text: { type: 'string' } },
      },
    },
    problem_unclear: { type: 'boolean' },
  },
};

function describeAnswers(record) {
  const r = record.result;
  const a = record.answers;
  const lines = [
    `Профиль участника: ${r.segment ? `${r.segment.profile} (${r.segment.label})` : 'не указан'}`,
    `Стадия проекта: ${r.stage.label}`,
    `Формат проекта: ${r.format}`,
    `Аудитория: ${r.audience || 'пока не определена'}`,
    `Описание проблемы и изменения (словами участника): «${a.q4}»`,
    `Запрос участника — что нужно, чтобы двигаться дальше: ${r.need.label}`,
    '',
    `Итог: ${r.total} из ${MAX_SCORE}. Интерпретация: ${r.resultStage.text}`,
    '',
    'Профиль показателей (балл / максимум):',
    ...r.scores.map((s) => `- ${s.id} ${s.name}: ${s.score}/${s.max}`),
    '',
    'Ответы участника по показателям:',
    ...describeScoredAnswers(a),
    '',
    'Выбранные сильные стороны (id — заголовок — базовая трактовка):',
    ...(r.strengths.length
      ? r.strengths.map((s) => `- ${s.id} — ${s.title} — ${s.text}`)
      : ['- нет показателей с максимальным баллом; strengths оставь пустым массивом']),
    '',
    'Выбранные зоны роста (id — заголовок — базовая трактовка):',
    ...(r.growthZones.length
      ? r.growthZones.map((g) => `- ${g.id} — ${g.title} (${g.score}/${g.max}) — ${g.text}`)
      : ['- нет; growth_zones оставь пустым массивом']),
    '',
    `Надёжность результата: ${r.confidence?.label || 'Предварительная'}`,
    r.stageFit?.length ? 'Что важно учитывать по стадии:\n- ' + r.stageFit.join('\n- ') : '',
    r.contradictions?.length ? 'Расхождения в ответах:\n- ' + r.contradictions.join('\n- ') : '',
    r.subjectiveMismatch ? 'Запрос участника и диагностический фокус расходятся: ' + r.subjectiveMismatch.text : '',
    `Главное ограничение следующего шага: ${r.bottleneck ? `${r.bottleneck} — ${INDICATORS[r.bottleneck].growthTitle}` : 'не выделено'}
Фокус ближайшего шага: ${r.focus ? `${r.focus} — ${INDICATORS[r.focus].growthTitle}` : 'развитие и следующий уровень проекта'}
Запрошенная человеком тема: ${r.requestedFocus ? `${r.requestedFocus} — ${INDICATORS[r.requestedFocus].growthTitle}` : 'не совпала с выбранным фокусом или не определена'}
Недостающие блоки модели проекта: ${r.modelGaps?.join(', ') || 'нет'}
Предполагаемый критический ресурс ближайшего шага: ${r.resourceGap || 'не определён'}`,
    `Диагностическое заключение от методики: ${JSON.stringify(r.diagnosis || {})}`,
    `Запрос участника совпадает с фокусом: ${r.needMatched ? 'да' : 'нет'}`,
  ];
  return lines.join('\n');
}

function describeScoredAnswers(a) {
  // Короткие подписи ответов, чтобы модель опиралась на факты, а не только на баллы.
  const pick = (map, id) => map[id] ?? id;
  const out = [];
  out.push(`- Команда: ${pick({ alone: 'только автор', helpers: 'помогают время от времени', gathering: 'собирает команду / есть постоянные участники', team: 'сформированная команда с ролями' }, a.q6)}`);
  out.push(`- Функции автора: ${(a.q7 ?? []).join(', ')}`);
  const yes = Object.entries(a.q8 ?? {}).filter(([, v]) => v === 'yes').map(([k]) => k);
  const no = Object.entries(a.q8 ?? {}).filter(([, v]) => v === 'no').map(([k]) => k);
  out.push(`- Может уверенно ответить про: ${yes.join(', ') || '—'}; пока не может: ${no.join(', ') || '—'}`);
  out.push(`- Что сделано: ${pick({ thinking: 'только обдумывает идею', started: 'первые встречи / люди / договорённости', tested: 'проверил идею на практике', regular: 'проект регулярно работает' }, a.q9)}`);
  out.push(`- Опыт: ${pick({ none: 'проект ещё не реализовывался', no_analysis: 'пробовал, но не анализировал', feedback: 'получил отзывы, выводов пока нет', analyzed: 'проанализировал и понял, что менять', changed: 'внёс изменения по итогам опыта' }, a.q10)}`);
  out.push(`- Ресурсная модель: ${pick({ unknown: 'пока не понимает модель ресурсов и поддержки', who: 'понимает потребность в ресурсах, но модель поддержки не определена', model: 'понимает источники поддержки, затраты и критические ресурсы', sources: 'видит несколько источников поддержки и понимает, как проект может продолжать работу' }, a.q11)}`);
  out.push(`- Проверка востребованности: ${pick({ none: 'не проверял', talks: 'обсуждает со знакомыми', research: 'интервью / опросы / наблюдения', data: 'использует данные для изменений', demand: 'есть регулярный / повторный спрос' }, a.q12)}`);
  out.push(`- Уже есть ресурсы: ${(a.q13 ?? []).join(', ')}`);
  out.push(`- Блоки модели: ${JSON.stringify(record.result.modelCoverage ?? {})}`);
  out.push(`- Без автора: ${pick({ stops: 'проект остановится', partly: 'часть работы продолжат', directions: 'отдельные направления продолжат', autonomous: 'проект продолжит работу' }, a.q14)}`);
  return out;
}

/** Возвращает персонализированный результат или null, если ИИ недоступен / ответ некорректен. */
export async function personalize(record) {
  if (!client) return null;

  const response = await client.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: describeAnswers(record),
    max_output_tokens: 16000,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'diagnosis',
        strict: true,
        schema: OUTPUT_SCHEMA,
      },
    },
  });

  if (response.status !== 'completed') {
    console.warn(
      `Персонализация не выполнена: status=${response.status ?? 'unknown'}` +
      (response.incomplete_details?.reason ? `, reason=${response.incomplete_details.reason}` : ''),
    );
    return null;
  }
  const text = response.output_text ?? '';
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.warn('Персонализация: модель вернула некорректный JSON');
    return null;
  }
  return mergeIntoResult(record.result, data);
}

/** Переносит тексты модели в результат, сохраняя выбор показателей из методики. */
export function mergeIntoResult(result, data) {
  const byId = (list) => new Map((Array.isArray(list) ? list : []).map((x) => [x?.id, x?.text]));
  const s = byId(data.strengths);
  const g = byId(data.growth_zones);
  const ok = (t) => typeof t === 'string' && t.trim().length > 20;
  const roadmap = (Array.isArray(data.roadmap) ? data.roadmap : [])
    .filter((x) => ok(x?.title + ' ' + x?.text) && x.title?.trim())
    .slice(0, 10)
    .map((x) => ({ title: x.title.trim(), text: (x.text || '').trim() }));

  const d = data.diagnosis || {};
  const diagnosisOk = typeof d.headline === 'string' && d.headline.trim().length > 10 &&
    typeof d.summary === 'string' && d.summary.trim().length > 40 &&
    typeof d.open_question === 'string' && d.open_question.trim().length > 20 &&
    typeof d.why_now === 'string' && d.why_now.trim().length > 30 &&
    typeof d.next_test === 'string' && d.next_test.trim().length > 30 &&
    typeof d.decision_after_test === 'string' && d.decision_after_test.trim().length > 30;
  const diagnosis = diagnosisOk ? {
    headline:d.headline.trim(),
    summary:d.summary.trim(),
    confirmed:(Array.isArray(d.confirmed)?d.confirmed:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,3),
    openQuestion:d.open_question.trim(),
    whyNow:d.why_now.trim(),
    nextTest:d.next_test.trim(),
    decisionAfterTest:d.decision_after_test.trim(),
    confidenceNote:typeof d.confidence_note==='string'?d.confidence_note.trim():'',
    stageContext:typeof d.stage_context==='string'?d.stage_context.trim():null,
  } : result.diagnosis;
  return {
    ...result,
    diagnosis,
    strengths: result.strengths.map((x) => (ok(s.get(x.id)) ? { ...x, text: s.get(x.id).trim() } : x)),
    growthZones: result.growthZones.map((x) => (ok(g.get(x.id)) ? { ...x, text: g.get(x.id).trim() } : x)),
    potential: ok(data.potential) ? data.potential.trim() : result.potential,
    nextStep: ok(data.next_step) ? data.next_step.trim() : result.nextStep,
    roadmap: roadmap.length >= 5 ? roadmap : result.roadmap,
    problemUnclear: data.problem_unclear === true,
    personalized: true,
  };
}
