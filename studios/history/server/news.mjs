// ---------------------------------------------------------------------------
// News: live research, so a news explainer is about this week and not the
// model's training cut-off.
//
//   groundedText   one call with live web search - Gemini's Google Search
//                  grounding, or Claude's web search tool - returning the text
//                  plus the pages it actually read
//   research       a sourced, dated research brief on one story
//   trending       today's big stories for chosen categories and a region
//
// Live search cannot be combined with strict JSON output on Gemini, so news is
// two steps: research here (free text + sources), then the writer turns the
// brief into a script with its schema enforced (tasks.mjs, "news"). That also
// means a brief researched by one model can be written up by the other.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { fetchRetrying } from './retry.mjs';
import { DEFAULT_CLAUDE_MODEL, explainClaudeError } from './claude.mjs';
import { parseJsonLoosely } from './gemini.mjs';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

const clean = (v, max = 400) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim().slice(0, max);

/** "www.thehindu.com" -> "The Hindu"-ish: a readable outlet name from a URL. */
const OUTLETS = {
  'reuters.com': 'Reuters', 'apnews.com': 'AP News', 'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'thehindu.com': 'The Hindu',
  'indianexpress.com': 'The Indian Express', 'hindustantimes.com': 'Hindustan Times', 'timesofindia.indiatimes.com': 'The Times of India',
  'ndtv.com': 'NDTV', 'livemint.com': 'Mint', 'economictimes.indiatimes.com': 'The Economic Times', 'business-standard.com': 'Business Standard',
  'theguardian.com': 'The Guardian', 'nytimes.com': 'The New York Times', 'washingtonpost.com': 'The Washington Post', 'aljazeera.com': 'Al Jazeera',
  'ft.com': 'Financial Times', 'bloomberg.com': 'Bloomberg', 'cnn.com': 'CNN', 'npr.org': 'NPR', 'dw.com': 'DW', 'france24.com': 'France 24',
  'scroll.in': 'Scroll', 'thewire.in': 'The Wire', 'theprint.in': 'ThePrint', 'pib.gov.in': 'PIB (Govt of India)', 'nature.com': 'Nature',
  'science.org': 'Science', 'techcrunch.com': 'TechCrunch', 'theverge.com': 'The Verge', 'wired.com': 'Wired', 'economist.com': 'The Economist',
};

export function outletOf(url, fallback = '') {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    host = String(fallback || '').replace(/^www\./, '').toLowerCase();
  }
  if (!host) return clean(fallback, 60);
  for (const [domain, name] of Object.entries(OUTLETS)) if (host === domain || host.endsWith('.' + domain)) return name;
  // "example.co.in" -> "Example"
  const base = host.split('.').filter((p) => !['com', 'org', 'net', 'co', 'in', 'uk', 'gov', 'edu', 'news', 'www'].includes(p))[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Gemini's grounding links are redirects through Google. Follow each once to
 * get the real article address, so the description can cite it. Best effort:
 * a link that will not resolve is kept as it is.
 */
async function resolveLink(uri) {
  if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(uri)) return uri;
  try {
    const res = await fetch(uri, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    return res.headers.get('location') || uri;
  } catch {
    return uri;
  }
}

async function geminiGrounded(apiKey, model, { system, prompt }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // This is what makes it search rather than recall.
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3, topP: 0.95 },
  };
  const res = await fetchRetrying(GEMINI + '/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  }, { timeoutMs: 240000 });
  const raw = await res.text();
  if (!res.ok) throw new Error(explainGeminiError(res.status, raw));
  const payload = JSON.parse(raw);
  const candidate = payload.candidates && payload.candidates[0];
  if (!candidate) {
    const blocked = payload.promptFeedback && payload.promptFeedback.blockReason;
    throw new Error(blocked ? 'Gemini refused this search (' + blocked + ').' : 'Gemini returned nothing. Try again.');
  }
  const text = ((candidate.content && candidate.content.parts) || []).filter((p) => p.thought !== true).map((p) => p.text || '').join('').trim();
  const chunks = ((candidate.groundingMetadata || {}).groundingChunks || []).map((c) => c && c.web).filter(Boolean);
  const seen = new Set();
  const unique = chunks.filter((w) => w.uri && !seen.has(w.uri) && seen.add(w.uri)).slice(0, 14);
  const urls = await Promise.all(unique.map((w) => resolveLink(w.uri)));
  const sources = unique.map((w, i) => ({
    title: clean(w.title, 160),
    publisher: outletOf(urls[i], w.title),
    url: urls[i],
    date: '',
  }));
  return { text, sources };
}

async function claudeGrounded(apiKey, model, { system, prompt }) {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const messages = [{ role: 'user', content: prompt }];
  let message;
  try {
    // A long search can stop part way with pause_turn; the API resumes where it
    // left off when the paused turn is sent back. A few rounds at most.
    for (let round = 0; round < 4; round++) {
      message = await client.messages.stream({
        model: model || DEFAULT_CLAUDE_MODEL,
        max_tokens: 32000,
        system,
        messages,
        thinking: { type: 'adaptive' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
      }).finalMessage();
      if (message.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: message.content });
    }
  } catch (err) {
    throw new Error(explainClaudeError(err));
  }
  if (message.stop_reason === 'refusal') throw new Error('Claude declined to research this story. Try rewording it.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const seen = new Set();
  const sources = [];
  for (const block of message.content) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r.type !== 'web_search_result' || !r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      sources.push({ title: clean(r.title, 160), publisher: outletOf(r.url), url: r.url, date: clean(r.page_age || '', 40) });
    }
  }
  return { text, sources: sources.slice(0, 14) };
}

