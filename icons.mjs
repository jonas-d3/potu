const paths = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  stats:
    '<g fill="currentColor" stroke="none"><rect x="2" y="13" width="5" height="8" rx="1"/><rect x="9.5" y="3" width="5" height="18" rx="1"/><rect x="17" y="8" width="5" height="13" rx="1"/></g>',
  help: '<path d="M7 8a5 5 0 0 1 10 .2c0 3.8-5 4.2-5 7"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
  settings:
    '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="m10 1-.7 3-2 .9-2.7-1.5-2.7 4.3 2.3 2-.2 2.5-2.7 1.5 1.6 4.7 3-.3 1.8 1.5.1 3 5 .6 1-2.9 2.3-.8 2.5 1.6 3.1-4-2.1-2.2.2-2.5 2.7-1.5-1.6-4.7-3 .3-1.8-1.5-.1-3zM12 7.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="5"/>',
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke-width="2"/>',
  undo: '<path d="M3 5v6h6M3.5 10a9 9 0 1 1 1 7M12 7v5l3 2"/>',
  check:
    '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m7.5 10.5 2 2 4-4m3 8 4.5 4.5"/>',
  hint: '<path d="M9 17c0-3-3.7-4.1-3.7-8a6.7 6.7 0 1 1 13.4 0c0 3.9-3.7 5-3.7 8M9 19h6m-5 3h4"/>',
  tick: '<path d="m4 12 5 5L20 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="currentColor" stroke="none"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="8" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="8" cy="16" r="1.8"/><circle cx="16" cy="16" r="1.8"/></g>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  trophy:
    '<path d="M7 3h10v5c0 4-2 7-5 7s-5-3-5-7zM7 5H3v2a5 5 0 0 0 5 5m9-7h4v2a5 5 0 0 1-5 5m-4 3v5m-5 1h10"/>',
};
export function icon(name) {
  return (
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">' +
    paths[name] +
    "</svg>"
  );
}
