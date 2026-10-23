// ---------------------------------------------------------------------------
// Retrying the calls that are worth retrying.
//
// A 503 from Gemini means "the model is busy right now", not "your request was
// wrong" - and it clears on its own within a second or two. Making the creator
// notice the red box and press the button again is a poor way to handle
// something the tool can simply do itself.
// ---------------------------------------------------------------------------

/**
 * Statuses that mean "try again", as opposed to "this request is wrong".
 *  429 rate limited, 500 internal, 502 bad gateway, 503 overloaded, 504 timeout.
 * Deliberately absent: 400, 401, 402, 403, 404, 422 - retrying those just
 * wastes time and, on a paid endpoint, possibly money.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with jitter, unless the server named its own delay. */
function delayFor(res, attempt) {
  const header = res.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 20) * 1000;
  }
  const base = 1200 * Math.pow(2, attempt); // 1.2s, 2.4s, 4.8s
  return Math.min(8000, base) + Math.random() * 400;
}

/**
 * fetch(), but transient failures are retried before giving up.
 *
 * Returns the final Response either way - the caller still decides what a
 * non-ok status means, so every existing error message keeps working.
 */
export async function fetchRetrying(url, init, options = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const onRetry = options.onRetry;
  // Without this a stalled connection hangs until undici's own 300s limit and
  // then fails with UND_ERR_HEADERS_TIMEOUT, which tells a creator nothing.
  const timeoutMs = options.timeoutMs ?? 120000;

  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      // A timeout is not a transient blip - retrying it just makes the creator
      // wait the same amount again - so it stops here with a clear message.
      if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new Error(
          'No reply after ' + Math.round(timeoutMs / 1000) + ' seconds, so the tool gave up. '
          + 'This is usually a very long script on a slow model: try a Flash model, or ask for a '
          + 'shorter video.',
        );
      }
      // A dropped connection is worth one more go; a bad URL is not, but that
      // will fail identically on the retry and surface the same error.
      lastError = err;
      if (attempt === attempts - 1) throw err;
      if (onRetry) onRetry(attempt + 1, 'network');
      await sleep(delayFor({ headers: new Headers() }, attempt));
      continue;
    }

    if (res.ok || !RETRYABLE.has(res.status) || attempt === attempts - 1) return res;

    if (onRetry) onRetry(attempt + 1, res.status);
    await sleep(delayFor(res, attempt));
  }

  // Unreachable in practice; the loop either returns or throws.
  throw lastError || new Error('Request failed after ' + attempts + ' attempts.');
}
