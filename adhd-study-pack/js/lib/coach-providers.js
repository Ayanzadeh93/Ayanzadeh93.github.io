/* Coach providers — the online half of the study coach.
 *
 * The on-device coach (WebLLM) needs WebGPU, a few hundred megabytes to two
 * gigabytes of weights, and enough memory to hold them. On a phone that often
 * cannot work at all, which is what "Load failed" was really saying. These
 * providers are the way out: the person's own API key, the browser talking to
 * the provider directly, nothing to download and nothing to host.
 *
 * Same shape as js/lib/todoist.js: DOM-free, `fetch` injected, so every
 * mapping rule below is tested without touching the network.
 *
 * On keys in a browser: Anthropic's own documentation is blunt that a key held
 * client-side is exposed to anyone with access to the browser, and is sensible
 * mainly for personal tools and short-lived, revocable credentials. That is the
 * case here — it is the person's own key, spending their own credit, revocable
 * from their own dashboard — and the UI says so plainly next to the field. Keys
 * live in their own localStorage entries and never enter the workspace object,
 * so they are never written into an export file or synced to Firestore.
 */

export const PROVIDERS = {
  device: {
    id: 'device',
    label: 'On this device',
    online: false,
    needsKey: false
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    online: true,
    needsKey: true,
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelsUrl: null,                 // no public list endpoint; the models below are pinned
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    /* Exact model strings. Never append a date suffix to these. */
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5 — strongest' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — cheapest' }
    ],
    defaultModel: 'claude-opus-5'
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT',
    online: true,
    needsKey: true,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelsUrl: 'https://api.openai.com/v1/models',
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [],                      // filled from the live list once a key is present
    defaultModel: 'gpt-4o-mini'
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    online: true,
    needsKey: true,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    keyPrefix: 'sk-or-',
    keyUrl: 'https://openrouter.ai/keys',
    models: [],
    defaultModel: 'openai/gpt-4o-mini'
  }
};

export const ONLINE_IDS = Object.keys(PROVIDERS).filter((id) => PROVIDERS[id].online);

export function isOnline(provider) {
  return !!(PROVIDERS[provider] && PROVIDERS[provider].online);
}

/** Shape check only, so an obvious paste error fails here and not over the wire. */
export function isValidKey(provider, key) {
  const p = PROVIDERS[provider];
  if (!p || !p.needsKey) return false;
  const k = String(key || '').trim();
  if (k.length < 20 || /\s/.test(k)) return false;
  if (provider === 'openai' && (k.startsWith('sk-ant-') || k.startsWith('sk-or-'))) return false;
  return k.startsWith(p.keyPrefix);
}

/** Chat models only, when the provider's full list is mostly audio and image ids. */
export function preferChatModels(rows) {
  const chat = (rows || []).filter((m) => {
    const id = String((m && m.id) || '').toLowerCase();
    if (!id.startsWith('gpt-')) return false;
    return !/audio|realtime|image|transcribe|tts|whisper|embed|dall|moderation|search/.test(id);
  });
  return chat.length ? chat : (rows || []).slice();
}

/* ---------------------------------------------------------------------------
   Request building. Anthropic has its own message shape; OpenAI and OpenRouter
   share one. `system` travels as a top-level field for Anthropic and as the
   first message for the other two.
   --------------------------------------------------------------------------- */

