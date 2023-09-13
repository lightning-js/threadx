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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { BufferStruct, ThreadX } from '@lightningjs/threadx';
import { TestBufferStruct } from '../buffer-structs/TestBufferStruct.js';
import { TestSharedObject } from '../shared-objects/TestSharedObject.js';
import { simpleSpy, assertTruthy, delay } from '../test-utils.js';
import { ExtTestBufferStruct } from '../buffer-structs/ExtTestBufferStruct.js';
import { ExtTestSharedObject } from '../shared-objects/ExtTestSharedObject.js';

/**
 * Stash of sharedObjects so we can test that they are properly destroyed
 * when they are forgotten from the main worker
 *
 * This is a memory leak but we don't care because this worker is destroyed
 * after each test.
 */
const sharedObjectStash = new Map<number, TestSharedObject>();

const threadX = ThreadX.init({
  workerId: 2,
  workerName: 'test-worker',
  sharedObjectFactory(buffer) {
    const typeId = BufferStruct.extractTypeId(buffer);
    if (typeId === TestBufferStruct.typeId) {
      return new TestSharedObject(new TestBufferStruct(buffer), true);
    } else if (typeId === ExtTestBufferStruct.typeId) {
      return new ExtTestSharedObject(new ExtTestBufferStruct(buffer), true);
    }
    return null;
  },
  async onMessage(message) {
    if (message.type === 'ping') {
      return 'pong';
    } else if (message.type === 'ding') {
      threadX.sendMessage('parent', {
        type: 'dong',
      });
    } else if (message.type === 'block') {
      const duration = message.duration || 0;
      // Block for N seconds
      const start = Date.now();
      while (Date.now() - start < duration) {
        // Do nothing
      }
    } else if (message.type === 'fight-for-lock') {
      const bufferStruct = new TestBufferStruct(message.buffer);
      // Tell the parent worker that we're ready to start fightning for the
      // lock
      bufferStruct.notify(1);
      // Wait, synchronously, for the parent to let us know to start
      bufferStruct.wait(1);
      // Fight!
      const end = Date.now() + 1000;
      while (Date.now() < end) {
        bufferStruct.lock(() => {
          bufferStruct.numProp1++;
          bufferStruct.numProp2 = bufferStruct.numProp1;
          bufferStruct.stringProp1 = `${Math.random()}`;
          bufferStruct.stringProp2 = bufferStruct.stringProp1;
        });
      }
    } else if (message.type === 'hold-lock-until-notify') {
      const bufferStruct = new TestBufferStruct(message.buffer);

      await bufferStruct.lockAsync(async () => {
        bufferStruct.notify(1);
        await bufferStruct.waitAsync(1);
      });
    } else if (message.type === 'notify-wait') {
      const bufferStruct = new TestBufferStruct(message.buffer);
      bufferStruct.notify(1);
      const waitVal = bufferStruct.wait(
        message.expectedValue ?? 1,
        message.timeout || undefined,
      );
      return waitVal;
    } else if (message.type === 'shared-object-check') {
      const objectId = message.objectId as number;
      const sharedObject = threadX.getSharedObjectById(objectId);
      const sharedObjectFromStash = sharedObjectStash.get(objectId);
      if (!sharedObject) {
        return {
          objectKnownByThreadX: false,
          stashedObjectExists: !!sharedObjectFromStash,
          stashedObjectIsDestroyed: !!sharedObjectFromStash?.isDestroyed,
        };
      }
      if (!(sharedObject instanceof TestSharedObject)) {
        return {
          objectKnownByThreadX: true,
          isInstanceOfTestSharedObject: false,
        };
      }
      sharedObjectStash.set(objectId, sharedObject);
      return {
        objectKnownByThreadX: true,
        isInstanceOfTestSharedObject: true,
        properties: {
          numProp1: sharedObject.numProp1,
          stringProp1: sharedObject.stringProp1,
          numProp2: sharedObject.numProp2,
          stringProp2: sharedObject.stringProp2,
        },
      };
    } else if (message.type === 'shared-object-synchronize-test') {
      const objectId = message.objectId as number;
      const raceNotifyBuffer = message.raceNotifyBuffer as SharedArrayBuffer;
      const raceNotify = new Int32Array(raceNotifyBuffer);
      const sharedObject = threadX.getSharedObjectById(objectId);
      assertTruthy(sharedObject instanceof TestSharedObject);
      // Tell the parent worker that we're ready to start fightning for the
      // lock
      Atomics.store(raceNotify, 0, 1);
      Atomics.notify(raceNotify, 0);
      // Wait, synchronously, for the parent to let us know to start
      Atomics.wait(raceNotify, 0, 1);
      // Fight!
      let numMainSideUpdates = 0;
      let numMainUpdatesThatMatched = 0;
      const end = Date.now() + 1000;
      while (Date.now() < end) {
        if (sharedObject.numProp1 === 1) {
          numMainSideUpdates++;
          if (
            sharedObject.numProp1 === sharedObject.numProp2 &&
            sharedObject.stringProp1 === sharedObject.stringProp2
          ) {
            numMainUpdatesThatMatched++;
          }
        }
        sharedObject.numProp1 = 2;
        sharedObject.numProp2 = 2;
        sharedObject.stringProp1 = 'two';
        sharedObject.stringProp2 = 'two';
        await delay(0);
      }
      return {
        numMainSideUpdates,
        numMainUpdatesThatMatched,
      };
    } else if (message.type === 'shared-object-event-test') {
      const objectId = message.objectId as number;
      const sharedObject = threadX.getSharedObjectById(objectId);
      assertTruthy(sharedObject instanceof TestSharedObject);
      sharedObject.emit('test-event', {
        message: 'Hello from the worker.',
      });
      const eventPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('event timeout'));
        }, 1000);
        sharedObject.once('test-event', (target, data) => {
          clearTimeout(timeout);
          resolve([target, data]);
        });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventFromMain = (await eventPromise) as any[];
      return {
        targetIsCorrect: eventFromMain[0] === sharedObject,
        eventData: eventFromMain[1],
      };
    } else if (message.type === 'shared-object-onPropertyUpdate-test') {
      const objectId = message.objectId as number;
      const value = message.value as number;
      const sharedObject = threadX.getSharedObjectById(objectId);
      assertTruthy(sharedObject instanceof TestSharedObject);
      const propName = message.propName as Exclude<
        keyof typeof sharedObject,
        'id' | 'isDestroyed' | 'typeId'
      >;

      if (value !== undefined) {
        sharedObject[propName] = value as never;
      }
      const onPropertyChangeSpy = simpleSpy(sharedObject, 'onPropertyChange');
      // Wait until the `propName` property is set to 999
      // With a timeout of 1 second
      await Promise.race([
        onPropertyChangeSpy
          .untilCondition((result, pName, newValue) => {
            return pName === propName && newValue === 999;
          })
          .then(() => true),
        delay(1000).then(() => {
          throw new Error('Timeout waiting for property change');
        }),
      ]);
      const numCalls = onPropertyChangeSpy.numCalls;
      // Wait a few frames to make sure no other onPropertyChange updates come after
      await delay(0);
      await delay(0);
      await delay(0);
      onPropertyChangeSpy.restore();

      return {
        noUnexpectedExtraCalls: onPropertyChangeSpy.numCalls === numCalls,
        numCalls: onPropertyChangeSpy.numCalls,
        lastArgs: onPropertyChangeSpy.lastArgs,
      };
    }
  },
});
