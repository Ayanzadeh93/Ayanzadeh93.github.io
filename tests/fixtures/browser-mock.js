/**
 * Browser & Web Audio Mock Environment for Node.js test runner
 * Zero external dependencies — pure native ES module.
 */

export class MockAudioParam {
  constructor(defaultValue = 1) {
    this._value = defaultValue;
    this.scheduled = [];
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = Number(v);
    this.scheduled.push({ type: 'set', value: Number(v), time: 0 });
  }

  setValueAtTime(value, startTime) {
    this._value = Number(value);
    this.scheduled.push({ type: 'setValueAtTime', value: Number(value), time: startTime });
    return this;
  }

  linearRampToValueAtTime(value, endTime) {
    this._value = Number(value);
    this.scheduled.push({ type: 'linearRampToValueAtTime', value: Number(value), time: endTime });
    return this;
  }

  exponentialRampToValueAtTime(value, endTime) {
    this._value = Number(value);
    this.scheduled.push({ type: 'exponentialRampToValueAtTime', value: Number(value), time: endTime });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.scheduled = this.scheduled.filter(s => s.time < startTime);
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this._value = Number(target);
    this.scheduled.push({ type: 'setTargetAtTime', value: Number(target), time: startTime, timeConstant });
    return this;
  }
}

export class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
    this.numberOfInputs = 1;
    this.numberOfOutputs = 1;
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect(destination) {
    if (destination) {
      this.connections = this.connections.filter(c => c !== destination);
    } else {
      this.connections = [];
    }
  }
}

export class MockGainNode extends MockAudioNode {
  constructor(context, initialGain = 1) {
    super(context);
    this.gain = new MockAudioParam(initialGain);
  }
}

export class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
  }
}

export class MockAnalyserNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.fftSize = 2048;
    this.minDecibels = -100;
    this.maxDecibels = -30;
    this.smoothingTimeConstant = 0.8;
  }

  get frequencyBinCount() {
    return this.fftSize / 2;
  }

  getByteFrequencyData(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = (i % 2 === 0) ? 128 : 64;
    }
  }

  getByteTimeDomainData(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }
}

export class MockAudioBuffer {
  constructor(numberOfChannels = 2, length = 44100, sampleRate = 44100) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._channels.push(new Float32Array(length));
    }
  }

  getChannelData(channelIndex) {
    return this._channels[channelIndex] || this._channels[0];
  }
}

export class MockBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new MockAudioParam(1);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

export class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
    this.activeNodes = [];
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  createGain() {
    const node = new MockGainNode(this);
    this.activeNodes.push(node);
    return node;
  }

  createOscillator() {
    const node = new MockOscillatorNode(this);
    this.activeNodes.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = new MockBiquadFilterNode(this);
    this.activeNodes.push(node);
    return node;
  }

  createAnalyser() {
    const node = new MockAnalyserNode(this);
    this.activeNodes.push(node);
    return node;
  }

  createBufferSource() {
    const node = new MockBufferSourceNode(this);
    this.activeNodes.push(node);
    return node;
  }

  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  advanceTime(seconds) {
    this.currentTime += seconds;
  }
}

export class MockStorage {
  constructor() {
    this._data = new Map();
  }

  getItem(key) {
    return this._data.has(String(key)) ? this._data.get(String(key)) : null;
  }

  setItem(key, value) {
    this._data.set(String(key), String(value));
  }

  removeItem(key) {
    this._data.delete(String(key));
  }

  clear() {
    this._data.clear();
  }

  key(index) {
    const keys = Array.from(this._data.keys());
    return keys[index] || null;
  }

  get length() {
    return this._data.size;
  }
}

export class MockNotification {
  static permission = 'default';
  static instances = [];

  static requestPermission() {
    MockNotification.permission = 'granted';
    return Promise.resolve('granted');
  }

  static reset() {
    MockNotification.permission = 'default';
    MockNotification.instances = [];
  }

  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    this.closed = false;
    MockNotification.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

export class MockDOMTokenList {
  constructor(element) {
    this.element = element;
    this._tokens = new Set();
  }

