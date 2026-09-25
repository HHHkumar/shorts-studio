// Run: node server/seo.test.mjs
//
// The Instagram and Facebook text is pasted straight into their upload forms,
// so the limits that matter are enforced here rather than trusted to the model:
// Instagram ignores every hashtag past the fifth, and a hashtag left inside the
// caption counts against those five too.

import {
  FACEBOOK_HASHTAG_LIMIT, INSTAGRAM_CAPTION_LIMIT, INSTAGRAM_HASHTAG_LIMIT,
  buildPrompt, joinPost, normalizeFacebook, normalizeInstagram, normalizeSeo,
} from './seo.mjs';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('  ok  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + '\n        ' + err.message);
    process.exitCode = 1;
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };

const content = {
  subject: 'Quantitative Aptitude',
  topic: 'Ratio and proportion',
  question: '₹800 is divided between A and B in the ratio 3 : 5. How much does A get?',
  options: ['₹240', '₹300', '₹320', '₹500'],
  correctIndex: 1,
  script: [{ kind: 'explain', narration: 'Eight parts make ₹800, so one part is ₹100.' }],
};

console.log('instagram');

test('never more than five hashtags - Instagram ignores the rest', () => {
  const ig = normalizeInstagram({ caption: 'x', hashtags: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'] });
  assert(ig.hashtags.length === INSTAGRAM_HASHTAG_LIMIT, ig.hashtags.join(' '));
});

test('hashtags lose their #, their spaces, and duplicates that differ only in case', () => {
  const ig = normalizeInstagram({ caption: 'x', hashtags: ['#Ratio', 'ratio', 'SSC CGL', '##maths'] });
  assert(JSON.stringify(ig.hashtags) === '["Ratio","SSCCGL","maths"]', JSON.stringify(ig.hashtags));
});

test('YouTube-only and spam tags are dropped, not spent against the five', () => {
  const ig = normalizeInstagram({ caption: 'x', hashtags: ['Shorts', 'fyp', 'viral', 'ratio', 'YouTubeShorts', 'sscexam'] });
  assert(JSON.stringify(ig.hashtags) === '["ratio","sscexam"]', JSON.stringify(ig.hashtags));
});

test('hashtags written into the caption are taken out of it', () => {
  const ig = normalizeInstagram({ caption: 'Can you split ₹800 in 3:5? #maths\nA bar model makes it easy.\n#ssc #cgl', hashtags: ['ratio'] });
  assert(!ig.caption.includes('#'), ig.caption);
  assert(ig.caption === 'Can you split ₹800 in 3:5?\nA bar model makes it easy.', JSON.stringify(ig.caption));
});

test('the post is the caption, a blank line, then the hashtags', () => {
  const ig = normalizeInstagram({ caption: 'Hook line\nMore', hashtags: ['ratio', 'ssc'] });
  assert(ig.post === 'Hook line\nMore\n\n#ratio #ssc', JSON.stringify(ig.post));
});

test('the whole post, hashtags included, fits in 2,200 characters', () => {
  const ig = normalizeInstagram({ caption: 'word '.repeat(900), hashtags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] });
  assert(ig.post.length <= INSTAGRAM_CAPTION_LIMIT, String(ig.post.length));
  assert(ig.post.endsWith('#epsilon'), 'the hashtags were cut instead of the caption');
});

test('the hook length is measured on the first line, where "more" cuts in', () => {
  const ig = normalizeInstagram({ caption: 'Twelve chars\nand a much longer second line than that', hashtags: [] });
  assert(ig.hookLength === 12, String(ig.hookLength));
});

test('with no Instagram hashtags, the YouTube ones are used - minus #Shorts', () => {
  const ig = normalizeInstagram({ caption: 'x', hashtags: [] }, ['Shorts', 'ratio', 'aptitude']);
  assert(JSON.stringify(ig.hashtags) === '["ratio","aptitude"]', JSON.stringify(ig.hashtags));
});

test('a missing instagram block gives empty fields, not a crash', () => {
  const ig = normalizeInstagram(undefined);
  assert(ig.caption === '' && ig.post === '' && ig.altText === '' && ig.hashtags.length === 0, JSON.stringify(ig));
});

console.log('facebook');

test('at most three hashtags', () => {
  const fb = normalizeFacebook({ caption: 'x', hashtags: ['a1', 'b2', 'c3', 'd4'] });
  assert(fb.hashtags.length === FACEBOOK_HASHTAG_LIMIT, fb.hashtags.join(' '));
});

test('keywords are lower case, comma-free, unique, and at most ten', () => {
  const fb = normalizeFacebook({ keywords: ['Ratio', 'ratio', 'ssc, cgl', ...Array.from({ length: 12 }, (_, i) => 'k' + i)] });
  assert(fb.keywords[0] === 'ratio' && fb.keywords[1] === 'ssc cgl' && fb.keywords.length === 10, JSON.stringify(fb.keywords));
});

test('without keywords, the YouTube tags stand in', () => {
  const fb = normalizeFacebook({ caption: 'x' }, [], ['ratio shortcut', 'ssc cgl maths']);
  assert(JSON.stringify(fb.keywords) === '["ratio shortcut","ssc cgl maths"]', JSON.stringify(fb.keywords));
});

test('title capped and caption cleaned of markdown and hashtags', () => {
  const fb = normalizeFacebook({ title: 'T'.repeat(150), caption: '**Split** ₹800 fast #maths', hashtags: ['ratio'] });
  assert(fb.title.length === 100, String(fb.title.length));
  assert(fb.caption === 'Split ₹800 fast', JSON.stringify(fb.caption));
  assert(fb.post === 'Split ₹800 fast\n\n#ratio', JSON.stringify(fb.post));
});

console.log('the whole pack');

test('normalizeSeo carries both platforms', () => {
  const seo = normalizeSeo({
    titles: ['Ratio trick'], description: 'd', tags: ['ratio'], hashtags: ['Shorts', 'ratio'],
    thumbnailText: 'Split it', pinnedComment: 'Answer below',
    instagram: { caption: 'Can you do this in 10 seconds?', hashtags: ['ratio', 'sscmaths'], altText: 'A bar split into 8 parts' },
    facebook: { title: 'Ratio in 10 seconds', caption: 'A bar model trick.', hashtags: ['ratio'], keywords: ['ratio trick'] },
  }, content);
  assert(seo.instagram.post === 'Can you do this in 10 seconds?\n\n#ratio #sscmaths', JSON.stringify(seo.instagram));
  assert(seo.facebook.title === 'Ratio in 10 seconds' && seo.facebook.keywords[0] === 'ratio trick', JSON.stringify(seo.facebook));
  assert(seo.hashtags.includes('Shorts'), 'YouTube keeps its own #Shorts');
});

test('an old reply without the social blocks still normalizes, falling back to YouTube hashtags', () => {
  const seo = normalizeSeo({ titles: ['t'], description: 'd', tags: ['ratio trick'], hashtags: ['Shorts', 'ratio'] }, content);
  assert(JSON.stringify(seo.instagram.hashtags) === '["ratio"]', JSON.stringify(seo.instagram));
  assert(seo.facebook.keywords[0] === 'ratio trick', JSON.stringify(seo.facebook));
});

test('#Shorts is asked for on YouTube only', () => {
  const prompt = buildPrompt(content, { orientation: 'portrait' });
  assert(/#Shorts in the YouTube hashtags only/.test(prompt), prompt);
});

test('joinPost with no hashtags is just the caption', () => {
  assert(joinPost('Hello', []) === 'Hello');
});

console.log('\n' + passed + ' checks passed');
