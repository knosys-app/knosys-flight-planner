// Stub for publishing airports.sqlite to a CDN / GitHub Release. Left as a
// placeholder to document the intended workflow. For now, developers should:
//
//   1. Run `npm run build:db` to produce data/airports.sqlite locally.
//   2. Upload airports.sqlite + airports.meta.json to a stable URL (GitHub
//      Release asset recommended). Update AIRPORTS_DB_URL in src/constants.ts
//      to match.
//   3. The plugin downloads from that URL on first run and caches in OPFS.
//
// A real publish script would use the GitHub REST API (`gh release upload`)
// or upload to the user's preferred CDN. This is intentionally deferred until
// the user commits to a hosting location.

console.log(
  [
    '\u2139\ufe0f  publish-data is a stub.',
    '   Upload data/airports.sqlite to your chosen CDN manually, then set',
    '   AIRPORTS_DB_URL in src/constants.ts to the public URL.',
    '   A future revision can automate this via `gh release upload`.',
  ].join('\n'),
);