  add(...tokens) {
    tokens.forEach(t => {
      if (t) this._tokens.add(String(t).trim());
    });
    this._sync();
  }

  remove(...tokens) {
    tokens.forEach(t => {
      this._tokens.delete(String(t).trim());
    });
    this._sync();
  }

  toggle(token, force) {
    const t = String(token).trim();
    if (force !== undefined) {
      if (force) this.add(t);
      else this.remove(t);
      return force;
    }
    const has = this.contains(t);
    if (has) this.remove(t);
    else this.add(t);
    return !has;
  }

  contains(token) {
    return this._tokens.has(String(token).trim());
  }

  toString() {
    return Array.from(this._tokens).join(' ');
  }

  _sync() {
    if (this.element) {
      this.element._className = this.toString();
    }
  }

  _fromClassName(str = '') {
    this._tokens.clear();
    str.split(/\s+/).filter(Boolean).forEach(t => this._tokens.add(t));
  }
}

export class MockElement {
  constructor(tagName = 'div', doc = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
    this.id = '';
    this._className = '';
    this.classList = new MockDOMTokenList(this);
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this._listeners = new Map();
    this._innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    this._rect = { top: 100, left: 100, width: 100, height: 40, bottom: 140, right: 200, x: 100, y: 100 };
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = String(html || '');
    this.children = [];
    parseHtmlToElements(this._innerHTML, this.ownerDocument || this, this);
  }

  get className() {
    return this._className;
  }

  set className(v) {
    this._className = String(v || '');
    this.classList._fromClassName(this._className);
  }

  setAttribute(name, value) {
    const n = name.toLowerCase();
    const strVal = String(value);
    this.attributes.set(n, strVal);
    if (n === 'id') this.id = strVal;
    if (n === 'class') this.className = strVal;
    if (n.startsWith('data-')) {
      const prop = n.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = strVal;
    }
  }

  getAttribute(name) {
    const n = name.toLowerCase();
    if (n === 'id') return this.id || null;
    if (n === 'class') return this.className || null;
    return this.attributes.has(n) ? this.attributes.get(n) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name) {
    const n = name.toLowerCase();
    this.attributes.delete(n);
    if (n === 'id') this.id = '';
    if (n === 'class') this.className = '';
    if (n.startsWith('data-')) {
      const prop = n.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  insertBefore(newChild, refChild) {
    if (!refChild) return this.appendChild(newChild);
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) {
      this.children.splice(idx, 0, newChild);
      newChild.parentElement = this;
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  }

  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches.length > 0 ? matches[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const testElement = el => {
      if (matchesSelector(el, selector)) results.push(el);
      for (const child of el.children) {
        testElement(child);
      }
    };
    for (const child of this.children) {
      testElement(child);
    }
    return results;
  }

  getBoundingClientRect() {
    return Object.assign({}, this._rect);
  }

  setMockBoundingRect(rect) {
    this._rect = Object.assign(this._rect, rect);
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (this._listeners.has(type)) {
      this._listeners.set(type, this._listeners.get(type).filter(l => l !== listener));
    }
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    const listeners = this._listeners.get(event.type) || [];
    for (const fn of listeners) {
      fn.call(this, event);
    }
    if (this.parentElement && !event.cancelBubble) {
      this.parentElement.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new MockEvent('click', { bubbles: true }));
  }

  focus() {
    this.dispatchEvent(new MockEvent('focus', { bubbles: false }));
  }

  blur() {
    this.dispatchEvent(new MockEvent('blur', { bubbles: false }));
  }
}

export class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = !!options.bubbles;
    this.cancelable = !!options.cancelable;
    this.defaultPrevented = false;
    this.cancelBubble = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation() {
    this.cancelBubble = true;
  }
}

export class MockCustomEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail || null;
  }
}

