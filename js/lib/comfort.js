/**
 * comfort.js — accessibility and neurodivergent-comfort settings for the
 * ADHD Study Pack.
 *
 * Needs differ and sometimes pull in opposite directions: an ADHD attention
 * system tends to like quick feedback, streaks, sound and nudges; many autistic
 * people find the same things noisy and prefer muted colour, little motion,
 * no surprises and a warning before every change. So the app ships ADHD-first
 * defaults, a handful of starting profiles, and every individual switch.
 *
 * This module owns:
 *   - COMFORT_DEFAULTS / COMFORT_PRESETS — the settings and the profiles
 *   - applyComfort()  — reflects a settings object onto <html> (data-* and --ts)
 *   - announce()      — screen-reader live regions (NVDA, JAWS, Narrator,
 *                       VoiceOver, TalkBack all read these)
 *   - speech          — the optional built-in voice (Web Speech API), for
 *                       people who want things read aloud without a screen reader
 * It never touches the workspace itself; js/adhd-study-pack.js stores the
 * object at S.settings.comfort and mirrors it per device for the sign-in screen.
 */

export const COMFORT_DEFAULTS = Object.freeze({
    profile: 'adhd',            // last profile picked; 'custom' once anything is changed by hand
    basedOn: 'adhd',
    // Seeing
    textSize: 100,              // percent
    spacing: 'normal',          // normal | relaxed | loose
    font: 'default',            // default | readable (Atkinson Hyperlegible) | system
    contrast: 'standard',       // standard | high
    color: 'vivid',             // vivid | soft | mono
    focusRing: 'standard',      // standard | strong
    underlineLinks: false,
    // Motion
    motion: 'system',           // system | reduce | full
    // Focus & interruptions
    messages: 'all',            // all | important | none (still announced to screen readers)
    messageTime: 'short',       // short (about 3 s) | long (about 8 s) | stay (until dismissed)
    coaching: true,             // nudges, "go!" messages, movement prompts
    streaks: true,              // streak chip and streak figures
    warnBefore: 0,              // minutes of warning before a timer ends (0 = off)
    simpleFocus: false,         // hide the secondary cards on the Focus screen
    explanations: true,         // the descriptive paragraphs under headings
    hiddenViews: [],            // sections left out of the navigation
    // Reading & speech
    speech: false,              // built-in voice
    voice: '',                  // voiceURI; '' = the system default
    rate: 1,
    speakTimer: true,           // starts, warnings and endings
    speakMessages: false,       // every pop-up message
    srTimeLeft: 0,              // screen readers: announce time left every N minutes (0 = off)
    // Keyboard
    shortcuts: true             // single-key shortcuts (WCAG 2.1.4 requires a way to turn them off)
});

/* Each profile is a starting point: it sets these values and leaves the rest
   at the defaults. `settings` touches the matching timer behaviour switches. */
export const COMFORT_PRESETS = {
    adhd: {
        name: 'ADHD',
        badge: 'Default',
        about: 'Lively and quick to reward: nudges, streaks, sounds and a check-in after each block. Built for starting, and for noticing when attention drifts.',
        comfort: {},
        settings: { autoBreak: true, autoFocus: false, checkinAfter: true, moveBreak: true, chimeVol: 70 }
    },
    calm: {
        name: 'Calm and predictable',
        badge: 'Autism-friendly',
        about: 'Muted colour, almost no motion, no streak pressure and far fewer pop-ups. Every change is announced two minutes ahead, and nothing starts by itself.',
        comfort: { color: 'soft', motion: 'reduce', messages: 'important', messageTime: 'long', coaching: false, streaks: false, warnBefore: 2, simpleFocus: true },
        settings: { autoBreak: false, autoFocus: false, checkinAfter: false, moveBreak: false, chimeVol: 35 }
    },
    lowvision: {
        name: 'Low vision',
        badge: 'Seeing',
        about: 'Larger text, stronger contrast, a thick focus outline and underlined links. Works alongside your browser or system zoom.',
        comfort: { textSize: 125, contrast: 'high', focusRing: 'strong', underlineLinks: true, spacing: 'relaxed' },
        settings: {}
    },
    reading: {
        name: 'Easier reading',
        badge: 'Dyslexia-friendly',
        about: 'A typeface designed for legibility, wider letter and line spacing, and slightly larger text.',
        comfort: { font: 'readable', spacing: 'loose', textSize: 112, messageTime: 'long' },
        settings: {}
    },
    screenreader: {
        name: 'Screen reader',
        badge: 'Blind and low vision',
        about: 'For NVDA, JAWS, Narrator, VoiceOver and TalkBack: time left is announced every five minutes, single-key shortcuts are off so they never clash with your reader, and nothing moves.',
        comfort: { srTimeLeft: 5, shortcuts: false, motion: 'reduce', speech: false, messages: 'all' },
        settings: {}
    }
};

