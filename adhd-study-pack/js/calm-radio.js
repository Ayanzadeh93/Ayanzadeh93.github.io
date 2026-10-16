/**
 * Boots the glass player. The old Cove radio streamed archived records.
 * Those files stay off this page. Pieces are written in js/glass-player.js.
 */
import { mount, SONGS } from './glass-player.js?v=4.45.0';

export { SONGS };

if (typeof document !== 'undefined') {
  const start = () => mount();
  if (document.getElementById('glassMount') || document.getElementById('glassDock')) start();
  else document.addEventListener('DOMContentLoaded', start);
}
