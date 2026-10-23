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
  sent.push({ url: String(url), body: JSON.parse(init.body) });
  const payload = {
    audio_base64: Buffer.from('not really an mp3').toString('base64'),
    alignment: { characters: ['h', 'i'], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.4] },
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

console.log(failed ? '\n' + failed + ' failed\n' : '\nall passed\n');
process.exit(failed ? 1 : 0);