/** One live-searched answer: { text, sources }. */
export function groundedText(provider, apiKey, model, request) {
  return provider === 'claude' ? claudeGrounded(apiKey, model, request) : geminiGrounded(apiKey, model, request);
}

// --- research ------------------------------------------------------------------------

export const RESEARCH_SYSTEM = [
  'You are a careful, neutral news researcher preparing a brief for an explainer video.',
  'Search the web now. Never answer from memory: recency and accuracy are the whole point.',
  'Prefer wire services, established outlets and official statements. Cross-check every important claim against',
  'at least two independent sources and say when only one outlet reports something. Note the date of each development.',
  'Write the brief under these headings:',
  '1. WHAT HAPPENED - the latest development, with exact dates.',
  '2. KEY FACTS AND NUMBERS - each with the outlet that reported it.',
  '3. KEY PEOPLE AND GROUPS - name, role, and their position.',
  '4. BACKGROUND AND TIMELINE - how we got here, as dated events.',
  '5. PERSPECTIVES - every major side (government, opposition, critics, experts, the people affected), each in its',
  '   strongest fair form, attributed. Do not weigh in.',
  '6. EXACT QUOTES - verbatim, who said them, where and when. Only quotes you actually found.',
  '7. WHAT HAPPENS NEXT - scheduled dates and open questions.',
  '8. DISPUTED, UNCONFIRMED OR DEVELOPING - anything not settled.',
  '9. DATA FOR GRAPHICS - number series (with years or dates and units) and the countries involved.',
  '10. OUTLETS USED - outlet, headline, date.',
  'Plain, factual language. No opinion, no speculation, no loaded words.',
].join('\n');

export async function research(provider, apiKey, model, o) {
  const story = clean(o.story, 600);
  if (!story) throw new Error('Type the news story first.');
  const prompt = [
    'Today is ' + (o.asOf || new Date().toISOString().slice(0, 10)) + '.',
    'Story: ' + story,
    o.region ? 'Audience and region focus: ' + clean(o.region, 80) + ' (explain the local angle where there is one).' : '',
    o.angle ? 'The creator wants this angle covered: ' + clean(o.angle, 600) : '',
    '',
    'Search first, then write the research brief.',
  ].filter(Boolean).join('\n');
  const { text, sources } = await groundedText(provider, apiKey, model, { system: RESEARCH_SYSTEM, prompt });
  if (!text) throw new Error('The research came back empty. Try again, or reword the story.');
  if (!sources.length) {
    throw new Error('The model answered without searching the web, so nothing in it can be trusted as current. '
      + 'Try again, or pick a model that can search (Gemini 2.5 or newer, or Claude).');
  }
  return { brief: text.slice(0, 30000), sources };
}

// --- trending ------------------------------------------------------------------------

export const NEWS_CATEGORIES = ['Politics', 'International', 'Science', 'Tech', 'Policy', 'Business', 'Health', 'Climate'];

const TRENDING_SYSTEM = [
  'You find the most important and most-discussed news stories right now, for an explainer channel.',
  'Search the web first. Only real, reported news from the last seven days - no rumours, no celebrity gossip.',
  'Reply with a JSON array and nothing else, exactly this shape:',
  '[{"headline": "short, specific, neutral", "summary": "two plain sentences", "why": "why it matters to an ordinary viewer",',
  '  "category": "one of the requested categories", "date": "YYYY-MM-DD of the latest development", "heat": 1-10}]',
  'Return 10 items, a fair mix across the requested categories, most important first.',
].join('\n');

export async function trending(provider, apiKey, model, o) {
  const cats = (Array.isArray(o.categories) && o.categories.length ? o.categories : NEWS_CATEGORIES).filter((c) => NEWS_CATEGORIES.includes(c));
  const prompt = [
    'Today is ' + (o.asOf || new Date().toISOString().slice(0, 10)) + '.',
    'Categories: ' + cats.join(', ') + '.',
    'Region focus: ' + (clean(o.region, 80) || 'global') + '.',
    'Search first, then return the JSON array.',
  ].join('\n');
  const { text, sources } = await groundedText(provider, apiKey, model, { system: TRENDING_SYSTEM, prompt });
  return { items: normalizeTrending(text), sources: sources.slice(0, 10) };
}

export function normalizeTrending(text) {
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : String(text);
    const a = body.indexOf('[');
    const b = body.lastIndexOf(']');
    if (a >= 0 && b > a) {
      try { raw = JSON.parse(body.slice(a, b + 1)); } catch { raw = null; }
    }
    if (!raw) {
      const obj = parseJsonLoosely(body);
      raw = obj && Array.isArray(obj.items) ? obj.items : null;
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({
      headline: clean(x && x.headline, 140),
      summary: clean(x && x.summary, 400),
      why: clean(x && x.why, 260),
      category: clean(x && x.category, 30),
      date: clean(x && x.date, 20),
      heat: Math.max(1, Math.min(10, Math.round(Number(x && x.heat) || 5))),
    }))
    .filter((x) => x.headline)
    .slice(0, 12);
}

function explainGeminiError(status, raw) {
  let detail = '';
  try {
    const j = JSON.parse(raw);
    detail = (j.error && j.error.message) || '';
  } catch {
    detail = String(raw).slice(0, 300);
  }
  if (status === 400 && /tool|search|grounding|function/i.test(detail)) {
    return 'This Gemini model cannot search the web. Pick a Gemini 2.5 (or newer) model and try again.';
  }
  if (status === 400 && /API key not valid/i.test(detail)) return 'That Gemini API key was rejected. Paste it again.';
  if (status === 429) return 'Gemini rate limit hit (searching costs more requests). Wait a minute and try again.';
  if (status >= 500) return 'Google had a server error (' + status + '). Try again in a moment.';
  return 'Gemini error ' + status + ': ' + (detail || 'unknown');
}
