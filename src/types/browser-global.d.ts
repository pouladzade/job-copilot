// Ambient global for `browser.*` — aliases Chrome's extension API.
// At build time, WXT injects the real webextension-polyfill, which
// mirrors the Chrome API surface. For `tsc --noEmit`, we declare
// `browser` as a type alias of the Chrome namespace.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const browser: typeof chrome;