/* The keys a profile may change — used to show what differs from it. */
export const PROFILE_KEYS = ['textSize', 'spacing', 'font', 'contrast', 'color', 'focusRing', 'underlineLinks',
    'motion', 'messages', 'messageTime', 'coaching', 'streaks', 'warnBefore', 'simpleFocus', 'explanations', 'speech',
    'srTimeLeft', 'shortcuts'];

/** A full comfort object for a profile, keeping personal choices (voice, speed, hidden sections). */
export function presetComfort(key, current) {
    const p = COMFORT_PRESETS[key] || COMFORT_PRESETS.adhd;
    const keep = current ? { voice: current.voice, rate: current.rate, hiddenViews: current.hiddenViews } : {};
    return { ...COMFORT_DEFAULTS, ...keep, ...p.comfort, profile: key, basedOn: key };
}

/** Which settings differ from the profile they started from. */
export function changesFromProfile(c) {
    const base = presetComfort(c.basedOn || 'adhd', c);
    return PROFILE_KEYS.filter(k => JSON.stringify(c[k]) !== JSON.stringify(base[k]));
}

/** Fill in keys that did not exist when a saved object was written. */
export function normaliseComfort(raw) {
    const c = { ...COMFORT_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
    c.textSize = Math.min(200, Math.max(80, Number(c.textSize) || 100));
    c.rate = Math.min(2, Math.max(0.5, Number(c.rate) || 1));
    c.warnBefore = Math.max(0, Number(c.warnBefore) || 0);
    c.srTimeLeft = Math.max(0, Number(c.srTimeLeft) || 0);
    if (!Array.isArray(c.hiddenViews)) c.hiddenViews = [];
    return c;
}

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
function ensureReadableFont() {
    if (document.getElementById('comfort-font')) return;
    const link = document.createElement('link');
    link.id = 'comfort-font'; link.rel = 'stylesheet'; link.href = FONT_CSS;
    document.head.appendChild(link);
}

/** Reflect the settings on <html>; the stylesheet does the rest. */
export function applyComfort(c, root = document.documentElement) {
    root.style.setProperty('--ts', String(c.textSize / 100));
    const set = (name, value) => { if (value) root.setAttribute('data-' + name, value); else root.removeAttribute('data-' + name); };
    set('spacing', c.spacing !== 'normal' && c.spacing);
    set('font', c.font !== 'default' && c.font);
    set('contrast', c.contrast === 'high' && 'high');
    set('color', c.color !== 'vivid' && c.color);
    set('focus', c.focusRing === 'strong' && 'strong');
    set('links', c.underlineLinks && 'underline');
    set('motion', c.motion);
    // Layouts that fold on a narrow window fold at large text too: a media
    // query cannot multiply its breakpoint by --ts, so the step is set here.
    set('scale', c.textSize >= 150 ? 'xl' : c.textSize >= 120 ? 'lg' : '');
    set('coaching', !c.coaching && 'off');
    set('streaks', !c.streaks && 'off');
    set('simple', c.simpleFocus && 'on');
    set('explain', !c.explanations && 'off');
    if (c.font === 'readable') ensureReadableFont();
}

/* ---------------------------------------------------------------------------
   Screen-reader announcements. Two live regions in the page: polite for news,
   assertive (role="alert") for what must interrupt, like a timer ending. The
   text is cleared first so the same message said twice is read twice, and
   messages sent together are joined rather than the last one replacing the
   rest (starting the timer says what started *and* the coaching line).
   --------------------------------------------------------------------------- */
const pending = { srPolite: [], srAlert: [] }, flushAt = {};
export function announce(message, urgent = false) {
    const id = urgent ? 'srAlert' : 'srPolite', el = document.getElementById(id);
    if (!el || !message) return;
    pending[id].push(String(message));
    el.textContent = '';
    clearTimeout(flushAt[id]);
    flushAt[id] = setTimeout(() => { el.textContent = pending[id].join(' '); pending[id] = []; }, 80);
}

/* ---------------------------------------------------------------------------
   Built-in voice. Uses the voices installed on the device (Windows, macOS,
   iOS, Android and ChromeOS all ship some), so nothing leaves the browser.
   --------------------------------------------------------------------------- */
export const speech = {
    get supported() { return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; },
    voices() {
        if (!this.supported) return [];
        const lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        const all = window.speechSynthesis.getVoices();
        const mine = all.filter(v => (v.lang || '').toLowerCase().startsWith(lang));
        return (mine.length ? mine : all).slice().sort((a, b) => Number(b.default) - Number(a.default) || a.name.localeCompare(b.name));
    },
    /** Speak `text`. `interrupt` cancels anything still being read first. */
    say(text, { voice = '', rate = 1, interrupt = true } = {}) {
        if (!this.supported || !text) return;
        const synth = window.speechSynthesis;
        if (interrupt) synth.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        const v = voice && synth.getVoices().find(x => x.voiceURI === voice);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = document.documentElement.lang || 'en';
        u.rate = rate;
        synth.speak(u);
    },
    stop() { if (this.supported) window.speechSynthesis.cancel(); },
    onVoicesChanged(fn) {
        if (this.supported && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', fn);
    }
};
