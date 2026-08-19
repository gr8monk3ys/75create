// Test environment for `bun test`: a DOM (happy-dom) for localStorage,
// navigator and window/document event targets, plus an in-memory IndexedDB.
// Loaded via bunfig.toml `[test] preload`.
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'https://75create.test/' })

// Bound after registration so the DOM globals don't overwrite them. Assigned
// explicitly rather than via `fake-indexeddb/auto`, whose types aren't
// reachable through its package exports map.
const { indexedDB, IDBKeyRange } = await import('fake-indexeddb')
globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange
