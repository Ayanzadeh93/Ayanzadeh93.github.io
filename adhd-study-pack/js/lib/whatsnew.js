/* What's New — pure helpers for the post-login version card.
   The page decides when to draw the modal; this module only answers
   "should we show it, and what does it say?" so tests stay DOM-free. */

export const AWAY_MS = 7 * 86400000;

export const RELEASES = [
  {
    version: '4.46.0',
    name: 'Twenty more room tones',
    date: '2026-10-15',
    highlights: [
      'Room tone grows to twenty-four recordings: wind, streams, thunder, night fields, a jungle, a train, a café, a library and more.',
      'Each new sound carries its own picture, and nine ready-made mixes show up beside the classics.',
      'Every recording is mastered as a seamless loop, so nothing clicks when a layer repeats.'
    ]
  },
  {
    version: '4.45.0',
    name: 'A clearer Setup that feels like yours',
    date: '2026-10-15',
    highlights: [
      'Find settings faster with clearer section names, plain-language descriptions, and a more welcoming starting point.',
      'Search for things like text size, reminders, or timer settings, then jump straight to the right control.',
      'Setup is easier to scan on phones, with compact navigation and changes that take effect as you make them.'
    ]
  },
  {
    version: '4.43.0',
    name: 'The pictures are part of the guide',
    date: '2026-10-15',
    highlights: [
      'The Help tour now uses real, checked images and draws a clear focus-dial illustration if a photo cannot load.',
      'About adds three visual paths into Focus, Mood, and Music, with images that fall back to matching icons.',
      'The working app address and direct links now have a clearer home on About.'
    ]
  },
  {
    version: '4.42.0',
    name: 'A clearer guide to the Study Pack',
    date: '2026-10-15',
    highlights: [
      'Help has one search for all guides, clearer topics, and direct links to each part of the pack.',
      'Find new guides for the Study Coach, Study together, profile, course workload, About, and privacy. Open the Coach tour when you want it; it no longer moves on its own.',
      'A new focus-dial mark replaces the placeholder icon, and the About page now uses accurate feature descriptions.'
    ]
  },
  {
    version: '4.41.0',
    name: 'Your progress, made visible',
    date: '2026-10-15',
    highlights: [
      'The Passport shows your current level, weekly focus rhythm, and milestones in one calm progress view.',
      'Filter achievements by earned, in progress, focus blocks, focus time, or study rhythm. Motion follows your reduced-motion setting.',
      'The study Coach now offers quick prompts, clearer setup, and a Stop response button. Online replies receive the workspace summary described on screen.'
    ]
  },
  {
    version: '4.40.0',
    name: 'A little room to reset',
    date: '2026-10-15',
    highlights: [
      'Mood, energy, and stress each get a clear history. Days without a check-in stay blank.',
      'Pick any day to read its entries. Check-in and breathing settings stay put while you switch patterns.',
      'Save playlists by service, edit them later, and start Spotify or YouTube picks in the player.'
    ]
  },
  {
    version: '4.39.0',
    name: 'Bring work in, and keep the private things private',
    date: '2026-10-14',
    highlights: [
      'A syllabus date can be corrected before it is saved. A pasted file does not start the assistant.',
      'A shared desk and a trusted summary leave mood, email, and your account alone. Revoke stops access.',
      'The timer can move once to another device. Passkeys are not offered. This address stays the one that works.'
    ]
  },
  {
    version: '4.38.0',
    name: 'Practice, writing, and a quiet week',
    date: '2026-10-14',
    highlights: [
      'A problem stays hidden until you write an attempt. A model note is not an answer key.',
      'A draft can match each rubric line, or show the line that is still missing. The copy stays on this device.',
      'Read-aloud stops on the same passage. A skipped week is not a failure. Scores stay on until you turn them off.'
    ]
  },
  {
    version: '4.37.0',
    name: 'The dial shows where you are',
    date: '2026-10-14',
    highlights: [
      'The focus dial draws a live ember on a canvas. It holds still when motion is reduced.',
      'Start, stay, and close sit under the clock, so the next move is one sentence.',
      'Changing screens and turning the week slide instead of snapping. Hard-refresh once.'
    ]
  },
  {
    version: '4.36.2',
    name: 'The workspace starts again',
    date: '2026-10-14',
    highlights: [
      'The page was stopping before the timer, plan, and tasks could start. That is fixed. Hard-refresh once.'
    ]
  },
  {
    version: '4.36.0',
    name: 'Coursework keeps its deadline',
    date: '2026-10-14',
    highlights: [
      'An assignment has one deadline and a draft of steps. Putting work on the week does not move that deadline.',
      'The week stays on Plan. Coursework opens under the calendar and does not cover it.',
      'Fit into free hours skips all-day items and leaves what does not fit unscheduled. A missed block can move, shrink, or leave today.',
      'Estimates use active minutes only. A course shelf holds links and notes. On an exam map, confidence does not count as learned.'
    ]
  },
  {
    version: '4.35.0',
    name: 'Start without an account',
    date: '2026-10-14',
    highlights: [
      'Start without an account. That workspace stays on this device and is not copied when you later sign in.',
      'The first screen asks for an optional task and two or twenty-five minutes. Can\'t start runs a real two-minute clock with no model and no key.',
      'Today holds at most three commitments. A task can be broken into steps, paused into a resume card, and restored from trash.'
    ]
  },
  {
    version: '4.34.0',
    name: 'Trust',
    date: '2026-10-14',
    highlights: [
      'Coach and Todoist keys stay with this account. They are not in an export, and the next account on this browser does not receive them.',
      'Clear this browser, delete the workspace, and delete the account are separate. A refusal is not called a success.',
      'Only the host can delete a study room. A stranger cannot raise the seat count. Privacy text names the coach, music, Todoist, and Firebase timing.'
    ]
  },
  {
    version: '4.33.0',
    name: 'The save chip tells the truth',
    date: '2026-10-14',
    highlights: [
      'Synced means the server has the workspace. Waiting to sync means it is only on this device. Saved on this device is a local profile.',
      'A refused save keeps a copy you can download. Import keeps the previous workspace on this device before it replaces anything.'
    ]
  },
  {
    version: '4.32.0',
    name: 'A shared computer signs out',
    date: '2026-10-14',
    highlights: [
      'Mark this computer as shared. Sign-out then clears the cloud cache, Todoist, coach keys, and calendar access.',
      'A shared computer does not reopen the last person’s workspace. Theme stays. A local profile’s tasks stay behind its sign-in.'
    ]
  },
  {
    version: '4.31.0',
    name: 'Two journals, one browser',
    date: '2026-10-14',
    highlights: [
      'A second profile on this computer no longer sees the first profile’s focus sessions, check-ins, or moods.',
      'History written while signed out stays on this browser until you choose to move it into an account.'
    ]
  },
  {
    version: '4.30.0',
    name: 'The deadline stays put',
    date: '2026-10-14',
    highlights: [
      'Putting work on Tuesday no longer changes a Friday deadline. Due is the deadline. Plan is the day you will do it.',
      'Not today and the week move the plan only. The deadline changes when you edit Due.'
    ]
  },
  {
    version: '4.29.0',
    name: 'The clock survives a refresh',
    date: '2026-10-14',
    highlights: [
      'Leave and come back. A running timer continues from the same deadline instead of resetting.',
      'Paused time is not study time. A break in the middle is left out of the session.'
    ]
  },
  {
    version: '4.28.0',
    name: 'Match, then study',
    date: '2026-10-14',
    highlights: [
      'Together finds someone who picked the same session, then shows the room. A private link still works if you turn matching off.',
      'The room has your camera, mute, screen share, a focus timer you start yourself, and End. Picture and voice still go browser to browser.'
    ]
  },
  {
    version: '4.27.0',
    name: 'The desk clock',
    date: '2026-10-14',
    highlights: [
      'The first page is the clock. A ring draws when you arrive and when you press Start.',
      'The task you are on sits in its own card. The other cards stay quiet so the dial can lead.'
    ]
  },
  {
    version: '4.26.0',
    name: 'Say the list',
    date: '2026-10-14',
    highlights: [
      'Voice turns a spoken list into tasks. You can type the same list. Say start focus, go to plan, or park a thought.',
      'Place on today drops the chosen tasks into the open hours. What does not fit stays in the inbox.'
    ]
  },
  {
    version: '4.25.0',
    name: 'A card people can open',
    date: '2026-10-14',
    highlights: [
      'Your profile is a card. Turn on Show my card and a signed-in student can open it by your @username.',
      'The priority matrix is four boxes: Do, Plan, Limit, Drop. The number on each box is how many tasks sit there.'
    ]
  },
  {
    version: '4.24.0',
    name: 'A link to the table',
    date: '2026-10-14',
    highlights: [
      'Share a link from the table. A friend who opens it lands on that seat and can join with the camera or by voice.',
      'On a phone, Share link opens the usual send sheet. Copy link works everywhere else.'
    ]
  },
  {
    version: '4.23.0',
    name: 'Sit down with someone',
    date: '2026-10-14',
    highlights: [
      'Together is a study table. One partner or up to six, camera or voice, with a code a friend can join.',
      'Picture and voice go straight between the browsers. The page does not record them. A listed table is visible to other signed-in students.'
    ]
  },
  {
    version: '4.22.0',
    name: 'A name, and your own ChatGPT',
    date: '2026-10-13',
    highlights: [
      'Your profile has a username. It shows as @name on the card, on the account, and in the corner.',
      'Coach can use ChatGPT through an OpenAI key that stays in this browser. A Plus plan cannot be linked here, because OpenAI only allows that for partner apps such as Notion.'
    ]
  },
  {
    version: '4.21.0',
    name: 'A player, not a black box',
    date: '2026-10-13',
    highlights: [
      'YouTube Music opens the song list instead of a blank panel. Deep sleep and the other live videos become Night, Study, or Mixes.',
      'Your library asks for playlists and liked songs. If Google has not turned YouTube on for this site, the four stations still play.'
    ]
  },
  {
    version: '4.20.0',
    name: 'Your music accounts',
    date: '2026-10-13',
    highlights: [
      'Wellbeing has a Log in to Spotify button. Sign in with your account, then press Play for full songs.',
      'YouTube Music replaces the YouTube tab. The stations are song lists, not the live video.',
      'Your library uses your Google account, and it stays separate from Calendar.'
    ]
  },
  {
    version: '4.19.0',
    name: 'Ink and ember on Edit',
    date: '2026-10-13',
    highlights: [
      'The edit dialog uses ink for the type and edges, and ember for Close and the focus ring.'
    ]
  },
  {
    version: '4.18.0',
    name: 'Edit in the paper colours',
    date: '2026-10-13',
    highlights: [
      'Edit and its dialog use the paper ember, not the bright orange accent.'
    ]
  },
  {
    version: '4.17.0',
    name: 'Edit on the task',
    date: '2026-10-13',
    highlights: [
      'Every task has an Edit button, in the list and on the plan.',
      'It opens the name, the date, the flag, and the steps.'
    ]
  },
  {
    version: '4.16.0',
    name: 'Day, week, grid, month',
    date: '2026-10-13',
    highlights: [
      'Plan can switch between Day, Week, Grid, and Month.',
      'By subject groups the grid. Show done brings finished tasks back.',
      'Place drops an open task onto the next free hour.'
    ]
  },
  {
    version: '4.15.0',
    name: 'The plan rail',
    date: '2026-10-13',
    highlights: [
      'Plan now has Today, Upcoming, and Inbox, with a count on each.',
      'A month sits under those lists. Tap a day and the week moves there.',
      'Today shows how many hours are already timed, and the work beside it.'
    ]
  },
  {
    version: '4.14.0',
    name: 'A mark on the slider',
    date: '2026-10-13',
    highlights: [
      'Each mood slider shows its word on the track. The lamp, the figure, and the ring move with the number.',
      'The extra sentence stays out of the way until you hover or focus the slider.',
      'Screens ease in, and the mood dot follows your hand.'
    ]
  },
  {
    version: '4.13.0',
    name: 'A shore, not a filter',
    date: '2026-10-13',
    highlights: [
      'Room tone plays a shore, rain, a forest, and a hearth. Those are recordings. Pink noise is no longer the mix.',
      'A habit can be every day, chosen days, or a few times a week. An off day does not break the streak.',
      'Each habit wears a small moving mark. A finished focus block can count, the way a focus timer counts a habit.'
    ]
  },
  {
    version: '4.12.0',
    name: 'A player that plays',
    date: '2026-10-13',
    highlights: [
      'Music can play a Spotify playlist or a YouTube link. Deep Focus is the first Spotify station.',
      'Log in inside the Spotify player for full songs. Your YouTube uses the same Google sign-in as Calendar.',
      'An equalizer shapes the desk pieces: Flat, Warm, Clear, and Soft.'
    ]
  },
  {
    version: '4.11.0',
    name: 'A glass room',
    date: '2026-10-12',
    highlights: [
      'Wellbeing is one room. Calm, Music, Mood, and Habits share the same quiet glass.',
      'Music is a player. Previous, next, and eight pieces written for this desk. They loop here. No old recording.',
      'Room tone still sits under the piece. Silence stops both.'
    ]
  },
  {
    version: '4.10.0',
    name: 'A quieter desk',
    date: '2026-10-12',
    highlights: [
      'Focus has Reorder. Drag the Move handle, or hold a card. Earlier and Later still work without a drag.',
      'The timer wears a cover for focus, a short break, and a long break. Calendar files moved to Setup.',
      'Passport shows a level ring and a short burst when a level lands. Sound opens on a scene, and Help leads with a picture.'
    ]
  },
  {
    version: '4.9.0',
    name: 'An assistant you install once',
    date: '2026-10-12',
    highlights: [
      'Setup → Assistant is one command. Claude, Codex, Cursor, VS Code, Grok, and the others start it themselves.',
      'Choose the folder ADHD Study Pack once. This page and those apps share the list. No window has to stay open.',
      'The steps are a picture and a moving dial. It still names one next step, and it will not delete unless you are clear.'
    ]
  },
  {
    version: '4.8.0',
    name: 'An assistant that stays on this computer',
    date: '2026-10-12',
    highlights: [
      'Setup → Assistant links this list to Claude Code, Codex, Cursor, VS Code, or Grok on the same computer.',
      'The assistant names one next step, adds a task, parks a thought, or checks a habit. It does not lecture, and it will not delete unless you are clear.',
      'The list stays in a file on this machine. A phone cannot see that file. Grok in a browser tab cannot either.'
    ]
  },
  {
    version: '4.7.0',
    name: 'A board you can rearrange',
    date: '2026-10-09',
    highlights: [
      'Arrange, next to the dial, lets you drag each Focus card, move it with Earlier and Later, or take it off the board.',
      'Add puts back Priority check, and also mood, habits, course load, coming up, someday, pinned notes, and a reset.',
      'The dial stays where it is. Handles only show while you are arranging, so a normal session stays quiet.'
    ]
  },
  {
    version: '4.6.1',
    name: 'Setup you can scan',
    date: '2026-10-09',
    highlights: [
      'Setup is grouped into Start, How it feels, The work, and Account. Search finds a setting by a word like font, chime, or someday.',
      'Each choice sits on its own row, with a larger switch. The photo banners are gone so the setting is the only thing in view.',
      'Shared links use ayanzadeh.com as the address for this workspace.'
    ]
  },
  {
    version: '4.6.0',
    name: 'A shorter list',
    date: '2026-10-09',
    highlights: [
      'Tasks open on Today, Upcoming, and Inbox. Not today moves a date. Someday parks the rest so the week can stay short.',
      'The add box understands friday, 2 pomos, #course, p1, and every weekday. Steps, repeat, and dragging a task onto the week are in Setup → Tasks, and each one can be turned off.',
      'Todoist can stay in sync: finishing or redating a linked task updates it there. Its p1–p4 flag stays separate from the matrix.'
    ]
  },
  {
    version: '4.5.0',
    name: 'A typeface you can actually switch',
    date: '2026-10-09',
    highlights: [
      'Setup → Seeing now has a typeface picker. Lexend, Atkinson Hyperlegible and Andika are the easier-reading faces; Paper uses the planner’s fonts everywhere.',
      'Heavier letters thickens thin type. The reading guide is a soft band that follows the pointer and never blocks a click.',
      'The Easier reading profile starts on Lexend with wider spacing. Low vision starts with heavier letters.'
    ]
  },
  {
    version: '4.4.0',
    name: 'Drag the week, and see past it',
    date: '2026-10-09',
    highlights: [
      'Blocks can be dragged to another hour or another day. The bar at the bottom of a block changes how long it runs, in 15-minute steps.',
      'The planner opens on 14 days. Switch to 7 or 21 next to Today when you want a tighter week or a longer look ahead.',
      'Google events on those extra days come through with the rest of the calendar. Drag still edits only the blocks you created here.'
    ]
  },
  {
    version: '4.3.0',
    name: 'A week you can actually see',
    date: '2026-10-09',
    highlights: [
      'Plan is now a paper week: today is the filled date, each day shows how much is already planned, and a line marks the current time.',
      'More than four hours on a day turns ember, and overlapping blocks say so, so a packed afternoon is obvious before you start it.',
      'Courses, auto-schedule, Google Calendar and .ics import or export are still in the same place. Short notes beside them say what each one does.'
    ]
  },
  {
    version: '4.2.0',
    name: 'Quiet protection behind the scenes',
    date: '2026-09-21',
    highlights: [
      'Firebase App Check now guards sign-in and sync against scripted traffic — free, and does not change how signing in works.',
      'Real-world load and network timing are now measured through Firebase Performance Monitoring, so slow spots can be found and fixed.'
    ]
  },
  {
    version: '4.1.0',
    name: 'A coach that works on a phone',
    date: '2026-09-21',
    highlights: [
      'The coach can now run online through your own Claude, OpenAI or OpenRouter API key — nothing to download, and it works on a phone, where the on-device model often could not load at all.',
      'The on-device model loads by itself when it is already in this browser. A first download still asks, and tells you how big it is, so nothing large starts on mobile data by surprise.',
      'When the on-device model cannot run, the coach now says why — no WebGPU, not enough memory, a blocked download — instead of only "Load failed".'
    ]
  },
  {
    version: '4.0.0',
    name: 'Seven destinations, one profile, levels',
    date: '2026-09-20',
    highlights: [
      'The sidebar went from fifteen buttons to seven. Tasks and Priorities sit under Plan; Calm, Sound, Mood and Habits under Wellbeing; Statistics beside Passport under Progress. Nothing was removed — everything is one tab in.',
      'Your name, photo and bio moved to their own You screen, and a Google photo finally shows up on its own after signing in.',
      'Passport now counts experience: minutes, finished blocks, your streak and every badge add up to a level, so a short session still moves something.'
    ]
  },
  {
    version: '3.9.0',
    name: 'Fifty milestones & quieter search',
    date: '2026-09-20',
    highlights: [
      'Passport now carries fifty FocusQuest milestones — creative glyphs from First Spark to Focus Sovereign.',
      '⌘K search jumps to any section by name or alias, and /ask · ai: · @coach send prompts to the on-device coach.',
      'Setup panels and a few views use calm scene photos and icons; denser layout for fewer distractions.'
    ]
  },
  {
    version: '3.8.1',
    name: 'Professional colour & gradients',
    date: '2026-09-20',
    highlights: [
      'Setup → Seeing now offers five calm professional accents (Slate, Navy, Teal, Sage, Graphite) beside Ember, Moss, Iris and Amber.',
      'Optional Soft or Rich accent gradients wash primary buttons and a light backdrop — turn Off anytime.',
      'Colour swatches make picking an accent one tap, with a live preview in the same panel.'
    ]
  },
  {
    version: '3.7.3',
    name: 'Calendar views first',
    date: '2026-09-20',
    highlights: [
      'Connect Google Calendar now only asks to view your events so the planner can work around them.',
      'Sending blocks to Google is a separate switch. That is when Google asks for edit access.',
      'Sign-in is still name and email only. Google may still mark Calendar as unverified until they finish reviewing those scopes.'
    ]
  },
  {
    version: '3.7.2',
    name: 'Safer Google sign-in',
    date: '2026-09-20',
    highlights: [
      'Continue with Google now only asks for your name and email. It no longer requests Calendar access.',
      'Calendar sync is optional: connect it later from Plan if you want it. Sign-in works without that popup.',
      'A public Privacy page says exactly what is stored, what Google sees, and what is never requested at login.'
    ]
  },
  {
    version: '3.7.1',
    name: 'Catch you up',
    date: '2026-09-20',
    highlights: [
      'After you sign in with Google, email, or a local profile, a short card names this version and what changed.',
      'If you have not opened the pack for a week, the same card welcomes you back even when the version has not moved.',
      'Dismiss it once and it stays quiet until the next version — or until you have been away again. Re-open it any time from About.'
    ]
  },
  {
    version: '3.7.0',
    name: 'Passport, Help & Habits',
    date: '2026-09-18',
    highlights: [
      'Passport tab: display name, photo and bio on the account you already use.',
      'Eight focus achievements that unlock from sessions you actually finish.',
      'Help centre with search and category filters, kept off the working screens.',
      'Habits: Build, Counters and Break, with forgiving streaks and an impulse pause.'
    ]
  }
];

export function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function unseenReleases(seenVersion, releases = RELEASES) {
  return (releases || [])
    .filter(r => cmpVersion(r.version, seenVersion) > 0)
    .sort((a, b) => cmpVersion(b.version, a.version));
}

export function currentRelease(version, releases = RELEASES) {
  return (releases || []).find(r => r.version === version) || (releases && releases[0]) || null;
}

export function whatsNewPayload({
  seenVersion = null,
  lastVisit = 0,
  now = Date.now(),
  awayMs = AWAY_MS,
  version,
  releases = RELEASES
} = {}) {
  const unseen = unseenReleases(seenVersion, releases);
  if (unseen.length) {
    return { kind: 'update', version, releases: unseen, name: unseen[0].name };
  }
  const away = lastVisit && (now - lastVisit >= awayMs);
  if (away) {
    const cur = currentRelease(version, releases);
    if (!cur) return null;
    return { kind: 'welcome', version, releases: [cur], name: cur.name };
  }
  return null;
}

export function mergeWhatsNewRecord(device = {}, cloud = {}) {
  const v = [cloud.v, device.v].filter(Boolean).sort(cmpVersion).pop() || null;
  const lasts = [cloud.last, device.last].map(n => Number(n) || 0).filter(Boolean);
  const last = lasts.length ? Math.max(...lasts) : 0;
  return { v, last };
}

export function whatsNewDeviceKey(storageKey, userId) {
  const base = String(storageKey || 'focusdial.v3') + '.whatsnew';
  return userId ? base + ':' + userId : base;
}

export function readWhatsNewRecord(storage, key) {
  if (!storage || !key) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? { v: o.v || null, last: Number(o.last) || 0 } : {};
  } catch (e) {
    return {};
  }
}

export function writeWhatsNewRecord(storage, key, rec) {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify({ v: rec && rec.v || null, last: Number(rec && rec.last) || 0 }));
    return true;
  } catch (e) {
    return false;
  }
}
