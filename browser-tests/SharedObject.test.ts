/*
 * Copyright 2023 Comcast Cable Communications Management, LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { SharedObject, ThreadX } from '@lightningjs/threadx';
import { TestSharedObject } from './shared-objects/TestSharedObject.js';
import { TestBufferStruct } from './buffer-structs/TestBufferStruct.js';
import TestWorker from './workers/TestWorker.js?worker';
import { expect } from 'chai';
import { delay, simpleSpy } from './test-utils.js';
import { ExtTestBufferStruct } from './buffer-structs/ExtTestBufferStruct.js';
import { ExtTestSharedObject } from './shared-objects/ExtTestSharedObject.js';

describe('SharedObject', function () {
  let threadx: ThreadX;
  beforeEach(() => {
    threadx = ThreadX.init({
      workerId: 1,
      workerName: 'main',
    });
  });

  afterEach(() => {
    ThreadX.destroy();
  });

  describe('static', () => {
    describe('extractBuffer', () => {
      it('should extract the buffer from a SharedObject', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        const buffer = TestSharedObject.extractBuffer(sharedObject);
        expect(buffer).to.equal(struct.buffer);
      });
    });
  });

  describe('instance', () => {
    describe('constructor', () => {
      it('should create a new SharedObject instance', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        expect(sharedObject).to.be.instanceOf(TestSharedObject);
        expect(sharedObject).to.be.instanceOf(SharedObject);
      });

      it('should create a new SharedObject instance (extended)', () => {
        const struct = new ExtTestBufferStruct();
        const sharedObject = new ExtTestSharedObject(struct);
        expect(sharedObject).to.be.instanceOf(ExtTestSharedObject);
        expect(sharedObject).to.be.instanceOf(TestSharedObject);
        expect(sharedObject).to.be.instanceOf(SharedObject);
      });

      it('should create a new SharedObject instance with the correct values from BufferStruct (default values)', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        expect(sharedObject.numProp1).to.equal(0);
        expect(sharedObject.stringProp1).to.equal('');
        expect(sharedObject.numProp2).to.equal(0);
        expect(sharedObject.stringProp2).to.equal('');
      });

      it('should create a new SharedObject instance with the correct values from BufferStruct (extended, default values)', () => {
        const struct = new ExtTestBufferStruct();
        const sharedObject = new ExtTestSharedObject(struct);
        expect(sharedObject.numProp1).to.equal(0);
        expect(sharedObject.stringProp1).to.equal('');
        expect(sharedObject.numProp2).to.equal(0);
        expect(sharedObject.stringProp2).to.equal('');
        expect(sharedObject.extNumProp1).to.equal(0);
        expect(sharedObject.extStringProp1).to.equal('');
      });

      it('should create a new SharedObject instance with the correct values from BufferStruct (provided values)', () => {
        const struct = new TestBufferStruct();
        struct.numProp1 = 1;
        struct.stringProp1 = 'test';
        struct.numProp2 = 2;
        struct.stringProp2 = 'test2';
        const sharedObject = new TestSharedObject(struct);
        expect(sharedObject.numProp1).to.equal(1);
        expect(sharedObject.stringProp1).to.equal('test');
        expect(sharedObject.numProp2).to.equal(2);
        expect(sharedObject.stringProp2).to.equal('test2');
      });

      it('should create a new SharedObject instance with the correct values from BufferStruct (extended, provided values)', () => {
        const struct = new ExtTestBufferStruct();
        struct.numProp1 = 1;
        struct.stringProp1 = 'test';
        struct.numProp2 = 2;
        struct.stringProp2 = 'test2';
        struct.extNumProp1 = 3;
        struct.extStringProp1 = 'test3';
        const sharedObject = new ExtTestSharedObject(struct);
        expect(sharedObject.numProp1).to.equal(1);
        expect(sharedObject.stringProp1).to.equal('test');
        expect(sharedObject.numProp2).to.equal(2);
        expect(sharedObject.stringProp2).to.equal('test2');
        expect(sharedObject.extNumProp1).to.equal(3);
        expect(sharedObject.extStringProp1).to.equal('test3');
      });
    });

    describe('local setting/getting', () => {
      it('property updates should apply immediately / syncronously', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        sharedObject.numProp1 = 1;
        expect(sharedObject.numProp1).to.equal(1);
        sharedObject.stringProp1 = 'test';
        expect(sharedObject.stringProp1).to.equal('test');
        sharedObject.numProp2 = 2;
        expect(sharedObject.numProp2).to.equal(2);
        sharedObject.stringProp2 = 'test2';
        expect(sharedObject.stringProp2).to.equal('test2');
        sharedObject.destroy();
      });

      it('property updates should apply immediately / syncronously (extended)', () => {
        const struct = new ExtTestBufferStruct();
        const sharedObject = new ExtTestSharedObject(struct);
        sharedObject.numProp1 = 1;
        expect(sharedObject.numProp1).to.equal(1);
        sharedObject.stringProp1 = 'test';
        expect(sharedObject.stringProp1).to.equal('test');
        sharedObject.numProp2 = 2;
        expect(sharedObject.numProp2).to.equal(2);
        sharedObject.stringProp2 = 'test2';
        expect(sharedObject.stringProp2).to.equal('test2');
        sharedObject.extNumProp1 = 3;
        expect(sharedObject.extNumProp1).to.equal(3);
        sharedObject.extStringProp1 = 'test3';
        expect(sharedObject.extStringProp1).to.equal('test3');
        sharedObject.destroy();
      });
    });

    describe('remote setting/getting', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });
      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      it("local property updates should be shared with remote worker's SharedObject", async () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);

        await threadx.shareObjects('test-worker', [sharedObject]);

        // Update properties
        sharedObject.numProp1 = 123;
        sharedObject.stringProp1 = 'test';

        // Check that object was updated on the other side
        const result = await threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-check',
          objectId: sharedObject.id,
        });

        expect(result.objectKnownByThreadX).to.equal(true);
        expect(result.isInstanceOfTestSharedObject).to.equal(true);
        expect(result.properties).to.deep.equal({
          numProp1: 123,
          stringProp1: 'test',
          numProp2: 0,
          stringProp2: '',
        });
      });

      it('property updates from both sides should be synchronized', async () => {
        const sharedObject = new TestSharedObject(new TestBufferStruct());
        // We use the raceNotifyBuffer to synchronize the start of the test
        // We can't use the BufferStruct's notify/wait because when used in
        // a SharedObject, the BufferStruct's notify/wait will be used by the
        // SharedObject itself to synchronize the updates from both sides
        const raceNotifyBuffer = new SharedArrayBuffer(4);
        const raceNotify = new Int32Array(raceNotifyBuffer);

        // Set the initial property values
        sharedObject.numProp1 = 1;
        sharedObject.numProp2 = 1;
        sharedObject.stringProp1 = 'one';
        sharedObject.stringProp2 = 'one';

        // Share the object with the worker
        await threadx.shareObjects('test-worker', [sharedObject]);

        // Tell the worker to start the test
        // We'll wait on the promise at the end since it will provide us the
        // Worker side results
        const resultPromise = threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-synchronize-test',
          objectId: sharedObject.id,
          raceNotifyBuffer,
        });

        // Wait here until the worker notifies us that it is ready
        const waitVal = await Atomics.waitAsync(raceNotify, 0, 0).value;
        expect(waitVal).to.equal('ok');

        // The worker is ready now and waiting. Let's tell it to start right now
        Atomics.notify(raceNotify, 0);

        // Now both sides will update the properties as fast as possible
        // separating each update by a delay of 0ms which causes the event loop
        // to proceed and start the next iteration in a new Task. This allows
        // the updates to be transfered to the opposite side in the queued
        // microtask.
        let numWorkerSideUpdates = 0;
        let numWorkerUpdatesThatMatched = 0;
        const end = Date.now() + 1000;
        while (Date.now() < end) {
          // We only count the updates if they came from the opposite side
          // The worker updates with the values 2 and 'two',
          // while we update with the values 1 and 'one'
          if (sharedObject.numProp1 === 2) {
            numWorkerSideUpdates++;
            // We should never have a case where numProp1 does not equal
            // numProp2, or stringProp1 does not equal stringProp2
            // Otherwise the test should fail.
            if (
              sharedObject.numProp1 === sharedObject.numProp2 &&
              sharedObject.stringProp1 === sharedObject.stringProp2
            ) {
              numWorkerUpdatesThatMatched++;
            }
          }
          // Update the props with our sides values
          sharedObject.numProp1 = 1;
          sharedObject.numProp2 = 1;
          sharedObject.stringProp1 = 'one';
          sharedObject.stringProp2 = 'one';

          // Force the next iteration to start in a new Task allowing
          // this Task to end and the queued mutation microtask to run
          await delay(0);
        }

        // Retrieve results from the worker
        const result = await resultPromise;
        const numMainSideUpdates = result.numMainSideUpdates as number;
        const numMainUpdatesThatMatched =
          result.numMainUpdatesThatMatched as number;

        // We expect at least 10 updates from each side
        expect(numWorkerSideUpdates).to.be.greaterThan(10);
        expect(numMainSideUpdates).to.be.greaterThan(10);
        // If the updates match on both sides, then we are properly syncronizing
        // the updates
        expect(numWorkerSideUpdates).to.equal(numWorkerUpdatesThatMatched);
        expect(numMainSideUpdates).to.equal(numMainUpdatesThatMatched);
      });
    });

    describe('onPropertyChange()', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });
      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      it('should not be called locally when a property is updated only locally', async () => {
        const sharedObject = new TestSharedObject(new TestBufferStruct());
        const onPropertyChangeSpy = simpleSpy(sharedObject, 'onPropertyChange');

        // // Share the object with the worker
        // await threadx.shareObjects('test-worker', [sharedObject]);

        // Update properties
        sharedObject.numProp1 = 123;

        // Allow a frame to occur for mutations to be processed
        await delay(0);

        // Change another property and allow another frame to occur
        // Since this SharedObject exists only locally and there are no remote
        // workers using it, this could cause our onPropertyChange() to be
        // called if we don't properly check the notify value before processing
        // mutations from the SharedArrayBuffer
        sharedObject.numProp2 = 123;
        await delay(0);

        onPropertyChangeSpy.restore();
        expect(onPropertyChangeSpy.numCalls).to.equal(0);
      });

      it('should not be called locally when a property is updated only locally (extended)', async () => {
        const sharedObject = new ExtTestSharedObject(new ExtTestBufferStruct());
        const onPropertyChangeSpy = simpleSpy(sharedObject, 'onPropertyChange');

        // // Share the object with the worker
        // await threadx.shareObjects('test-worker', [sharedObject]);

        // Update properties
        sharedObject.extNumProp1 = 123;

        // Allow a frame to occur for mutations to be processed
        await delay(0);

        // Change another property and allow another frame to occur
        // Since this SharedObject exists only locally and there are no remote
        // workers using it, this could cause our onPropertyChange() to be
        // called if we don't properly check the notify value before processing
        // mutations from the SharedArrayBuffer
        sharedObject.extStringProp1 = 'test1';
        await delay(0);

        onPropertyChangeSpy.restore();
        expect(onPropertyChangeSpy.numCalls).to.equal(0);
      });

      it('should be called when a property is updated by either worker', async () => {
        const sharedObject = new TestSharedObject(new TestBufferStruct());

        // Share the object with the worker
        await threadx.shareObjects('test-worker', [sharedObject]);

        const resultPromise = threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-onPropertyUpdate-test',
          propName: 'numProp1',
          objectId: sharedObject.id,
          value: 222,
        });

        const onPropertyChangeSpy = simpleSpy(sharedObject, 'onPropertyChange');
        await onPropertyChangeSpy.untilCalledNTimes(1);
        onPropertyChangeSpy.restore();

        // Check that it was called locally when changed remotely
        expect(onPropertyChangeSpy.numCalls).to.equal(1);
        expect(onPropertyChangeSpy.lastArgs).to.deep.equal([
          'numProp1',
          222,
          0,
        ]);

        // Make a change locally
        sharedObject.numProp1 = 999;

        // Check that it was called remotely when changed locally
        expect(await resultPromise).deep.equal({
          noUnexpectedExtraCalls: true,
          numCalls: 1,
          lastArgs: ['numProp1', 999, 222],
        });
      });

      it('should be called when a property is updated by either worker (extended)', async () => {
        const sharedObject = new ExtTestSharedObject(new ExtTestBufferStruct());

        // Share the object with the worker
        await threadx.shareObjects('test-worker', [sharedObject]);

        const resultPromise = threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-onPropertyUpdate-test',
          propName: 'extNumProp1',
          objectId: sharedObject.id,
          value: 222,
        });

        const onPropertyChangeSpy = simpleSpy(sharedObject, 'onPropertyChange');
        await onPropertyChangeSpy.untilCalledNTimes(1);
        onPropertyChangeSpy.restore();

        // Check that it was called locally when changed remotely
        expect(onPropertyChangeSpy.numCalls).to.equal(1);
        expect(onPropertyChangeSpy.lastArgs).to.deep.equal([
          'extNumProp1',
          222,
          0,
        ]);

        // Make a change locally
        sharedObject.extNumProp1 = 999;

        // Check that it was called remotely when changed locally
        expect(await resultPromise).deep.equal({
          noUnexpectedExtraCalls: true,
          numCalls: 1,
          lastArgs: ['extNumProp1', 999, 222],
        });
      });

      it('should always eventually be called remotely on the last locally set value', async () => {
        // There's no way to guarantee that the remote worker will receive
        // each update as the synchronization system is only eventually consistent.
        // However, we can guarantee that the last value set locally will eventually
        // be received by the remote worker. This test verifies that.
        const sharedObject = new TestSharedObject(new TestBufferStruct());

        // Share the object with the worker
        await threadx.shareObjects('test-worker', [sharedObject]);

        const resultPromise = threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-onPropertyUpdate-test',
          propName: 'numProp1',
          objectId: sharedObject.id,
          value: undefined,
        });

        // Make multiple changes locally with a frame in between each
        // Remote worker is not making any updates
        sharedObject.numProp1 = 111;
        await delay(0);
        sharedObject.numProp1 = 222;
        await delay(0);
        sharedObject.numProp1 = 333;
        await delay(0);
        sharedObject.numProp1 = 444;
        await delay(0);
        sharedObject.numProp1 = 555;
        await delay(0);
        sharedObject.numProp1 = 666;
        await delay(0);
        sharedObject.numProp1 = 999;
        await delay(0);

        // Check that it was called remotely when changed locally
        const result = await resultPromise;
        // We expect no unexpected extra calls after the 999 condition is met
        expect(result.noUnexpectedExtraCalls).to.be.true;
        // We expect at least 2 calls, but we can't be sure exactly how many
        // there will be.
        expect(result.numCalls).to.be.greaterThan(1);
        // We expect the last onPropertyChange call to have a newValue of
        // 999
        expect(result.lastArgs[1], 'last newValue').to.equal(999);
      });
    });

    describe('remote events', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });
      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      it('should send/recieve events to/from remote worker', async () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);

        await threadx.shareObjects('test-worker', [sharedObject]);

        // Set up an event listener on the shared object
        const eventPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('event timeout'));
          }, 1000);
          sharedObject.once('test-event', (target, data) => {
            clearTimeout(timeout);
            resolve([target, data]);
          });
        });

        // Send message to test-worker to start the event tests
        const resultPromise = threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-event-test',
          objectId: sharedObject.id,
        });

        const eventFromWorker = (await eventPromise) as unknown[];

        // Check we received the event from the worker
        expect(eventFromWorker[0]).to.deep.equal(sharedObject);
        expect(eventFromWorker[1]).to.deep.equal({
          message: 'Hello from the worker.',
        });

        sharedObject.emit('test-event', {
          message: 'Hello from the main worker.',
        });

        // If the result from the message is true, then the event was received
        // by the worker and contained the expected data
        expect(await resultPromise).to.deep.equal({
          targetIsCorrect: true,
          eventData: {
            message: 'Hello from the main worker.',
          },
        });
      });

      it('if events are emitted before a SharedObject is confirmed to be shared, it should queue and send them as soon the share is confirmed', async function () {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);

        // Share but don't wait for the worker to receive the object
        threadx
          .shareObjects('test-worker', [sharedObject])
          .catch(console.error);

        // Emit an event that is handled only by the remote worker side of the
        // shared object
        sharedObject.emit('ping', {});

        const pongPromise = new Promise<boolean>((resolve) => {
          sharedObject.once('pong', () => {
            resolve(true);
          });
        });

        expect(await pongPromise).to.equal(true);
      });
    });

    describe('destroy', () => {
      it('should destroy the SharedObject instance during queued microtask', async () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        sharedObject.destroy();
        // Destruction should not occur immediately (its queued in a microtask)
        expect(sharedObject.isDestroyed).to.equal(false);
        // Allow destruction to occur in queued microtask
        await delay(0);
        expect(sharedObject.isDestroyed).to.equal(true);
      });

      it('should call onDestroy callback', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        const onDestroySpy = simpleSpy(sharedObject, 'exposedOnDestroy');
        sharedObject.destroy();
        onDestroySpy.restore();
        // Destruction should not occur immediately (its queued in a microtask)
        expect(onDestroySpy.numCalls).to.equal(1);
      });

      it('should emit "beforeDestroy" event syncronously', () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        let beforeDestroyCalled = false;
        sharedObject.once('beforeDestroy', () => {
          beforeDestroyCalled = true;
        });
        sharedObject.destroy();
        expect(beforeDestroyCalled).to.equal(true);
      });

      it('should emit "afterDestroy" event after this task', async () => {
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);
        let afterDestroyCalled = false;
        sharedObject.once('afterDestroy', () => {
          afterDestroyCalled = true;
        });
        sharedObject.destroy();
        expect(afterDestroyCalled).to.equal(false);
        // Allow destruction a chance to complete
        await delay(0);
        expect(afterDestroyCalled).to.equal(true);
      });

      it('should cause ThreadX to forget about the SharedObject on both paired workers', async () => {
        threadx.registerWorker('test-worker', new TestWorker());
        const struct = new TestBufferStruct();
        const sharedObject = new TestSharedObject(struct);

        // Share object
        await threadx.shareObjects('test-worker', [sharedObject]);

        // Destroy the object
        sharedObject.destroy();

        // Allow destruction to complete
        await delay(0);

        // Get SharedObject info from remote worker
        const result = await threadx.sendMessageAsync('test-worker', {
          type: 'shared-object-check',
          objectId: sharedObject.id,
        });

        // Check if the objeect is known by ThreadX locally
        expect(threadx.getSharedObjectById(sharedObject.id)).to.equal(null);

        // Check if the object is known by ThreadX on the remote worker
        expect(result.objectKnownByThreadX).to.equal(false);
        threadx.closeWorker('test-worker');
      });
    });
  });
});
