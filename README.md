# ThreadX

Is a library to quickly exchange (share) data between workers and the main thread. It uses SharedArrayBuffers to store raw binary data and workers can create views for accessing this shared memory.

## Setup

- `npm install`

## Build

- `npm run build`
- `npm run watch` (Watch Mode)

This builds the library using the TypeScript compiler and places the output to
a directory named `dist`.

When run in Watch Mode, the TypeScript compiler will listen for changes to files
and automatically recompile

## Tests

- `npm run test:browser` (Browser Integration Tests)
- `npm run test` (Unit Tests)

There are two categories of tests run by the commands above: Unit Tests and Browser
Integration Tests. When running either category, the test runner will remain open
and re-run when any changes are detected to the code.

### Browser Integration Tests

Browser Integration Tests focus on the user-end capabilities / features of
ThreadX, such as creating/closing workers, sending messages to workers,
receiving responses from workers, and using SharedObjects / BufferStructs
to share data between workers. These tests use Mocha + Chai and are launched
(by default) in the Chrome browser.

**NOTE:** The Integration Tests rely on the built assets in the `dist` folder. For
the best live testing experience, run a build in Watch Mode at the same time
as running the Integration Tests.

### Unit Tests

Unit Tests focus on whatever we can test that does not rely on browser APIs
such as Workers. Self-contained utility methods are great candidates for unit
tests. These tests are written with Vitest which uses virtually similar
testing constructs as Mocha + Chai.

## Security

As a requirement, your app needs to be in a secture context. For top level documents, two headers need to be set to cross-origin isolate yout app.

- Cross-Origin-Embedder-Policy : require-corp ( protects your origin from attackers )
- Cross-Origin-Opener-Policy : same-origin ( protects victims from your origin )

to test if isolation is succesfull you can check the `crossOriginIsolated` property available in `Worker` and `Window` contexts:

```js
if (globalThis.crossOriginIsolated) {
  // app logic
}
```

## Atomics

Since we share memory and multiple threads can read and write to the same piece of memory, we need the `Atomics` object to perform atomic operations on the `SharedArrayBuffer` objects. `Atomics` make sure that operations run uninterrupted and are finished before the next will.
