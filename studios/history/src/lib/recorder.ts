// ---------------------------------------------------------------------------
// Recording narration in the browser.
//
// The mic is recorded with MediaRecorder, then decoded and cleaned up before
// it is saved:
//   - the silence before she starts speaking and after she stops is trimmed,
//     so a scene is exactly as long as its words (plus a natural breath);
//   - the level is evened out, so every take sits at the same loudness;
//   - it is written as a plain WAV, which every part of the pipeline can
//     measure exactly - MediaRecorder's own webm often has no length header.
// ---------------------------------------------------------------------------

export interface Take {
  wav: Blob;
  duration: number;
  /** Where speech starts and stops inside the trimmed clip, for estimating word timings. */
  speechStart: number;
  speechEnd: number;
  /** True when the take was essentially silent - usually the wrong microphone. */
  silent: boolean;
}

const LEAD_IN = 0.12;
const TAIL = 0.25;

export class Recorder {
  private stream: MediaStream | null = null;
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;

  async open(deviceId = ''): Promise<void> {
    if (this.stream) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'NotAllowedError') throw new Error('The browser was not allowed to use the microphone. Click the mic icon in the address bar and allow it.');
      if (name === 'NotFoundError') throw new Error('No microphone was found. Plug one in and try again.');
      throw new Error('Could not open the microphone: ' + ((err as Error)?.message || name));
    }
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    src.connect(this.analyser);
  }

  /** 0..1 input level, for the meter. */
  level(): number {
    if (!this.analyser || !this.buf) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) peak = Math.max(peak, Math.abs(this.buf[i]));
    return Math.min(1, peak * 1.4);
  }

  get recording(): boolean {
    return Boolean(this.media && this.media.state === 'recording');
  }

  start(): void {
    if (!this.stream) throw new Error('The microphone is not open.');
    this.chunks = [];
    this.media = new MediaRecorder(this.stream);
    this.media.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.media.start(250);
  }

  async stop(): Promise<Take> {
    const media = this.media;
    if (!media) throw new Error('Not recording.');
    await new Promise<void>((resolve) => {
      media.onstop = () => resolve();
      media.stop();
    });
    this.media = null;
    const blob = new Blob(this.chunks, { type: media.mimeType || 'audio/webm' });
    return processTake(blob, this.ctx || new AudioContext());
  }

  cancel(): void {
    if (this.media && this.media.state !== 'inactive') this.media.stop();
    this.media = null;
  }

  close(): void {
    this.cancel();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.analyser = null;
  }
}

export async function listMics(): Promise<{ id: string; label: string }[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ id: d.deviceId, label: d.label || 'Microphone ' + (i + 1) }));
}

async function processTake(blob: Blob, ctx: AudioContext): Promise<Take> {
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const rate = decoded.sampleRate;

  // Mix down to mono.
  const mono = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
  }

  const { start, end, peak } = speechBounds(mono, rate);
  const silent = peak < 0.02 || end <= start;

  const from = silent ? 0 : Math.max(0, start - Math.round(LEAD_IN * rate));
  const to = silent ? mono.length : Math.min(mono.length, end + Math.round(TAIL * rate));
  const trimmed = mono.slice(from, to);

  // Even out the level: bring the peak to about -1 dBFS, but never boost more
  // than 4x - that would only make room noise louder.
  const gain = silent ? 1 : Math.min(4, 0.89 / Math.max(peak, 1e-4));
  for (let i = 0; i < trimmed.length; i++) trimmed[i] = Math.max(-1, Math.min(1, trimmed[i] * gain));

  // Fade the very ends so a trim never clicks.
  const fade = Math.min(trimmed.length >> 1, Math.round(0.01 * rate));
  for (let i = 0; i < fade; i++) {
    trimmed[i] *= i / fade;
    trimmed[trimmed.length - 1 - i] *= i / fade;
  }

  const duration = trimmed.length / rate;
  return {
    wav: encodeWav(trimmed, rate),
    duration,
    speechStart: silent ? 0 : (start - from) / rate,
    speechEnd: silent ? duration : (end - from) / rate,
    silent,
  };
}

/** First and last sample of speech, from 20ms windows compared to the loudest one. */
export function speechBounds(samples: Float32Array, rate: number): { start: number; end: number; peak: number } {
  const win = Math.max(1, Math.round(rate * 0.02));
  const rms: number[] = [];
  let peak = 0;
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const stop = Math.min(samples.length, i + win);
    for (let j = i; j < stop; j++) {
      sum += samples[j] * samples[j];
      peak = Math.max(peak, Math.abs(samples[j]));
    }
    rms.push(Math.sqrt(sum / (stop - i)));
  }
  const loudest = rms.reduce((m, v) => Math.max(m, v), 0);
  const threshold = Math.max(0.006, loudest * 0.08);
  let first = rms.findIndex((v) => v > threshold);
  let last = rms.length - 1 - [...rms].reverse().findIndex((v) => v > threshold);
  if (first < 0) {
    first = 0;
    last = rms.length - 1;
  }
  return { start: first * win, end: Math.min(samples.length, (last + 1) * win), peak };
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const bytes = 44 + samples.length * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const text = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = samples[i];
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}