export function parseHtmlToElements(html, doc, parent = null) {
  if (!html || typeof html !== 'string') return [];
  const results = [];
  const stack = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const tagRegex = /<\/?([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, tagName, attrString, selfClose, text] = match;
    if (text) {
      if (stack.length > 0) {
        stack[stack.length - 1].textContent += text;
      }
      continue;
    }

    if (full.startsWith('</')) {
      const tagLower = tagName.toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName.toLowerCase() === tagLower) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }

    const el = new MockElement(tagName, doc);
    if (attrString) {
      const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(attrString)) !== null) {
        const attrName = aMatch[1];
        const attrVal = aMatch[2] !== undefined ? aMatch[2] : (aMatch[3] !== undefined ? aMatch[3] : (aMatch[4] !== undefined ? aMatch[4] : ''));
        el.setAttribute(attrName, attrVal);
      }
    }

    if (stack.length > 0) {
      stack[stack.length - 1].appendChild(el);
    } else {
      if (parent) parent.appendChild(el);
      results.push(el);
    }

    const isVoid = voidTags.has(tagName.toLowerCase()) || selfClose === '/';
    if (!isVoid) {
      stack.push(el);
    }
  }

  return results;
}

function matchesCompound(el, sel) {
  if (!sel) return false;
  let s = sel;
  const tagMatch = s.match(/^[a-zA-Z0-9_-]+/);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
    s = s.slice(tagMatch[0].length);
  }

  const parts = s.match(/(#[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+|\[[^\]]+\])/g) || [];
  if (parts.join('') !== s) {
    if (s.length > 0) return false;
  }

  for (const part of parts) {
    if (part.startsWith('#')) {
      if (el.id !== part.slice(1)) return false;
    } else if (part.startsWith('.')) {
      if (!el.classList.contains(part.slice(1))) return false;
    } else if (part.startsWith('[')) {
      const inner = part.slice(1, -1);
      const m = inner.match(/^([a-zA-Z0-9_-]+)(?:([*^$]?=)(["']?)(.*?)\3)?$/);
      if (!m) return false;
      const [, attr, op, , val] = m;
      if (!el.hasAttribute(attr)) return false;
      if (op) {
        const attrVal = el.getAttribute(attr);
        if (op === '=' && attrVal !== val) return false;
        if (op === '^=' && !attrVal.startsWith(val)) return false;
        if (op === '$=' && !attrVal.endsWith(val)) return false;
        if (op === '*=' && !attrVal.includes(val)) return false;
      }
    }
  }
  return true;
}

function matchesSelector(el, sel) {
  if (!sel || typeof sel !== 'string') return false;
  sel = sel.trim();

  if (sel.includes(',')) {
    return sel.split(',').some(part => matchesSelector(el, part.trim()));
  }

  const tokens = sel.split(/\s+/);
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (!matchesCompound(el, last)) return false;
    let curr = el.parentElement;
    for (let i = tokens.length - 2; i >= 0; i--) {
      const targetToken = tokens[i];
      let matched = false;
      while (curr) {
        if (matchesCompound(curr, targetToken)) {
          matched = true;
          curr = curr.parentElement;
          break;
        }
        curr = curr.parentElement;
      }
      if (!matched) return false;
    }
    return true;
  }

  return matchesCompound(el, sel);
}


export class MockDocument extends MockElement {
  constructor() {
    super('#document');
    this.ownerDocument = this;
    this.documentElement = new MockElement('html', this);
    this.head = new MockElement('head', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.hidden = false;
    this.title = '';
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  getElementById(id) {
    const results = this.querySelectorAll('#' + id);
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * Setup and tear down browser environment on globalThis
 */
let originalGlobals = null;

export function setupBrowserEnv(options = {}) {
  if (originalGlobals) teardownBrowserEnv();

  const mockDoc = new MockDocument();
  const mockStorageLocal = new MockStorage();
  const mockStorageSession = new MockStorage();

  const mockWindow = {
    document: mockDoc,
    innerWidth: options.innerWidth || 1280,
    innerHeight: options.innerHeight || 800,
    localStorage: mockStorageLocal,
    sessionStorage: mockStorageSession,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    Notification: MockNotification,
    CustomEvent: MockCustomEvent,
    Event: MockEvent,
    matchMedia: query => ({
      matches: options.prefersReducedMotion && query.includes('prefers-reduced-motion') ? true : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
    requestAnimationFrame: cb => setTimeout(() => cb(Date.now()), 16),
    cancelAnimationFrame: id => clearTimeout(id),
    location: { href: 'http://localhost:3000/apps/adhd-study-pack.html', hash: '', search: '' },
    open: () => null,
    addEventListener: (type, fn) => mockDoc.addEventListener(type, fn),
    removeEventListener: (type, fn) => mockDoc.removeEventListener(type, fn),
    dispatchEvent: ev => mockDoc.dispatchEvent(ev)
  };

  originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    AudioContext: globalThis.AudioContext,
    webkitAudioContext: globalThis.webkitAudioContext,
    Notification: globalThis.Notification,
    CustomEvent: globalThis.CustomEvent,
    Event: globalThis.Event,
    matchMedia: globalThis.matchMedia,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame
  };

  globalThis.window = mockWindow;
  globalThis.document = mockDoc;
  globalThis.localStorage = mockStorageLocal;
  globalThis.sessionStorage = mockStorageSession;
  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;
  globalThis.Notification = MockNotification;
  globalThis.CustomEvent = MockCustomEvent;
  globalThis.Event = MockEvent;
  globalThis.matchMedia = mockWindow.matchMedia;
  globalThis.requestAnimationFrame = mockWindow.requestAnimationFrame;
  globalThis.cancelAnimationFrame = mockWindow.cancelAnimationFrame;

  return {
    window: mockWindow,
    document: mockDoc,
    localStorage: mockStorageLocal,
    sessionStorage: mockStorageSession
  };
}

export function teardownBrowserEnv() {
  if (!originalGlobals) return;
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  globalThis.localStorage = originalGlobals.localStorage;
  globalThis.sessionStorage = originalGlobals.sessionStorage;
  globalThis.AudioContext = originalGlobals.AudioContext;
  globalThis.webkitAudioContext = originalGlobals.webkitAudioContext;
  globalThis.Notification = originalGlobals.Notification;
  globalThis.CustomEvent = originalGlobals.CustomEvent;
  globalThis.Event = originalGlobals.Event;
  globalThis.matchMedia = originalGlobals.matchMedia;
  globalThis.requestAnimationFrame = originalGlobals.requestAnimationFrame;
  globalThis.cancelAnimationFrame = originalGlobals.cancelAnimationFrame;
  originalGlobals = null;
  MockNotification.reset();
}

/**
 * Firebase Auth & GIS Mocks for Authentication Tests
 */
export class MockGoogleAuthProvider {
  constructor() {
    this.scopes = [];
    this.customParameters = {};
  }

  addScope(scope) {
    this.scopes.push(scope);
    return this;
  }

  setCustomParameters(params) {
    this.customParameters = Object.assign(this.customParameters, params);
    return this;
  }
}

export const MockFirebaseAuth = {
  GoogleAuthProvider: MockGoogleAuthProvider,
  credentialFromResult(result) {
    return {
      accessToken: result?.token || 'mock-gcal-access-token-xyz'
    };
  },
  signInWithPopup(auth, provider) {
    return Promise.resolve({
      user: {
        uid: 'google-user-123',
        displayName: 'ADHD Student',
        email: 'student@example.com',
        providerData: [{ providerId: 'google.com' }]
      },
      token: 'mock-gcal-access-token-xyz',
      provider
    });
  },
  sendPasswordResetEmail(auth, email) {
    if (!email || !email.includes('@') || !email.includes('.')) {
      const err = new Error('auth/invalid-email');
      err.code = 'auth/invalid-email';
      return Promise.reject(err);
    }
    return Promise.resolve();
  }
};
