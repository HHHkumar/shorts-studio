import React, { useState } from 'react';
import { api, contentFingerprint, type SeoPack, type TopicForm } from '../lib/api';
import type { QuizContent, DesignSettings, VideoProps } from '../lib/types';
import { ErrorNote, Note, Spinner, TextInput } from './controls';
import { ThumbnailMaker } from './ThumbnailMaker';
import { CarouselMaker } from './CarouselMaker';

interface KitResult {
  url: string;
  name: string;
  bytes: number;
  chapters: number;
  hasThumbnail: boolean;
  carouselSlides?: number;
}

/**
 * The upload form, prepared.
 *
 * Everything here is written to be pasted straight into YouTube, Instagram or
 * Facebook, so each field is one click to copy and already inside that
 * platform's own limits.
 */

const YT_TITLE_LIMIT = 100;
const YT_TAGS_LIMIT = 500;

const CopyBox: React.FC<{
  label: string;
  value: string;
  hint?: string;
  rows?: number;
  limit?: number;
}> = ({ label, value, hint, rows, limit }) => {
  const [copied, setCopied] = useState(false);
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Some browsers block the clipboard API. Select the text instead so the
      // reader can just press Ctrl+C, rather than leaving them with a dead button.
      fieldRef.current?.focus();
      fieldRef.current?.select();
    }
  };

  const over = typeof limit === 'number' && value.length > limit;

  return (
    <div className="copybox">
      <div className="copybox-head">
        <label>{label}</label>
        {typeof limit === 'number' ? (
          <span className={'count' + (over ? ' over' : '')}>
            {value.length} / {limit}
          </span>
        ) : null}
        <button className="btn" onClick={copy} disabled={!value}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {rows ? (
        <textarea
          ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
          readOnly
          rows={rows}
          value={value}
          onFocus={(e) => e.target.select()}
        />
      ) : (
        <input
          ref={fieldRef as React.RefObject<HTMLInputElement>}
          type="text"
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
        />
      )}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
};

const PLATFORMS = [
  { id: 'youtube', label: '▶ YouTube' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'facebook', label: '👍 Facebook' },
] as const;

const IG_CAPTION_LIMIT = 2200;
const IG_HASHTAG_LIMIT = 5;
const IG_HOOK_LENGTH = 125;

/**
 * Instagram and Facebook are searched by the words in the caption, not by a
 * tags box, so these are written for each platform rather than copied from the
 * YouTube description.
 */
const SocialFields: React.FC<{ platform: 'instagram' | 'facebook'; seo: SeoPack }> = ({ platform, seo }) => {
  if (platform === 'instagram') {
    const ig = seo.instagram;
    if (!ig || !ig.caption) return <OlderMetadata name="Instagram" />;
    const hookLong = ig.hookLength > IG_HOOK_LENGTH;
    return (
      <>
        <p className="platform-note">
          Posted as a Reel. Instagram search reads the caption itself, so the topic and exam are
          written into the sentences. Hashtags are capped at five: Instagram ignores any past that,
          and counts ones in a first comment too.
        </p>
        <CopyBox
          label="Caption with hashtags"
          value={ig.post}
          rows={9}
          limit={IG_CAPTION_LIMIT}
          hint={
            (hookLong
              ? '⚠ The first line is ' + ig.hookLength + ' characters - only about ' + IG_HOOK_LENGTH
                + ' show before "more". '
              : 'The first line (' + ig.hookLength + ' characters) is the part people see before "more". ')
            + 'Paste the whole block into the caption box.'
          }
        />
        <div className="grid">
          <CopyBox
            label={'Hashtags (' + ig.hashtags.length + '/' + IG_HASHTAG_LIMIT + ')'}
            value={ig.hashtags.map((h) => '#' + h).join(' ')}
            hint="Already at the end of the caption above."
          />
          <CopyBox
            label="Alt text"
            value={ig.altText}
            hint="Advanced settings → Accessibility → Write alt text. Helps search as well as screen readers."
          />
        </div>
      </>
    );
  }

  const fb = seo.facebook;
  if (!fb || !fb.caption) return <OlderMetadata name="Facebook" />;
  return (
    <>
      <p className="platform-note">
        Facebook shows only a line or two before "See more", so the description is short and the
        hashtags few. The title is for a video upload; a Reel has no title field.
      </p>
      <CopyBox label="Title" value={fb.title} limit={100} />
      <CopyBox label="Description with hashtags" value={fb.post} rows={5} />
      <CopyBox
        label="Tags"
        value={fb.keywords.join(', ')}
        rows={2}
        hint="For the video Tags field, where the upload form offers one."
      />
    </>
  );
};

