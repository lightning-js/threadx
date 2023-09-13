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

import { expect } from 'chai';
import { ThreadX } from '@lightningjs/threadx';
import TestWorker from './workers/TestWorker.js?worker';
import DelayedTestWorker from './workers/DelayedTestWorker.js?worker';
import { delay, simpleSpy } from './test-utils.js';
import { TestBufferStruct } from './buffer-structs/TestBufferStruct.js';
import { TestSharedObject } from './shared-objects/TestSharedObject.js';

describe('ThreadX', function () {
  describe('static', () => {
    describe('(initial state)', () => {
      it('should throw when trying to access instance/workerId/workerName before initialization', () => {
        expect(() => {
          ThreadX.instance;
        }).to.throw('ThreadX not initialized');
        expect(() => {
          ThreadX.workerId;
        }).to.throw('ThreadX not initialized');
        expect(() => {
          ThreadX.workerName;
        }).to.throw('ThreadX not initialized');
      });
    });

    describe('init', () => {
      it('should be able to initialize a new ThreadX instance', () => {
        const threadX = ThreadX.init({
          workerId: 1,
          workerName: 'main',
        });
        expect(threadX).to.be.instanceOf(ThreadX);
        ThreadX.destroy();
      });

      it('should should allow getting "instance", "workerId" and "workerName" directly', () => {
        const threadX = ThreadX.init({
          workerId: 1,
          workerName: 'main',
        });
        expect(ThreadX.instance).to.equal(threadX);
        expect(ThreadX.workerId).to.equal(1);
        expect(ThreadX.workerName).to.equal('main');
        ThreadX.destroy();
      });

      it('should throw if attemping to initialize a second ThreadX instance', () => {
        ThreadX.init({
          workerId: 1,
          workerName: 'main',
        });
        expect(() => {
          ThreadX.init({
            workerId: 3,
            workerName: 'something',
          });
        }).to.throw('ThreadX already initialized');
        ThreadX.destroy();
      });
    });

    describe('destroy', () => {
      it('should be able to destroy the existing ThreadX instance', () => {
        ThreadX.init({
          workerId: 1,
          workerName: 'main',
        });
        ThreadX.destroy();
        expect(() => {
          ThreadX.instance;
        }).to.throw('ThreadX not initialized');
        expect(() => {
          ThreadX.workerId;
        }).to.throw('ThreadX not initialized');
        expect(() => {
          ThreadX.workerName;
        }).to.throw('ThreadX not initialized');
      });

      it('should log a warning if trying to destroy a non-existing ThreadX instance', () => {
        const consoleSpy = simpleSpy(console, 'warn');
        ThreadX.destroy();
        consoleSpy.restore();
        expect(consoleSpy.numCalls).to.equal(1);
        expect(consoleSpy.lastArgs?.[0]).to.equal(
          'ThreadX.destroy(): ThreadX is not initialized.',
        );
      });
    });
  });

  describe('instance', () => {
    let onMessageHandler: ((message: any) => Promise<any>) | null = null;
    let threadx: ThreadX;

    beforeEach(() => {
      threadx = ThreadX.init({
        workerId: 1,
        workerName: 'main',
        async onMessage(message) {
          if (onMessageHandler) {
            return onMessageHandler(message);
          }
        },
      });
    });

    afterEach(() => {
      onMessageHandler = null;
      ThreadX.destroy();
    });

    describe('worker creation/termination', () => {
      describe('registerWorker', () => {
        it('should be able to register a worker', async () => {
          threadx.registerWorker('test-worker', new TestWorker());
          // Check and make sure worker is alive
          const response = (await threadx.sendMessageAsync('test-worker', {
            type: 'ping',
          })) as string;
          expect(response).to.equal('pong');
          await threadx.closeWorkerAsync('test-worker');
        });
      });

      describe('closeWorker', () => {
        it('should call closeWorkerAsync and simply rely on its functionality', async () => {
          const ret = threadx.registerWorker('test-worker', new TestWorker());
          const spy = simpleSpy(threadx, 'closeWorkerAsync');
          threadx.closeWorker('test-worker');
          spy.restore();
          expect(spy.numCalls).to.equal(1);
          expect(spy.lastArgs?.[0]).to.equal('test-worker');
          expect(await spy.lastResult).to.equal('graceful');
          expect(ret).to.equal(undefined);
        });
      });

      describe('closeWorkerAsync', () => {
        it('should close worker gracefully', async () => {
          threadx.registerWorker('test-worker', new TestWorker());
          // Check and make sure worker is alive
          const response = (await threadx.sendMessageAsync('test-worker', {
            type: 'ping',
          })) as string;
          expect(response).to.equal('pong');
          expect(await threadx.closeWorkerAsync('test-worker')).to.equal(
            'graceful',
          );
        });
        it('should force terminate worker (if worker never responds to "close" message within timeout)', async () => {
          threadx.registerWorker('test-worker', new TestWorker());
          // Cause worker to block so it won't be able to respond to "close" message
          threadx.sendMessage('test-worker', { type: 'block', duration: 1000 });
          // Try closing the worker
          const consoleSpy = simpleSpy(console, 'warn');
          const result = await threadx.closeWorkerAsync('test-worker', 100);
          consoleSpy.restore();
          expect(result).to.equal('forced');
          expect(consoleSpy.numCalls).to.equal(1);
          expect(consoleSpy.lastArgs?.[0]).to.equal(
            'threadX.closeWorkerAsync(): Worker "test-worker" did not respond to "close" message within 100ms. Forcing termination.',
          );
        });
      });
    });

    describe('worker interactions', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });

      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      describe('sendMessageAsync', () => {
        it('should be able to send a message and receive a response', async () => {
          const response = (await threadx.sendMessageAsync('test-worker', {
            type: 'ping',
          })) as string;
          expect(response).to.equal('pong');
        });

        it('should wait until worker is ready to receive messages before sending', async () => {
          threadx.registerWorker(
            'delayed-test-worker',
            new DelayedTestWorker(),
          );

          const response = (await threadx.sendMessageAsync(
            'delayed-test-worker',
            {
              type: 'ping',
            },
          )) as string;
          threadx.closeWorker('delayed-test-worker');
          expect(response).to.equal('pong');
        });
      });

      describe('sendMessage', () => {
        it('should be able to send a message', async () => {
          // sendMessage itself doesn't return a promise with a pending
          // response, so to _know_ that the message got sent, we issue the
          // 'ding' message to the TestWorker which in turn fires a 'dong'
          // message back to this worker using `sendMessage`.
          const dongPromise = new Promise((resolve) => {
            onMessageHandler = async (message) => {
              if (message.type === 'dong') {
                resolve(true);
              }
            };
          });
          threadx.sendMessage('test-worker', { type: 'ding' });
          expect(await dongPromise).to.equal(true);
        });

        it('should wait until worker is ready to receive messages before sending', async () => {
          threadx.registerWorker(
            'delayed-test-worker',
            new DelayedTestWorker(),
          );
          const dongPromise = new Promise((resolve) => {
            onMessageHandler = async (message) => {
              if (message.type === 'dong') {
                resolve(true);
              }
            };
          });
          threadx.sendMessage('delayed-test-worker', { type: 'ding' });
          const result = await dongPromise;
          threadx.closeWorker('delayed-test-worker');
          expect(result).to.equal(true);
        });
      });

      describe('shareObjects', () => {
        it('should share objects with worker and known by ThreadX on both sides', async () => {
          const sharedObject1 = new TestSharedObject(new TestBufferStruct());
          const sharedObject2 = new TestSharedObject(new TestBufferStruct());

          await threadx.shareObjects('test-worker', [
            sharedObject1,
            sharedObject2,
          ]);

          // Check that object exists on the other size
          const result1 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject1.id,
          });
          const result2 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject2.id,
          });
          sharedObject1.destroy();
          sharedObject2.destroy();

          // Check if ThreadX knows about the shared objects locally
          expect(threadx.getSharedObjectById(sharedObject1.id)).to.equal(
            sharedObject1,
          );
          expect(threadx.getSharedObjectById(sharedObject2.id)).to.equal(
            sharedObject2,
          );

          // Check if ThreadX knows about the shared objects on the remote worker
          // and that their instance type and properties are correct
          expect(result1.objectKnownByThreadX).to.equal(true);
          expect(result1.isInstanceOfTestSharedObject).to.equal(true);
          expect(result1.properties).to.deep.equal({
            numProp1: 0,
            stringProp1: '',
            numProp2: 0,
            stringProp2: '',
          });
          expect(result2.objectKnownByThreadX).to.equal(true);
          expect(result2.isInstanceOfTestSharedObject).to.equal(true);
          expect(result2.properties).to.deep.equal({
            numProp1: 0,
            stringProp1: '',
            numProp2: 0,
            stringProp2: '',
          });
        });
      });

      describe('forgetObjects', () => {
        it('should cause objects to be forgotten by ThreadX on remote worker and locally', async () => {
          const sharedObject1 = new TestSharedObject(new TestBufferStruct());
          const sharedObject2 = new TestSharedObject(new TestBufferStruct());

          await threadx.shareObjects('test-worker', [
            sharedObject1,
            sharedObject2,
          ]);
          await threadx.forgetObjects([sharedObject1, sharedObject2]);

          // Check that object exists on the other size
          const result1 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject1.id,
          });
          const result2 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject2.id,
          });

          // Check if ThreadX knows about the shared objects locally
          expect(threadx.getSharedObjectById(sharedObject1.id)).to.equal(null);
          expect(threadx.getSharedObjectById(sharedObject2.id)).to.equal(null);

          // Check if ThreadX knows about the shared objects on the remote worker
          expect(result1.objectKnownByThreadX).to.equal(false);
          expect(result2.objectKnownByThreadX).to.equal(false);

          sharedObject1.destroy();
          sharedObject2.destroy();
        });

        it('should NOT cause objects to be destroyed locally', async () => {
          const sharedObject1 = new TestSharedObject(new TestBufferStruct());
          const sharedObject2 = new TestSharedObject(new TestBufferStruct());

          await threadx.shareObjects('test-worker', [
            sharedObject1,
            sharedObject2,
          ]);
          await threadx.forgetObjects([sharedObject1, sharedObject2]);

          // Await a tick to ensure that the shared objects are not destroyed
          await delay(0);

          expect(sharedObject1.isDestroyed).to.equal(false);
          expect(sharedObject2.isDestroyed).to.equal(false);
          sharedObject1.destroy();
          sharedObject2.destroy();
        });

        it('should cause objects to be destroyed on remote worker', async () => {
          const sharedObject1 = new TestSharedObject(new TestBufferStruct());
          const sharedObject2 = new TestSharedObject(new TestBufferStruct());

          // Share 'em
          await threadx.shareObjects('test-worker', [
            sharedObject1,
            sharedObject2,
          ]);

          // Cause SharedObject to be stashed on the remote side
          // so we can check later if it was destroyed by forgetObjects
          await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject1.id,
          });
          await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject2.id,
          });

          // Forget 'em
          await threadx.forgetObjects([sharedObject1, sharedObject2]);

          const result1 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject1.id,
          });
          const result2 = await threadx.sendMessageAsync('test-worker', {
            type: 'shared-object-check',
            objectId: sharedObject2.id,
          });

          // Destroy 'em (locally)
          sharedObject1.destroy();
          sharedObject2.destroy();

          expect(result1.objectKnownByThreadX).to.equal(false);
          expect(result1.stashedObjectExists).to.equal(true);
          expect(result1.stashedObjectIsDestroyed).to.equal(true);
          expect(result2.objectKnownByThreadX).to.equal(false);
          expect(result2.stashedObjectExists).to.equal(true);
          expect(result2.stashedObjectIsDestroyed).to.equal(true);
        });
      });
    });
  });
});
