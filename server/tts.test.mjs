// Run: node server/tts.test.mjs
//
// What speak() sends to ElevenLabs, per model. Eleven v4 has no style or speed
// setting; a body that carries them anyway is at best ignored and at worst
// refused, and either way the slider the user moved did nothing. So the
// request body is captured with a stand-in fetch and read back.

import { modelCaps, speak, VOICE_MODELS } from './tts.mjs';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

const sent = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  sent.push({ url: String(url), body });
  // Timed the way ElevenLabs times it: every character SENT, tags included.
  const characters = [...body.text];
  const payload = {
    audio_base64: Buffer.from('not really an mp3').toString('base64'),
    alignment: {
      characters,
      character_start_times_seconds: characters.map((_, i) => i * 0.05),
      character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.05),
    },
  };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const settings = { voiceId: 'v', stability: 0.5, similarity: 0.8, style: 0.4, speed: 1.1 };
const bodyFor = async (modelId) => {
  sent.length = 0;
  await speak('key', 'hi', { ...settings, modelId });
  return sent[0].body;
};

console.log('\nthe model list');
ok('v4 is first, so it is what a new user starts on', VOICE_MODELS[0].id === 'eleven_v4');
ok('both v4 models are offered', ['eleven_v4', 'eleven_v4_turbo'].every((id) => VOICE_MODELS.some((m) => m.id === id)));
ok('every v4 model speaks the Indian languages', VOICE_MODELS.filter((m) => m.id.startsWith('eleven_v4')).every((m) => m.indic));
ok('v2 does not claim them', !modelCaps('eleven_multilingual_v2').indic);
ok('an unknown model is assumed to take everything', modelCaps('eleven_v9').style && modelCaps('eleven_v9').speed);

console.log('\nwhat is sent');
const v4 = await bodyFor('eleven_v4');
ok('v4 is asked for by its id', v4.model_id === 'eleven_v4');
ok('v4 gets no style', !('style' in v4.voice_settings));
ok('v4 gets no speed', !('speed' in v4.voice_settings));
ok('v4 keeps stability and similarity', v4.voice_settings.stability === 0.5 && v4.voice_settings.similarity_boost === 0.8);

const turbo = await bodyFor('eleven_v4_turbo');
ok('v4 Turbo gets neither either', !('style' in turbo.voice_settings) && !('speed' in turbo.voice_settings));

const v2 = await bodyFor('eleven_multilingual_v2');
ok('v2 still gets style', v2.voice_settings.style === 0.4);
ok('v2 still gets speed', v2.voice_settings.speed === 1.1);

const unset = await bodyFor(undefined);
ok('no model chosen means v4', unset.model_id === 'eleven_v4' && !('style' in unset.voice_settings));

console.log('\nhow each line is said');
const sayLine = async (modelId, text, scene) => {
  sent.length = 0;
  const out = await speak('key', text, { ...settings, modelId }, scene);
  return { text: sent[0].body.text, words: out.words.map((w) => w.word) };
};

const hook = await sayLine('eleven_v4', 'Most people get this wrong.', { kind: 'hook', delivery: 'intrigued' });
ok('v4 hears the scene\'s direction in front of its words', hook.text === '[intrigued] Most people get this wrong.', hook.text);
ok('the captions never show it', hook.words.join(' ') === 'Most people get this wrong.', hook.words.join(' '));

const usual = await sayLine('eleven_v4_turbo', 'Is it heat?', { kind: 'question' });
ok('a scene with no direction is said the usual way for its kind', /^\[curious, clear\] Is it heat\?$/.test(usual.text), usual.text);

const units = await sayLine('eleven_v4', 'It draws 10 MW.', { kind: 'explain', delivery: 'warm, clear' });
ok('units are still expanded for the voice, after the direction', units.text === '[warm, clear] It draws 10 megawatts.', units.text);
ok('and folded back on screen, the tag gone and every word on its own time', units.words.join(' ') === 'It draws 10 MW.', units.words.join(' '));

const old = await sayLine('eleven_multilingual_v2', 'Most people get this wrong.', { kind: 'hook', delivery: 'intrigued' });
ok('v2 is never sent a tag: it would read "intrigued" out loud', old.text === 'Most people get this wrong.', old.text);

const own = await sayLine('eleven_v4', '[slow and clear, like a teacher] ಕ.', null);
ok('text that already carries a direction is sent as it is', own.text === '[slow and clear, like a teacher] ಕ.', own.text);
ok('and its words are timed without it', own.words.join(' ') === 'ಕ.', own.words.join(' '));

const bare = await sayLine('eleven_v4', 'ಕ', undefined);
ok('a bare word with no scene gets no direction', bare.text === 'ಕ', bare.text);

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
