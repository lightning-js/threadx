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

import { ThreadX, BufferStruct, genTypeId } from '@lightningjs/threadx';
import TestWorker from './workers/TestWorker.js?worker';
import { expect } from 'chai';
import { generateRandomSAB } from './test-utils.js';
import { TestBufferStruct } from './buffer-structs/TestBufferStruct.js';
import { ExtTestBufferStruct } from './buffer-structs/ExtTestBufferStruct.js';

describe('BufferStruct', function () {
  describe('static', () => {
    it('base initial state', () => {
      expect(BufferStruct.staticInitialized).to.equal(false);
      expect(BufferStruct.size).to.equal(40);
      expect(BufferStruct.typeId).to.equal(0);
      expect(BufferStruct.typeIdStr).to.equal('');
      expect(BufferStruct.propDefs).to.deep.equal([]);
    });

    it('sub-class initial state', () => {
      expect(TestBufferStruct.staticInitialized).to.equal(true);
      expect(TestBufferStruct.size).to.equal(1092);
      expect(TestBufferStruct.typeId).to.equal(genTypeId('TEST'));
      expect(TestBufferStruct.typeIdStr).to.equal('TEST');
      expect(TestBufferStruct.propDefs).to.deep.equal([
        {
          propNum: 0,
          name: 'numProp1',
          type: 'number',
          byteOffset: 40,
          offset: 5,
          byteSize: 8,
          allowUndefined: false,
        },
        {
          propNum: 1,
          name: 'stringProp1',
          type: 'string',
          byteOffset: 48,
          offset: 24,
          byteSize: 512,
          allowUndefined: false,
        },
        {
          propNum: 2,
          name: 'booleanProp1',
          type: 'boolean',
          byteOffset: 560,
          offset: 140,
          byteSize: 4,
          allowUndefined: false,
        },
        {
          propNum: 3,
          name: 'numProp2',
          type: 'number',
          byteOffset: 568,
          offset: 71,
          byteSize: 8,
          allowUndefined: true,
        },
        {
          propNum: 4,
          name: 'stringProp2',
          type: 'string',
          byteOffset: 576,
          offset: 288,
          byteSize: 512,
          allowUndefined: true,
        },
        {
          propNum: 5,
          name: 'booleanProp2',
          type: 'boolean',
          byteOffset: 1088,
          offset: 272,
          byteSize: 4,
          allowUndefined: true,
        },
      ]);
    });

    it('extended sub-class initial state', () => {
      expect(ExtTestBufferStruct.staticInitialized).to.equal(true);
      expect(ExtTestBufferStruct.size).to.equal(1620);
      expect(ExtTestBufferStruct.typeId).to.equal(genTypeId('EXTT'));
      expect(ExtTestBufferStruct.typeIdStr).to.equal('EXTT');
      expect(ExtTestBufferStruct.propDefs).to.deep.equal([
        {
          propNum: 0,
          name: 'numProp1',
          type: 'number',
          byteOffset: 40,
          offset: 5,
          byteSize: 8,
          allowUndefined: false,
        },
        {
          propNum: 1,
          name: 'stringProp1',
          type: 'string',
          byteOffset: 48,
          offset: 24,
          byteSize: 512,
          allowUndefined: false,
        },
        {
          propNum: 2,
          name: 'booleanProp1',
          type: 'boolean',
          byteOffset: 560,
          offset: 140,
          byteSize: 4,
          allowUndefined: false,
        },
        {
          propNum: 3,
          name: 'numProp2',
          type: 'number',
          byteOffset: 568,
          offset: 71,
          byteSize: 8,
          allowUndefined: true,
        },
        {
          propNum: 4,
          name: 'stringProp2',
          type: 'string',
          byteOffset: 576,
          offset: 288,
          byteSize: 512,
          allowUndefined: true,
        },
        {
          propNum: 5,
          name: 'booleanProp2',
          type: 'boolean',
          byteOffset: 1088,
          offset: 272,
          byteSize: 4,
          allowUndefined: true,
        },
        {
          propNum: 6,
          name: 'extBooleanProp1',
          type: 'boolean',
          byteOffset: 1092,
          offset: 273,
          byteSize: 4,
          allowUndefined: true,
        },
        {
          propNum: 7,
          name: 'extNumProp1',
          type: 'number',
          byteOffset: 1096,
          offset: 137,
          byteSize: 8,
          allowUndefined: false,
        },
        {
          propNum: 8,
          name: 'extStringProp1',
          type: 'string',
          byteOffset: 1104,
          offset: 552,
          byteSize: 512,
          allowUndefined: false,
        },
        {
          propNum: 9,
          name: 'extBooleanProp2',
          type: 'boolean',
          byteOffset: 1616,
          offset: 404,
          byteSize: 4,
          allowUndefined: true,
        },
      ]);
    });

    describe('extractTypeId', () => {
      it('extractTypeId should extract the typeId from a valid buffer', () => {
        ThreadX.init({
          workerId: 1,
          workerName: 'main',
        });
        const bufferStruct = new TestBufferStruct();
        expect(BufferStruct.extractTypeId(bufferStruct.buffer)).to.equal(
          TestBufferStruct.typeId,
        );
        ThreadX.destroy();
      });

      it('extractTypeId should return 0 if buffer is less than size of BufferStruct header', () => {
        const buffer = generateRandomSAB(BufferStruct.size - 8);
        const typeId = BufferStruct.extractTypeId(buffer);
        expect(typeId).to.equal(0);
      });

      it('extractTypeId should return 0 if size of buffer is not aligned to 64-bits', () => {
        const buffer = generateRandomSAB(BufferStruct.size + 1);
        const typeId = BufferStruct.extractTypeId(buffer);
        expect(typeId).to.equal(0);
      });
    });
  });

  describe('instance', () => {
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

    describe('constructor', () => {
      it('should create a BufferStruct instance', () => {
        const bufferStruct = new TestBufferStruct();
        expect(bufferStruct).to.be.instanceOf(BufferStruct);
        expect(bufferStruct.typeId).to.equal(TestBufferStruct.typeId);
      });

      it('should create a BufferStruct instance (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        expect(bufferStruct).to.be.instanceOf(TestBufferStruct);
        expect(bufferStruct).to.be.instanceOf(BufferStruct);
        expect(bufferStruct.typeId).to.equal(ExtTestBufferStruct.typeId);
      });

      it('should create and use a new SharedArrayBuffer of the proper size if not passed in', () => {
        const bufferStruct = new TestBufferStruct();
        expect(bufferStruct.buffer).to.be.instanceOf(SharedArrayBuffer);
        expect(bufferStruct.buffer.byteLength).to.equal(
          Math.ceil(TestBufferStruct.size / 8) * 8,
        );
      });

      it('should create and use a new SharedArrayBuffer of the proper size if not passed in (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        expect(bufferStruct.buffer).to.be.instanceOf(SharedArrayBuffer);
        expect(bufferStruct.buffer.byteLength).to.equal(
          Math.ceil(ExtTestBufferStruct.size / 8) * 8,
        );
      });

      it('should create instance with default empty values', () => {
        const bufferStruct = new TestBufferStruct();
        // Number
        expect(bufferStruct.numProp1).to.equal(0);
        expect(bufferStruct.numProp2).to.equal(undefined);
        // String
        expect(bufferStruct.stringProp1).to.equal('');
        expect(bufferStruct.stringProp2).to.equal(undefined);
        // Boolean
        expect(bufferStruct.booleanProp1).to.equal(false);
        expect(bufferStruct.booleanProp2).to.equal(undefined);
      });

      it('should create instance with default empty values (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Number
        expect(bufferStruct.numProp1).to.equal(0);
        expect(bufferStruct.numProp2).to.equal(undefined);
        expect(bufferStruct.extNumProp1).to.equal(0);
        // String
        expect(bufferStruct.stringProp1).to.equal('');
        expect(bufferStruct.stringProp2).to.equal(undefined);
        expect(bufferStruct.extStringProp1).to.equal('');
        // Boolean
        expect(bufferStruct.booleanProp1).to.equal(false);
        expect(bufferStruct.booleanProp2).to.equal(undefined);
        expect(bufferStruct.extBooleanProp1).to.equal(undefined);
      });

      it('should construct instance with a cross-worker unique id', () => {
        const bufferStruct = new TestBufferStruct();
        // Should be the last unique id generated by ThreadX
        expect(bufferStruct.id).to.equal(
          ThreadX.instance.generateUniqueId() - 1,
        );
      });

      it('should accept an existing SharedArrayBuffer as a parameter and expose identical values', () => {
        const bufferStruct = new TestBufferStruct();
        bufferStruct.numProp1 = 123;
        bufferStruct.numProp2 = 456;
        bufferStruct.stringProp1 = 'abc';
        bufferStruct.stringProp2 = 'def';

        const bufferStruct2 = new TestBufferStruct(bufferStruct.buffer);
        expect(bufferStruct2.buffer).to.equal(bufferStruct.buffer);
        expect(bufferStruct2.typeId).to.equal(TestBufferStruct.typeId);
        expect(bufferStruct2.id).to.equal(bufferStruct.id);
        expect(bufferStruct2.notifyValue).to.equal(bufferStruct.notifyValue);
        expect(bufferStruct2.isDirty()).to.equal(bufferStruct.isDirty());
        expect(bufferStruct2.numProp1).to.equal(123);
        expect(bufferStruct2.numProp2).to.equal(456);
        expect(bufferStruct2.stringProp1).to.equal('abc');
        expect(bufferStruct2.stringProp2).to.equal('def');
      });

      it('should accept an existing SharedArrayBuffer as a parameter and expose identical values (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        bufferStruct.numProp1 = 123;
        bufferStruct.numProp2 = 456;
        bufferStruct.extNumProp1 = 789;
        bufferStruct.stringProp1 = 'abc';
        bufferStruct.stringProp2 = 'def';
        bufferStruct.extStringProp1 = 'ghi';

        const bufferStruct2 = new ExtTestBufferStruct(bufferStruct.buffer);
        expect(bufferStruct2.buffer).to.equal(bufferStruct.buffer);
        expect(bufferStruct2.typeId).to.equal(ExtTestBufferStruct.typeId);
        expect(bufferStruct2.id).to.equal(bufferStruct.id);
        expect(bufferStruct2.notifyValue).to.equal(bufferStruct.notifyValue);
        expect(bufferStruct2.isDirty()).to.equal(bufferStruct.isDirty());
        expect(bufferStruct2.numProp1).to.equal(123);
        expect(bufferStruct2.numProp2).to.equal(456);
        expect(bufferStruct2.extNumProp1).to.equal(789);
        expect(bufferStruct2.stringProp1).to.equal('abc');
        expect(bufferStruct2.stringProp2).to.equal('def');
        expect(bufferStruct2.extStringProp1).to.equal('ghi');
      });
    });

    describe('allowUndefined properties', () => {
      it('should be initialized to undefined', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Number
        expect(bufferStruct.numProp2).to.equal(undefined);
        // String
        expect(bufferStruct.stringProp2).to.equal(undefined);
        // Boolean
        expect(bufferStruct.booleanProp2).to.equal(undefined);
        expect(bufferStruct.extBooleanProp1).to.equal(undefined);
      });

      it('should set to defined values, then to undefined values and then back', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Set to defined
        // Number
        bufferStruct.numProp2 = 0;
        expect(bufferStruct.numProp2).to.equal(0);
        // String
        bufferStruct.stringProp2 = '';
        expect(bufferStruct.stringProp2).to.equal('');
        // Boolean
        bufferStruct.booleanProp2 = false;
        expect(bufferStruct.booleanProp2).to.equal(false);

        // Set to undefined
        // Number
        bufferStruct.numProp2 = undefined;
        expect(bufferStruct.numProp2).to.equal(undefined);
        // String
        bufferStruct.stringProp2 = undefined;
        expect(bufferStruct.stringProp2).to.equal(undefined);
        // Boolean
        bufferStruct.booleanProp2 = undefined;
        expect(bufferStruct.booleanProp2).to.equal(undefined);

        // Set back to defined
        // Number
        bufferStruct.numProp2 = 123;
        expect(bufferStruct.numProp2).to.equal(123);
        // String
        bufferStruct.stringProp2 = 'abc';
        expect(bufferStruct.stringProp2).to.equal('abc');
        // Boolean
        bufferStruct.booleanProp2 = true;
        expect(bufferStruct.booleanProp2).to.equal(true);
      });

      it('should be able to be rehydrated from ArrayBuffer', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Set to defined
        bufferStruct.numProp2 = 123;
        bufferStruct.stringProp2 = 'abc';
        bufferStruct.booleanProp2 = true;
        bufferStruct.numProp2 = undefined;
        bufferStruct.stringProp2 = undefined;
        bufferStruct.booleanProp2 = undefined;

        const bufferStruct2 = new ExtTestBufferStruct(bufferStruct.buffer);
        expect(bufferStruct2.numProp2).to.equal(undefined);
        expect(bufferStruct2.stringProp2).to.equal(undefined);
        expect(bufferStruct2.booleanProp2).to.equal(undefined);
      });
    });

    describe('properties', () => {
      it('should set and get values number properties', () => {
        const bufferStruct = new TestBufferStruct();
        // Number
        bufferStruct.numProp1 = 123;
        bufferStruct.numProp2 = 456;
        expect(bufferStruct.numProp1).to.equal(123);
        expect(bufferStruct.numProp2).to.equal(456);
        bufferStruct.numProp1 = 0;
        bufferStruct.numProp2 = 0;
        expect(bufferStruct.numProp1).to.equal(0);
        expect(bufferStruct.numProp2).to.equal(0);
      });

      it('should set and get values number properties (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Number
        bufferStruct.numProp1 = 123;
        bufferStruct.numProp2 = 456;
        bufferStruct.extNumProp1 = 789;
        expect(bufferStruct.numProp1).to.equal(123);
        expect(bufferStruct.numProp2).to.equal(456);
        expect(bufferStruct.extNumProp1).to.equal(789);
        bufferStruct.numProp1 = 0;
        bufferStruct.numProp2 = 0;
        bufferStruct.extNumProp1 = 0;
        expect(bufferStruct.numProp1).to.equal(0);
        expect(bufferStruct.numProp2).to.equal(0);
        expect(bufferStruct.extNumProp1).to.equal(0);
      });

      it('should set and get values boolean properties', () => {
        const bufferStruct = new TestBufferStruct();
        // Boolean
        bufferStruct.booleanProp1 = true;
        bufferStruct.booleanProp2 = false;
        expect(bufferStruct.booleanProp1).to.equal(true);
        expect(bufferStruct.booleanProp2).to.equal(false);
        bufferStruct.booleanProp1 = false;
        bufferStruct.booleanProp2 = true;
        expect(bufferStruct.booleanProp1).to.equal(false);
        expect(bufferStruct.booleanProp2).to.equal(true);
      });

      it('should set and get values boolean properties (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // Boolean
        bufferStruct.booleanProp1 = false;
        bufferStruct.booleanProp2 = true;
        bufferStruct.extBooleanProp1 = false;
        expect(bufferStruct.booleanProp1).to.equal(false);
        expect(bufferStruct.booleanProp2).to.equal(true);
        expect(bufferStruct.extBooleanProp1).to.equal(false);
        bufferStruct.booleanProp1 = true;
        bufferStruct.booleanProp2 = false;
        bufferStruct.extBooleanProp1 = true;
        expect(bufferStruct.booleanProp1).to.equal(true);
        expect(bufferStruct.booleanProp2).to.equal(false);
        expect(bufferStruct.extBooleanProp1).to.equal(true);
      });

      it('should set and get values string properties', () => {
        const bufferStruct = new TestBufferStruct();
        // String
        bufferStruct.stringProp1 = 'abc';
        bufferStruct.stringProp2 = 'def';
        expect(bufferStruct.stringProp1).to.equal('abc');
        expect(bufferStruct.stringProp2).to.equal('def');
        bufferStruct.stringProp1 = '';
        bufferStruct.stringProp2 = '';
        expect(bufferStruct.stringProp1).to.equal('');
        expect(bufferStruct.stringProp2).to.equal('');
      });

      it('should set and get values string properties (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        // String
        bufferStruct.stringProp1 = 'abc';
        bufferStruct.stringProp2 = 'def';
        bufferStruct.extStringProp1 = 'ghi';
        expect(bufferStruct.stringProp1).to.equal('abc');
        expect(bufferStruct.stringProp2).to.equal('def');
        expect(bufferStruct.extStringProp1).to.equal('ghi');
        bufferStruct.stringProp1 = '';
        bufferStruct.stringProp2 = '';
        bufferStruct.extStringProp1 = '';
        expect(bufferStruct.stringProp1).to.equal('');
        expect(bufferStruct.stringProp2).to.equal('');
        expect(bufferStruct.extStringProp1).to.equal('');
      });

      it('string properties should support up to 255 char codes', () => {
        const bufferStruct = new TestBufferStruct();
        const maxString = 'a'.repeat(255);
        // String
        bufferStruct.stringProp1 = maxString;
        expect(bufferStruct.stringProp1).to.equal(maxString);
      });

      it('string properties should truncate when exceeding 255 char codes', () => {
        const bufferStruct = new TestBufferStruct();
        const maxString = 'a'.repeat(255);
        const exceededString = 'a'.repeat(256);
        // String
        bufferStruct.stringProp1 = exceededString;
        expect(bufferStruct.stringProp1).to.equal(maxString);
      });

      it('number properties should support 64-bit floating point values', () => {
        const bufferStruct = new TestBufferStruct();
        // Number
        bufferStruct.numProp1 = Number.MAX_SAFE_INTEGER;
        bufferStruct.numProp2 = Number.MIN_SAFE_INTEGER;
        expect(bufferStruct.numProp1).to.equal(Number.MAX_SAFE_INTEGER);
        expect(bufferStruct.numProp2).to.equal(Number.MIN_SAFE_INTEGER);

        bufferStruct.numProp1 = Number.MIN_VALUE;
        bufferStruct.numProp2 = Number.MAX_VALUE;
        expect(bufferStruct.numProp1).to.equal(Number.MIN_VALUE);
        expect(bufferStruct.numProp2).to.equal(Number.MAX_VALUE);
      });
    });

    describe('dirty bits', () => {
      it('isDirty() should indicate if any or a specific property was changed', () => {
        const bufferStruct = new TestBufferStruct();
        expect(bufferStruct.isDirty()).to.equal(false);
        expect(bufferStruct.isDirty(0)).to.equal(false); // numProp1
        expect(bufferStruct.isDirty(1)).to.equal(false); // stringProp1
        expect(bufferStruct.isDirty(2)).to.equal(false); // booleanProp1
        expect(bufferStruct.isDirty(3)).to.equal(false); // numProp2
        expect(bufferStruct.isDirty(4)).to.equal(false); // stringProp2
        expect(bufferStruct.isDirty(5)).to.equal(false); // booleanProp2
        bufferStruct.numProp1 = 123;
        expect(bufferStruct.isDirty()).to.equal(true);
        expect(bufferStruct.isDirty(0)).to.equal(true);
        expect(bufferStruct.isDirty(1)).to.equal(false);
        expect(bufferStruct.isDirty(2)).to.equal(false);
        expect(bufferStruct.isDirty(3)).to.equal(false);
        expect(bufferStruct.isDirty(4)).to.equal(false);
        expect(bufferStruct.isDirty(5)).to.equal(false);
        bufferStruct.stringProp1 = 'abc';
        expect(bufferStruct.isDirty()).to.equal(true);
        expect(bufferStruct.isDirty(0)).to.equal(true);
        expect(bufferStruct.isDirty(1)).to.equal(true);
        expect(bufferStruct.isDirty(2)).to.equal(false);
        expect(bufferStruct.isDirty(3)).to.equal(false);
        expect(bufferStruct.isDirty(4)).to.equal(false);
        expect(bufferStruct.isDirty(5)).to.equal(false);
      });

      it('isDirty() should indicate if any or a specific property was changed (extended)', () => {
        const bufferStruct = new ExtTestBufferStruct();
        expect(bufferStruct.isDirty()).to.equal(false);
        expect(bufferStruct.isDirty(0)).to.equal(false); // numProp1
        expect(bufferStruct.isDirty(1)).to.equal(false); // stringProp1
        expect(bufferStruct.isDirty(2)).to.equal(false); // booleanProp1
        expect(bufferStruct.isDirty(3)).to.equal(false); // numProp2
        expect(bufferStruct.isDirty(4)).to.equal(false); // stringProp2
        expect(bufferStruct.isDirty(5)).to.equal(false); // booleanProp2
        expect(bufferStruct.isDirty(6)).to.equal(false); // extBooleanProp1
        expect(bufferStruct.isDirty(7)).to.equal(false); // extNumProp1
        expect(bufferStruct.isDirty(8)).to.equal(false); // extStringProp1
        bufferStruct.numProp1 = 123;
        expect(bufferStruct.isDirty()).to.equal(true);
        expect(bufferStruct.isDirty(0)).to.equal(true);
        expect(bufferStruct.isDirty(1)).to.equal(false);
        expect(bufferStruct.isDirty(2)).to.equal(false);
        expect(bufferStruct.isDirty(3)).to.equal(false);
        expect(bufferStruct.isDirty(4)).to.equal(false);
        expect(bufferStruct.isDirty(5)).to.equal(false);
        expect(bufferStruct.isDirty(6)).to.equal(false);
        expect(bufferStruct.isDirty(7)).to.equal(false);
        expect(bufferStruct.isDirty(8)).to.equal(false);
        bufferStruct.extStringProp1 = 'abc';
        expect(bufferStruct.isDirty()).to.equal(true);
        expect(bufferStruct.isDirty(0)).to.equal(true);
        expect(bufferStruct.isDirty(1)).to.equal(false);
        expect(bufferStruct.isDirty(2)).to.equal(false);
        expect(bufferStruct.isDirty(3)).to.equal(false);
        expect(bufferStruct.isDirty(4)).to.equal(false);
        expect(bufferStruct.isDirty(5)).to.equal(false);
        expect(bufferStruct.isDirty(6)).to.equal(false);
        expect(bufferStruct.isDirty(7)).to.equal(false);
        expect(bufferStruct.isDirty(8)).to.equal(true);
      });

      it('resetDirty() should reset the dirty bits', () => {
        const bufferStruct = new TestBufferStruct();
        bufferStruct.numProp1 = 123;
        bufferStruct.stringProp1 = 'abc';
        bufferStruct.booleanProp2 = true;
        bufferStruct.resetDirty();
        expect(bufferStruct.isDirty()).to.equal(false);
        expect(bufferStruct.isDirty(0)).to.equal(false); // numProp1
        expect(bufferStruct.isDirty(1)).to.equal(false); // stringProp1
        expect(bufferStruct.isDirty(2)).to.equal(false); // booleanProp1
        expect(bufferStruct.isDirty(3)).to.equal(false); // numProp2
        expect(bufferStruct.isDirty(4)).to.equal(false); // stringProp2
        expect(bufferStruct.isDirty(5)).to.equal(false); // booleanProp2
      });
    });

    describe('locks', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });

      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      it('isLocked() should return true if lock is held', async () => {
        const bufferStruct = new TestBufferStruct();
        const syncIsLocked = bufferStruct.lock(() => {
          return bufferStruct.isLocked;
        });
        const asyncIsLocked = await bufferStruct.lockAsync(async () => {
          return bufferStruct.isLocked;
        });
        expect(syncIsLocked, 'sync isLocked').to.equal(true);
        expect(asyncIsLocked, 'async isLocked').to.equal(true);
      });

      it('lock should throw and be released if lock handler throws an exception', async () => {
        const bufferStruct = new TestBufferStruct();
        let syncThrew = false;
        let asyncThrew = false;
        try {
          bufferStruct.lock(() => {
            throw new Error('test');
          });
        } catch (e) {
          syncThrew = true;
        }
        expect(bufferStruct.isLocked, 'sync bufferStruct.isLocked').to.equal(
          false,
        );
        expect(syncThrew, 'sync threw').to.equal(true);
        try {
          await bufferStruct.lockAsync(async () => {
            throw new Error('test');
          });
        } catch (e) {
          asyncThrew = true;
        }
        expect(bufferStruct.isLocked, 'async bufferStruct.isLocked').to.equal(
          false,
        );
        expect(asyncThrew, 'asyncThrew').to.equal(true);
      });

      it('synchronous lock() should work on main worker even if lock is held by other worker', async () => {
        const bufferStruct = new TestBufferStruct();
        threadx.sendMessage('test-worker', {
          type: 'hold-lock-until-notify',
          buffer: bufferStruct.buffer,
        });
        // Wait for worker to let us know it's holding the lock
        const waitVal = await bufferStruct.waitAsync(0);
        expect(waitVal).to.equal('ok');
        // Let worker know it can release the lock (it won't happen right away
        // since it's using waitAsync())
        bufferStruct.notify(1);
        // When we get the lock now it should already be held by the worker
        // and cause the synchronous wait() _busy loop_ to be used since this
        // is the main worker.
        const result = bufferStruct.lock(() => {
          return true;
        });
        expect(result).to.equal(true);
      });

      it('lock() and lockAsync() should only allow one worker to hold the lock at a time', async () => {
        /*
         * This test is a bit tricky to understand, so here's a breakdown of
         * what's happening:
         * 1. We create a TestBufferStruct and send its buffer to the TestWorker via message
         * 2. We then immediately call waitAsync() on the TestBufferStruct to wait for the
         *    TestWorker to be ready to fight for the lock.
         * 3. When the TestWorker receives the message it creates its own TestBufferStruct
         *    using the same buffer. The TestWorker then calls notify() on the struct and
         *    immediately calls a synchronous wait() to wait for the final signal from us
         *    to start fighting for the lock.
         * 4. After being woken up from the waitAsync() call we call notify() to send the
         *    final signal to start the fight.
         *
         *     ^--- This all effectively makes sure that both sides start the fight at as close
         *          to the same time as possible.
         *
         * 5. Both us and the TestWorker immediately enter a 1 second while loop where both
         *    sides fight for the lock. We do this by calling lockAsync() and the TestWorker
         *    does this by calling lock(). The TestWorker attempts to modify the buffer
         *    making sure numProp1 equals numProp2 and stringProp1 equals stringProp2. We
         *    simply check that the properties are equal on our side, incrementing the
         *    `numRunsThatMatched` counter if they are.
         * 6. The main test criteria is that the `numRunsThatMatched` counter matches the
         *    number of times around the while loop. Which effectively means that
         *    only one side was able to hold the lock at any given time.
         *
         * You can check that this test is working by commenting out the locking
         * mechanism on either side.
         */
        const bufferStruct = new TestBufferStruct();

        // Define the allowUndefined properties
        bufferStruct.numProp2 = 0;
        bufferStruct.stringProp2 = '';

        threadx.sendMessage('test-worker', {
          type: 'fight-for-lock',
          buffer: bufferStruct.buffer,
        });

        let numRuns = 0;
        let numRunsThatMatched = 0;
        // Wait for the worker to be ready first
        const waitVal = await bufferStruct.waitAsync(0);
        expect(waitVal).to.equal('ok');
        // The worker is ready now. Let's fight!
        bufferStruct.notify();
        const end = Date.now() + 1000;
        while (Date.now() < end) {
          await bufferStruct.lockAsync(async () => {
            if (
              bufferStruct.numProp1 === bufferStruct.numProp2 &&
              bufferStruct.stringProp1 === bufferStruct.stringProp2
            ) {
              numRunsThatMatched++;
            }
            numRuns++;
          });
        }
        // Lets say we need at least 1000 runs to be sure the test has enough
        // data to be accurate.
        expect(numRuns).to.be.greaterThan(1000);
        // If these are equal then only one side was able to hold the lock at
        // any given time.
        expect(numRuns).to.equal(numRunsThatMatched);
      });
    });
    describe('notify', () => {
      beforeEach(() => {
        threadx.registerWorker('test-worker', new TestWorker());
      });

      afterEach(() => {
        threadx.closeWorker('test-worker');
      });

      it('wait() and waitAsync() should wait for a notify and return "ok" if properly invoked', async () => {
        const bufferStruct = new TestBufferStruct();

        // Tell the worker to start the 'notify-wait' test
        const waitValFromWorkerPromise = threadx.sendMessageAsync(
          'test-worker',
          {
            type: 'notify-wait',
            buffer: bufferStruct.buffer,
          },
        );
        // Worker notifies us when its ready (and starts waiting via wait() for us to notify it)
        const waitVal = await bufferStruct.waitAsync(0);
        expect(waitVal).to.equal('ok');
        // Notify worker that it can continue
        bufferStruct.notify();
        // Wait for the return value the worker got from wait() so we can check it
        expect(await waitValFromWorkerPromise).to.equal('ok');
      });

      it('wait() and waitAsync() should return "timed-out" if notify does not come in time', async () => {
        const bufferStruct = new TestBufferStruct();

        // Tell the worker to start the 'notify-wait' test
        // Tell it to use a very low timeout to make sure its wait() times out
        const waitValFromWorkerPromise = threadx.sendMessageAsync(
          'test-worker',
          {
            type: 'notify-wait',
            buffer: bufferStruct.buffer,
            timeout: 5,
          },
        );

        // Use very low timeout to make sure we timeout
        const waitVal = await bufferStruct.waitAsync(0, 5);
        expect(waitVal).to.equal('timed-out');

        // Wait for the return value the worker got from wait() so we can check it
        expect(await waitValFromWorkerPromise).to.equal('timed-out');
      });

      it('wait() and waitAsync() should return "not-equal" if the expectedValue condition was not met', async () => {
        const bufferStruct = new TestBufferStruct();

        // Tell the worker to start the 'notify-wait' test
        // Use the expectedValue 999 which will cause the worker to return 'not-equal'
        const waitValFromWorkerPromise = threadx.sendMessageAsync(
          'test-worker',
          {
            type: 'notify-wait',
            buffer: bufferStruct.buffer,
            expectedValue: 999,
          },
        );

        // Use very low timeout to make sure we timeout
        const waitVal = await bufferStruct.waitAsync(999);
        expect(waitVal).to.equal('not-equal');

        // Wait for the return value the worker got from wait() so we can check it
        expect(await waitValFromWorkerPromise).to.equal('not-equal');
      });
    });
  });
});