const OlderMetadata: React.FC<{ name: string }> = ({ name }) => (
  <Note kind="warn" title={'No ' + name + ' text yet'}>
    This metadata was written before {name} was added. Press <b>Write it again</b> above to get a
    caption and hashtags written for {name}.
  </Note>
);

export const StepPublish: React.FC<{
  content: QuizContent;
  form: TopicForm;
  geminiKey: string;
  geminiModel: string;
  channelName: string;
  setChannelName: (v: string) => void;
  seo: SeoPack | null;
  setSeo: (s: SeoPack | null) => void;
  orientation: string;
  design: DesignSettings;
  /** The built timeline, which is where real chapter timestamps come from. */
  videoProps: VideoProps | null;
  /** Gemini image models, for the thumbnail picture. */
  googleImageModels: { id: string; label: string }[];
  onBack: () => void;
}> = ({
  content,
  form,
  geminiKey,
  geminiModel,
  channelName,
  setChannelName,
  seo,
  setSeo,
  orientation,
  design,
  videoProps,
  googleImageModels,
  onBack,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleIndex, setTitleIndex] = useState(0);
  const [platform, setPlatform] = useState<'youtube' | 'instagram' | 'facebook'>('youtube');

  const [thumbnailFile, setThumbnailFile] = useState('');
  const [carouselFolder, setCarouselFolder] = useState('');
  const [kit, setKit] = useState<KitResult | null>(null);
  const [packing, setPacking] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);

  // Metadata describes one specific question; editing the question invalidates it.
  const fingerprint = contentFingerprint(content);
  const stale = !!seo && seo.fingerprint !== fingerprint;
  const fresh = seo && !stale ? seo : null;

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const { seo: pack } = await api.seo(geminiKey.trim(), geminiModel, content, {
        ...form,
        orientation: orientation as TopicForm['orientation'],
        channelName,
      });
      setSeo({ ...pack, fingerprint });
      setTitleIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const packKit = async () => {
    setPacking(true);
    setKitError(null);
    try {
      const out = await api.publishKit({
        content,
        design,
        seo: fresh,
        title: fresh?.titles[titleIndex] || '',
        // The timeline, not the script: chapter marks are real frame positions.
        scenes: videoProps?.scenes || [],
        fps: videoProps?.fps || 30,
        thumbnailFile,
        carouselFolder,
      });
      setKit(out);
    } catch (e) {
      setKitError(e instanceof Error ? e.message : String(e));
    } finally {
      setPacking(false);
    }
  };

  const tagLine = fresh ? fresh.tags.join(', ') : '';
  const hashLine = fresh ? fresh.hashtags.map((h) => '#' + h).join(' ') : '';

  return (
    <div className="panel">
      <h2>Step 7 — Title, tags, description and thumbnail</h2>
      <p className="lede">
        Everything the YouTube, Instagram and Facebook upload forms ask for, written from the video you just made and ready to paste.
      </p>

      <div className="grid">
        <TextInput
          label="Channel or site"
          value={channelName}
          onChange={setChannelName}
          placeholder="electricalmcqs.in"
          hint="Included in the description. Remembered for next time."
        />
        <div className="field">
          <label>&nbsp;</label>
          <button className="btn primary big" onClick={write} disabled={busy}>
            {busy ? <Spinner /> : '✍️'} {fresh || stale ? 'Write it again' : 'Write the metadata'}
          </button>
        </div>
      </div>

      <ErrorNote error={error} />

      {stale ? (
        <Note kind="warn" title="This metadata is out of date">
          The question has changed since it was written. Write it again so the title and tags match
          the video you are about to upload.
        </Note>
      ) : null}

      {busy ? (
        <Note kind="info">Gemini is writing the title options, tags and description for YouTube, Instagram and Facebook…</Note>
      ) : null}

      {fresh ? (
        <div className="platform-tabs" role="tablist">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={platform === p.id}
              className={'step-chip' + (platform === p.id ? ' active' : '')}
              onClick={() => setPlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {fresh && platform === 'instagram' ? (
        <SocialFields platform="instagram" seo={fresh} />
      ) : null}

      {fresh && platform === 'facebook' ? (
        <SocialFields platform="facebook" seo={fresh} />
      ) : null}

      {fresh && platform === 'youtube' ? (
        <>
          <div className="section-title">Title — pick one</div>
          <div className="title-options">
            {fresh.titles.map((t, i) => (
              <button
                key={i}
                className={'title-option' + (i === titleIndex ? ' active' : '')}
                onClick={() => setTitleIndex(i)}
              >
                <span className="pick-dot" />
                <span className="t">{t}</span>
                <span className={'len' + (t.length > YT_TITLE_LIMIT ? ' over' : '')}>{t.length}</span>
              </button>
            ))}
          </div>

          <CopyBox
            label="Chosen title"
            value={fresh.titles[titleIndex] || ''}
            limit={YT_TITLE_LIMIT}
          />

          <CopyBox
            label="Description"
            value={fresh.description}
            rows={12}
            hint="The first line is what shows in search results, so keep the topic and exam in it."
          />

          <CopyBox
            label="Tags"
            value={tagLine}
            rows={3}
            limit={YT_TAGS_LIMIT}
            hint={fresh.tags.length + ' tags. YouTube counts the whole comma-separated string.'}
          />

          <div className="grid">
            <CopyBox label="Hashtags" value={hashLine} />
            <CopyBox
              label="Thumbnail text"
              value={fresh.thumbnailText}
              hint="Two to four words, big enough to read on a phone."
            />
          </div>

          <CopyBox
            label="Pinned comment"
            value={fresh.pinnedComment}
            rows={2}
            hint="Posting this yourself and pinning it tends to start the comments off."
          />
        </>
      ) : null}

      <ThumbnailMaker
        content={content}
        design={design}
        suggested={fresh?.thumbnailText}
        onThumbnail={setThumbnailFile}
        geminiKey={geminiKey}
        geminiModel={geminiModel}
        googleImageModels={googleImageModels}
        chosenTitle={fresh?.titles[titleIndex] || ''}
        description={fresh?.description || ''}
      />

      <CarouselMaker
        content={content}
        design={design}
        channelName={channelName}
        seo={fresh}
        onCarousel={setCarouselFolder}
      />

      <div className="section-title">The upload kit</div>
      <p className="lede" style={{ marginTop: 0 }}>
        Everything above in one zip, saved beside your video. Useful because the boxes on this page
        are gone the moment you close the tab, and the upload usually happens later.
      </p>

      <div className="actions">
        <button className="btn primary" onClick={packKit} disabled={packing || !fresh}>
          {packing ? <Spinner /> : '📦'} {kit ? 'Pack it again' : 'Pack the upload kit'}
        </button>
        {kit ? (
          <a className="btn" href={kit.url} download={kit.name}>
            ⬇ Save {kit.name}
          </a>
        ) : null}
      </div>

      <ErrorNote error={kitError} />

      {!fresh ? (
        <Note kind="info">
          Write the metadata first — the kit is built out of it.
        </Note>
      ) : null}

      {kit ? (
        <Note kind="good" title={'Packed — ' + Math.max(1, Math.round(kit.bytes / 1024)) + ' KB'}>
          <p style={{ marginTop: 0 }}>
            Open <code>UPLOAD.txt</code> first: it is the whole form in order, with the character
            counts already checked. The single fields are in their own files beside it for copying,
            and <code>metadata.json</code> is there if you ever script the upload.
          </p>
          <p style={{ marginBottom: 0 }}>
            {kit.chapters
              ? kit.chapters + ' chapters were worked out from the real scene timings and are '
                + 'already inside the description — you cannot type those accurately by hand.'
              : 'No chapters: YouTube needs at least three, each ten seconds or longer, so short '
                + 'videos do not get them.'}
            {kit.hasThumbnail
              ? ' The thumbnail is in there too.'
              : ' Make a thumbnail above and pack again to include it.'}
            {kit.carouselSlides
              ? ' So is the carousel - ' + kit.carouselSlides + ' slides with their captions, in carousel/.'
              : ''}
          </p>
        </Note>
      ) : null}

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back to the video
        </button>
      </div>
    </div>
  );
};
