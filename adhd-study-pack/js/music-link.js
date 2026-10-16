/**
 * Parse a Spotify or YouTube link, and name the focus stations.
 * No network. Safe to import from tests.
 */
export const FOCUS_SPOTIFY = [
  { title: 'Deep Focus', uri: 'spotify:playlist:37i9dQZF1DWZeKCadgRdKQ' },
  { title: 'Lo-fi study', uri: 'spotify:playlist:37i9dQZF1DX8Uebhn9wzrS' },
  { title: 'Peaceful piano', uri: 'spotify:playlist:37i9dQZF1DX4sWSpwq3LiO' },
  { title: 'Binaural focus', uri: 'spotify:playlist:37i9dQZF1DX7EF8wVxBVhG' }
];

export const FOCUS_YOUTUBE = [
  { title: 'Study', list: 'PL6NdkXsPL07LBOz-XhgCJJGlI4jarMKzp' },
  { title: 'Piano', list: 'PLeWTukCRRF7Nxg7eI0VDK-O7z0NI5p-Ca' },
  { title: 'Night', list: 'PL6NdkXsPL07Iz7bAfbnSv9vcklf4OxPti' },
  { title: 'Mixes', list: 'PL6NdkXsPL07KN01gH2vucrHCEyyNmVEx4' }
];

export const EQ_BANDS = [
  { hz: 60, label: '60' },
  { hz: 150, label: '150' },
  { hz: 400, label: '400' },
  { hz: 1000, label: '1k' },
  { hz: 2400, label: '2.4k' },
  { hz: 6000, label: '6k' },
  { hz: 12000, label: '12k' }
];

export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0],
  Warm: [4, 3, 1, 0, -1, -2, -3],
  Clear: [-2, -1, 0, 2, 3, 2, 1],
  Soft: [2, 1, 0, -1, -2, -4, -5]
};

const KINDS = ['playlist', 'album', 'track', 'episode', 'show'];

/** A real web address, without embedded credentials or ambiguous separators. */
export function safePlaylistUrl(raw) {
  const text = String(raw || '').trim();
  if (!/^https?:\/\//i.test(text) || /[\u0000-\u0020\u007f\\]/.test(text)) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || /^\.+$/.test(url.hostname) || url.username || url.password) return null;
    return url.href;
  } catch (e) { return null; }
}

/** Display the actual destination, even for links that cannot play in-page. */
export function playlistLinkInfo(raw) {
  const href = safePlaylistUrl(raw);
  if (!href) return null;
  const host = new URL(href).hostname.replace(/^www\./, '');
  const music = parseMusicLink(href);
  const provider = music?.source === 'spotify' ? 'Spotify'
    : music?.source === 'youtube' ? (host === 'music.youtube.com' ? 'YouTube Music' : 'YouTube')
    : host === 'music.apple.com' ? 'Apple Music'
    : host === 'soundcloud.com' ? 'SoundCloud' : 'Web link';
  return { href, host, provider, music };
}

export function parseMusicLink(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const spotifyUri = text.match(/^spotify:(playlist|album|track|episode|show):([A-Za-z0-9]{22})$/);
  if (spotifyUri) {
    return { source: 'spotify', uri: 'spotify:' + spotifyUri[1] + ':' + spotifyUri[2], title: 'Spotify ' + spotifyUri[1] };
  }
  const href = safePlaylistUrl(text);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (/^intl-[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0] || '') || parts[0] === 'embed') parts.shift();
    const [kind, id] = parts;
    if (parts.length !== 2 || !KINDS.includes(kind) || !/^[A-Za-z0-9]{22}$/.test(id || '')) return null;
    return { source: 'spotify', uri: 'spotify:' + kind + ':' + id, title: 'Spotify ' + kind };
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const list = url.searchParams.get('list') || '';
    let videoId = url.searchParams.get('v') || '';
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') {
      if (parts.length !== 1) return null;
      videoId = parts[0];
    } else if (['shorts', 'embed', 'live'].includes(parts[0]) && parts.length === 2) {
      videoId = parts[1];
      if (videoId === 'videoseries') videoId = '';
    } else if (!['/watch', '/playlist', '/'].includes(url.pathname)) return null;
    if (videoId && !/^[\w-]{11}$/.test(videoId)) return null;
    if (list && !/^[\w-]+$/.test(list)) return null;
    if (!videoId && !list) return null;
    const music = host === 'music.youtube.com';
    return {
      source: 'youtube',
      videoId: videoId,
      list: list,
      title: music
        ? (list ? 'YouTube Music playlist' : 'YouTube Music')
        : (list ? 'YouTube playlist' : 'YouTube video')
    };
  }
  return null;
}