export function buildHeaders(provider, apiKey) {
  const key = String(apiKey || '').trim();
  if (provider === 'anthropic') {
    return {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      /* Without this the browser request is refused outright: the API does not
         serve cross-origin callers unless they opt in knowingly. */
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }
  return { 'content-type': 'application/json', authorization: 'Bearer ' + key };
}

export function buildBody(provider, { model, system, messages, maxTokens = 400 }) {
  const turns = (messages || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant'));
  if (provider === 'anthropic') {
    return {
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: turns.map((m) => ({ role: m.role, content: String(m.content || '') })),
      stream: true,
      /* The coach answers in under ninety words. Low effort is the documented
         lever for short conversational turns and keeps the person's bill down. */
      output_config: { effort: 'low' }
    };
  }
  const list = system ? [{ role: 'system', content: system }] : [];
  return {
    model,
    max_tokens: maxTokens,
    messages: list.concat(turns.map((m) => ({ role: m.role, content: String(m.content || '') }))),
    stream: true,
    temperature: 0.55
  };
}

/** The text carried by one streamed event, or '' when the event carries none. */
export function deltaOf(provider, event) {
  if (!event || typeof event !== 'object') return '';
  if (provider === 'anthropic') {
    if (event.type === 'content_block_delta' && event.delta) {
      return String(event.delta.text || '');
    }
    return '';
  }
  const choice = event.choices && event.choices[0];
  return String((choice && choice.delta && choice.delta.content) || '');
}

/* ---------------------------------------------------------------------------
   Errors. A status code helps nobody mid-conversation; each of these names what
   to do about it.
   --------------------------------------------------------------------------- */
export function errorFor(provider, status, detail) {
  const name = (PROVIDERS[provider] && PROVIDERS[provider].label) || 'The provider';
  if (status === 401 || status === 403) return `${name} rejected that API key. Check it, or paste a new one.`;
  if (status === 404) return `${name} does not have that model. Pick another from the list.`;
  if (status === 429) return `${name} is rate-limiting this key. Wait a moment, then try again.`;
  if (status === 402) return `${name} says this key is out of credit.`;
  if (status >= 500) return `${name} is having trouble right now. Try again shortly.`;
  if (detail) return `${name} refused the request: ${detail}`;
  return `${name} returned ${status}.`;
}

async function readError(res) {
  try {
    const body = await res.json();
    const err = body && (body.error || body);
    return (err && (err.message || err.type)) || '';
  } catch (e) { return ''; }
}

/* ---------------------------------------------------------------------------
   Streaming. One server-sent-events reader; the per-provider difference is only
   which field carries the text, which `deltaOf` above answers.
   --------------------------------------------------------------------------- */

/** Parse a chunk of SSE text into events, returning any incomplete tail. */
export function parseSse(buffer, onEvent) {
  let rest = String(buffer || '');
  let cut = rest.indexOf('\n');
  while (cut !== -1) {
    const line = rest.slice(0, cut).trim();
    rest = rest.slice(cut + 1);
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try { onEvent(JSON.parse(payload)); } catch (e) { /* keep-alive or partial */ }
      }
    }
    cut = rest.indexOf('\n');
  }
  return rest;
}

/**
 * Send one turn and stream the reply. `onDelta` receives text as it arrives;
 * the whole reply is returned when the stream closes.
 */
export async function chatStream({
  provider, apiKey, model, system, messages,
  maxTokens = 400, signal, fetchImpl, onDelta
} = {}) {
  const p = PROVIDERS[provider];
  if (!p || !p.online) throw new Error('Pick an online coach first.');
  if (!isValidKey(provider, apiKey)) throw new Error(`Add your ${p.label} API key first.`);
  if (!model) throw new Error(`Choose which ${p.label} model to use.`);
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) throw new Error('No fetch available in this environment');

  let res;
  try {
    res = await f(p.endpoint, {
      method: 'POST',
      headers: buildHeaders(provider, apiKey),
      body: JSON.stringify(buildBody(provider, { model, system, messages, maxTokens })),
      signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    /* A browser blocked by CORS lands here with a bare TypeError and no status. */
    throw new Error(`Could not reach ${p.label} from this browser. Check your connection, or use OpenRouter, which is built for browser callers.`);
  }

  if (!res.ok) throw new Error(errorFor(provider, res.status, await readError(res)));

  let reply = '';
  const push = (event) => {
    if (event && event.type === 'error' && event.error) {
      throw new Error(`${p.label}: ${event.error.message || 'stream error'}`);
    }
    const piece = deltaOf(provider, event);
    if (piece) { reply += piece; if (onDelta) onDelta(piece, reply); }
  };

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = parseSse(buffer + decoder.decode(value, { stream: true }), push);
    }
    parseSse(buffer + '\n', push);
  } else {
    /* No streaming body (a mocked fetch, or a proxy that buffers): take the text. */
    parseSse((await res.text()) + '\n', push);
  }
  return reply;
}

/**
 * The models a key can reach. OpenRouter publishes its list openly; OpenAI needs
 * the key. Anthropic has no public list endpoint, so its pinned models are used.
 */
export async function listModels({ provider, apiKey, fetchImpl } = {}) {
  const p = PROVIDERS[provider];
  if (!p || !p.online) return [];
  if (!p.modelsUrl) return p.models.slice();
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return p.models.slice();
  try {
    const headers = p.id === 'openrouter' ? {} : buildHeaders(provider, apiKey);
    const res = await f(p.modelsUrl, { headers });
    if (!res.ok) return [];
    const body = await res.json();
    const rows = (body && body.data) || [];
    return rows
      .map((r) => ({ id: String(r.id || ''), label: String(r.name || r.id || '') }))
      .filter((r) => r.id)
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (e) { return []; }
}
