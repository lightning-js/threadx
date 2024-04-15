# ThreadX (Beta)

**Warning: This is beta software and all of the exposed APIs are subject to
breaking changes**

ThreadX is a web browser-based JavaScript library that helps manage the
communcation of data between one or more web worker threads.

ThreadX handles data communcation in two ways:

One is via the standard
[postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
API. This facilitates passing of complex nested object data.

The other is via [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) between two workers. ThreadX
provides two base classes which can be implemented side-by-side in order to
facilitate fast exchange of object properties: BufferStruct and SharedObject.
The BufferStruct defines the basic structure of data as it will exist in the
SharedArrayBuffer, while the SharedObject provides an API for either worker
to access and set properties in a syncronous manner.

Examples on how BufferStructs and SharedObjects are used are available in our
`browser-tests` directory and in the Lightning 3 Renderer repo.

## Setup

- `npm install`

## Build

- `npm run build`
- `npm run watch` (Watch Mode)

This builds the library using the TypeScript compiler and places the output to
a directory named `dist`.

When run in Watch Mode, the TypeScript compiler will listen for changes to files
and automatically recompile

## Docs

- `npm run typedoc`

This builds the TypeDoc API documentation files which you can browse using your
web browser from the `typedocs` folder.

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
