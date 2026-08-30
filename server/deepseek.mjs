// ---------------------------------------------------------------------------
// A second opinion on Gemini's question, from DeepSeek.
//
// One model writing and marking its own work is exactly how a confidently wrong
// answer reaches a video. This asks a different model, which has not seen
// Gemini's reasoning, to solve the question independently and then say whether
// it agrees. Disagreement is the signal worth acting on.
// ---------------------------------------------------------------------------

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
import { fetchRetrying } from './retry.mjs';

export const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat — fast and cheap (recommended)' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner — slower, best for hard maths' },
];

const LETTERS = ['A', 'B', 'C', 'D'];

const SYSTEM = [
  'You are a fact-checker for short educational quiz videos. You are strict, concise and honest.',
  '',
  'You will be given a multiple-choice question, the option its author marked correct, an',
  'explanation, and sometimes a small diagram with numbers in it.',
  '',
  'Do this, in order:',
  '1. Solve the question yourself, from scratch. Do not assume the marked answer is right.',
  '2. Compare your answer with the marked one.',
  '3. Check the explanation actually supports the answer and contains no false statements.',
  '4. Check every number, unit, name and date. Flag anything you believe is wrong.',
  '5. Check no second option could also be defended as correct, and that the question is not ambiguous.',
  '',
  'Be proportionate. Do not invent problems: if the question is sound, say so plainly.',
  'Style and wording are not your concern - only whether it is correct, unambiguous and fair.',
  '',
  'Reply with a single json object and nothing else, in exactly this shape:',
  '{',
  '  "verdict": "pass" | "warn" | "fail",',
  '  "confidence": 0-100,',
  '  "correctIndex": 0-3,',
  '  "reasoning": "two or three sentences on how you solved it",',
  '  "issues": [',
  '    { "severity": "high" | "medium" | "low", "where": "question" | "options" | "answer"',
  '        | "explanation" | "funFact" | "diagram", "problem": "...", "fix": "..." }',
  '  ],',
  '  "summary": "one short sentence"',
  '}',
  '',
  'verdict "fail" = the marked answer is wrong, or the question is broken.',
  'verdict "warn" = the answer stands but something needs attention.',
  'verdict "pass" = correct, unambiguous and fairly explained. Use an empty issues array.',
  'correctIndex is YOUR answer, 0-based, regardless of what was marked.',
].join('\n');

function buildPrompt(content, options) {
  const lines = [];
  lines.push('Check this quiz question and reply with json.');
  lines.push('');
  lines.push('Subject: ' + (content.subject || options.subject || 'unknown'));
  if (options.level) lines.push('Audience: ' + options.level);
  if (options.language && options.language !== 'English') {
    lines.push('Language: ' + options.language + '. Judge the content, not the translation.');
  }
  lines.push('');
  lines.push('QUESTION: ' + content.question);
  lines.push('');
  lines.push('OPTIONS:');
  (content.options || []).forEach((o, i) => {
    lines.push('  ' + (LETTERS[i] || i) + ' (index ' + i + '): ' + o);
  });
  lines.push('');
  lines.push('MARKED CORRECT: index ' + content.correctIndex +
    ' (' + (content.options || [])[content.correctIndex] + ')');
  lines.push('');

  if ((content.explanation || []).length) {
    lines.push('EXPLANATION GIVEN:');
    content.explanation.forEach((e, i) => lines.push('  ' + (i + 1) + '. ' + e));
    lines.push('');
  }

  // The narration carries the real explanation once the script is written.
  const spokenExplain = (content.script || [])
    .filter((s) => s.kind === 'explain')
    .map((s) => s.narration)
    .filter(Boolean);
  if (spokenExplain.length) {
    lines.push('SPOKEN EXPLANATION:');
    spokenExplain.forEach((e, i) => lines.push('  ' + (i + 1) + '. ' + e));
    lines.push('');
  }

  if (content.funFact) {
    lines.push('FUN FACT CLAIMED: ' + content.funFact);
    lines.push('');
  }

  // Any numbers drawn on screen are claims too, so they get checked.
  const numeric = (content.script || [])
    .map((s) => s.visual)
    .filter((v) => v && v.kind === 'bars' && Array.isArray(v.items));
  if (numeric.length) {
    lines.push('NUMBERS SHOWN IN DIAGRAMS:');
    numeric.forEach((v) => {
      lines.push('  ' + (v.caption || 'values') + ': ' +
        v.items.map((it) => it.label + ' = ' + it.value).join(', '));
    });
    lines.push('');
  }

  const formulas = (content.script || [])
    .map((s) => s.visual)
    .filter((v) => v && v.kind === 'formula' && v.formula);
  if (formulas.length) {
    lines.push('FORMULAS SHOWN: ' + formulas.map((v) => v.formula).join(' ; '));
    lines.push('');
  }

  return lines.join('\n');
}

export async function validateContent(apiKey, model, content, options) {
  const chosen = model || 'deepseek-chat';
  const body = {
    model: chosen,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPrompt(content, options || {}) },
    ],
    temperature: 0,
    max_tokens: 1600,
  };

  // The reasoner model does not accept response_format; the chat model does,
  // and using it there removes any chance of prose wrapped around the JSON.
  if (!/reasoner/i.test(chosen)) body.response_format = { type: 'json_object' };

  const res = await fetchRetrying(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(explainError(res.status, raw));

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('DeepSeek sent back something that was not JSON. Try again.');
  }

  const choice = payload.choices && payload.choices[0];
  const text = choice && choice.message && choice.message.content;
  if (!text || !text.trim()) throw new Error('DeepSeek returned an empty reply. Try again.');

  return normalizeReport(parseLoose(text), content);
}

/** The reasoner can wrap its JSON in prose, so dig it out if needed. */
function parseLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Could not read DeepSeek\'s reply. Try again, or switch DeepSeek model.');
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

const VERDICTS = ['pass', 'warn', 'fail'];
const SEVERITIES = ['high', 'medium', 'low'];
const WHERES = ['question', 'options', 'answer', 'explanation', 'funFact', 'diagram'];

const text = (v, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function normalizeReport(raw, content) {
  const r = raw && typeof raw === 'object' ? raw : {};

  const optionCount = (content.options || []).length || 4;
  let correctIndex = Number.isInteger(r.correctIndex) ? r.correctIndex : -1;
  if (correctIndex < 0 || correctIndex >= optionCount) correctIndex = -1;

  const agrees = correctIndex === -1 ? null : correctIndex === content.correctIndex;

  let verdict = VERDICTS.includes(r.verdict) ? r.verdict : 'warn';
  // A disagreement about the answer is a failure whatever the model called it.
  if (agrees === false) verdict = 'fail';

  const issues = (Array.isArray(r.issues) ? r.issues : [])
    .map((i) => ({
      severity: SEVERITIES.includes(i && i.severity) ? i.severity : 'medium',
      where: WHERES.includes(i && i.where) ? i.where : 'question',
      problem: text(i && i.problem),
      fix: text(i && i.fix),
    }))
    .filter((i) => i.problem)
    .slice(0, 8);

  let confidence = Number(r.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    verdict,
    confidence,
    correctIndex,
    agrees,
    markedIndex: content.correctIndex,
    reasoning: text(r.reasoning, 700),
    summary: text(r.summary, 200) || (agrees === false
      ? 'DeepSeek picked a different answer.'
      : 'No summary was given.'),
    issues,
    checkedAt: new Date().toISOString(),
  };
}

function explainError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.error && (j.error.message || j.error.type)) || j.message || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }
  if (status === 401) {
    return 'That DeepSeek API key was rejected. Copy it again from platform.deepseek.com.';
  }
  if (status === 402) {
    return 'Your DeepSeek account has no credit left. Top it up at platform.deepseek.com, or turn the check off.';
  }
  if (status === 422) return 'DeepSeek rejected the request: ' + detail;
  if (status === 429) return 'DeepSeek rate limit hit. Wait a few seconds and press Check again.';
  if (status >= 500) return 'DeepSeek had a server error (' + status + '). Try again in a moment.';
  return 'DeepSeek error ' + status + ': ' + (detail || 'unknown');
}
