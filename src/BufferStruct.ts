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

import { ThreadX } from './ThreadX.js';
import { stringifyTypeId } from './buffer-struct-utils.js';

const TYPEID_INT32_INDEX = 0;
const NOTIFY_INT32_INDEX = 1;
const LOCK_INT32_INDEX = 2;
const DIRTY_INT32_INDEX = 6;
const UNDEFINED_INT32_INDEX = 8;

const ID_FLOAT64_INDEX = 2;

const MAX_STRING_SIZE = 255;

export type StructPropType = 'string' | 'number' | 'boolean' | 'int32';

export type BufferStructConstructor<
  WritableProps = object,
  T extends BufferStruct = BufferStruct,
> = {
  new (): T & WritableProps;
  propDefs: PropDef[];
};

function valueIsType(
  expectedType: 'number',
  type: string,
  value: unknown,
): value is number;
function valueIsType(
  expectedType: 'int32',
  type: string,
  value: unknown,
): value is number;
function valueIsType(
  expectedType: 'boolean',
  type: string,
  value: unknown,
): value is boolean;
function valueIsType(
  expectedType: 'string',
  type: string,
  value: unknown,
): value is string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function valueIsType(
  expectedType: string,
  type: string,
  value: unknown,
): boolean {
  return expectedType === type;
}

function valuesAreEqual(a: number, b: unknown): b is number;
function valuesAreEqual(a: boolean, b: unknown): b is boolean;
function valuesAreEqual(a: string, b: unknown): b is string;
function valuesAreEqual(a: string | number | boolean, b: unknown): boolean {
  return a === b;
}

export interface StructPropOptions {
  propToBuffer?(value: unknown): unknown;
  bufferToProp?(value: unknown): unknown;
  /**
   * Allow the value of this property to be undefined.
   *
   * @remarks
   * If true, the property will be undefined by default. Be sure to type
   * the property as `type | undefined` in the BufferStruct interface,
   * getter and setter.
   */
  allowUndefined?: boolean;
}

export function structProp(type: StructPropType, options?: StructPropOptions) {
  return function (
    target: BufferStruct,
    key: string,
    descriptor: PropertyDescriptor,
  ): void {
    const constructor = target.constructor as typeof BufferStruct;
    // Make sure the static initializer has been called. We must check that the
    // constructor directly has its "own property" because it may be inherited
    // from a parent class.
    if (
      !Object.prototype.hasOwnProperty.call(constructor, 'staticInitialized') ||
      !constructor.staticInitialized
    ) {
      constructor.initStatic();
    }

    let byteOffset = constructor.size;
    let offset = 0;
    let byteSize = 0;
    if (type === 'string') {
      byteOffset += byteOffset % 2;
      offset = byteOffset / 2;
      byteSize = (MAX_STRING_SIZE + 1) * 2; // 16-bits for size then 255 16-bit characters
    } else if (type === 'int32' || type === 'boolean') {
      byteOffset += byteOffset % 4;
      offset = byteOffset / 4;
      byteSize = 4;
    } else if (type === 'number') {
      byteOffset += byteOffset % 8;
      offset = byteOffset / 8;
      byteSize = 8;
    }

    const propDefs = constructor.propDefs;
    const propNum = propDefs.length;
    const allowUndefined = !!options?.allowUndefined;
    const propDef: PropDef = {
      propNum,
      name: key,
      type,
      byteOffset,
      offset,
      byteSize,
      allowUndefined,
    };
    propDefs.push(propDef);

    // console.log(constructor.size, byteOffset, byteSize, propDef);
    constructor.size = byteOffset + byteSize;

    // TODO: Move the descriptors to the prototype to avoid code duplication/closures
    descriptor.get = function (this: BufferStruct) {
      let value: unknown;
      if (allowUndefined && this.isUndefined(propNum)) {
        value = undefined;
      } else if (type === 'string') {
        const length = this.uint16array[offset];
        if (!length) return '';
        if (length > MAX_STRING_SIZE) {
          // This should never happen because we truncate the string when setting it
          throw new Error(
            `get SharedObject.${key}: Text length is too long. Length: ${length}`,
          );
        }
        value = String.fromCharCode(
          ...this.uint16array.slice(offset + 1, offset + 1 + length),
        );
      } else if (type === 'int32') {
        value = this.int32array[offset];
      } else if (type === 'boolean') {
        value = !!this.int32array[offset];
      } else if (type === 'number') {
        value = this.float64array[offset];
      }
      if (options?.bufferToProp) {
        value = options.bufferToProp(value);
      }
      return value;
    };

    descriptor.set = function (this: BufferStruct, value: unknown) {
      if (options?.propToBuffer) {
        value = options.propToBuffer(value);
      }
      if (allowUndefined) {
        const isUndefined = this.isUndefined(propNum);
        if (value === undefined) {
          if (isUndefined) return;
          this.setDirty(propNum);
          this.setUndefined(propNum, true);
          return;
        } else if (isUndefined) {
          this.setDirty(propNum);
          this.setUndefined(propNum, false);
        }
      }
      if (valueIsType('string', type, value)) {
        if (!valuesAreEqual(value, this[key as keyof BufferStruct])) {
          this.setDirty(propNum);
          // Copy string into shared memory in the most efficient way possible
          let length = value.length;
          if (length > MAX_STRING_SIZE) {
            console.error(
              `set SharedObject.${key}: Text length is too long. Truncating...`,
              length,
            );
            length = MAX_STRING_SIZE;
          }
          this.uint16array[offset] = length;
          const startOffset = offset + 1;
          const endOffset = startOffset + length;
          let charIndex = 0;
          for (let i = startOffset; i < endOffset; i++) {
            this.uint16array[i] = value.charCodeAt(charIndex++);
          }
        }
      } else if (valueIsType('int32', type, value)) {
        if (!valuesAreEqual(value, this[key as keyof BufferStruct])) {
          this.setDirty(propNum);
          this.int32array[offset] = value;
        }
      } else if (valueIsType('boolean', type, value)) {
        if (!valuesAreEqual(value, this[key as keyof BufferStruct])) {
          this.setDirty(propNum);
          this.int32array[offset] = value ? 1 : 0;
        }
      } else if (valueIsType('number', type, value)) {
        if (!valuesAreEqual(value, this[key as keyof BufferStruct])) {
          this.setDirty(propNum);
          this.float64array[offset] = value;
        }
      }
    };
  };
}

interface PropDef {
  propNum: number;
  name: string;
  type: StructPropType;
  byteOffset: number;
  offset: number;
  byteSize: number;
  allowUndefined: boolean;
}

/**
 * BufferStruct Header Structure:
 * Int32[0]
 *   Type ID: Type of object (32-bit identifier)
 * Int32[1]
 *    Notify / Last Mutator Worker ID
 * Int32[2]
 *    Lock
 * Int32[3]
 *    RESERVED (64-bit align)
 * Int32[4 - 5] / Float64[ID_FLOAT64_INDEX = 2]
 *    Shared Unique ID of the object
 * Int32[DIRTY_INT32_INDEX = 6]
 *    Dirty Bit Mask 1 (Property Indices 0-31)
 * Int32[DIRTY_INT32_INDEX + 1 = 7]
 *    Dirty Bit Mask 2 (Property Indices 32-63)
 * Int32[UNDEFINED_INT32_INDEX = 8]
 *    Undefined Bit Mask 1 (Property Indices 0-31)
 * Int32[UNDEFINED_INT32_INDEX + 1 = 9]
 *    Undefined Bit Mask 2 (Property Indices 32-63)
 *
 * HEADER SIZE MUST BE A MULTIPLE OF 8 BYTES (64-BIT ALIGNMENT)
 */
export abstract class BufferStruct {
  buffer: SharedArrayBuffer;
  // Lock ID that is a valid 32-bit random integer
  protected lockId = Math.floor(Math.random() * 0xffffffff);
  protected uint16array: Uint16Array;
  protected int32array: Int32Array;
  protected float64array: Float64Array;

  static staticInitialized = false;
  static typeId = 0;
  static typeIdStr = '';
  static size = 10 * 4; // Header size
  static propDefs: PropDef[] = [];

  constructor(buffer?: SharedArrayBuffer) {
    const constructor = this.constructor as typeof BufferStruct;
    // Make sure the static initializer has been called. We must check that the
    // constructor directly has its "own property" because it may be inherited
    // from a parent class.
    if (
      !Object.prototype.hasOwnProperty.call(constructor, 'staticInitialized') ||
      !constructor.staticInitialized
    ) {
      constructor.initStatic();
    }

    const isNew = !buffer;
    if (!buffer) {
      // Round constructor.size to the nearest multiple of 8 bytes (64-bit alignment)
      buffer = new SharedArrayBuffer(Math.ceil(constructor.size / 8) * 8);
    }

    this.buffer = buffer;
    this.uint16array = new Uint16Array(buffer);
    this.int32array = new Int32Array(buffer);
    this.float64array = new Float64Array(buffer);

    const typeId = constructor.typeId;

    // If this is a new buffer, initialize the TypeID and ID
    if (isNew) {
      this.int32array[TYPEID_INT32_INDEX] = typeId;
      this.float64array[ID_FLOAT64_INDEX] = ThreadX.instance.generateUniqueId();

      // Iterate the propDefs and set undefined for all properties marked `allowUndefined`
      for (const propDef of constructor.propDefs) {
        if (propDef.allowUndefined) {
          this.setUndefined(propDef.propNum, true);
        }
      }
    } else if (this.int32array[TYPEID_INT32_INDEX] !== typeId) {
      // If this is an existing buffer, verify the TypeID is the same as expected
      // by this class
      throw new Error(
        `BufferStruct: TypeId mismatch. Expected '${
          constructor.typeIdStr
        }', got '${stringifyTypeId(this.int32array[TYPEID_INT32_INDEX]!)}'`,
      );
    }
  }

  /**
   * Safely extract the TypeID from any SharedArrayBuffer (as if it is a BufferStruct)
   *
   * @remarks
   * Does not check if the TypeID is valid however it does a basic sanity check to
   * ensure the buffer is large enough to contain the TypeID at Int32[TYPEID_INT32_INDEX].
   *
   * If the buffer is found to be invalid, 0 is returned.
   *
   * @param buffer
   * @returns
   */
  static extractTypeId(buffer: SharedArrayBuffer): number {
    if (buffer.byteLength < BufferStruct.size || buffer.byteLength % 8 !== 0) {
      return 0;
    }
    return new Int32Array(buffer)[TYPEID_INT32_INDEX] || 0;
  }

  /**
   * Checks if typeId is valid and sets up static properties when the first
   * structProp() decorator is set-up on the class.
   *
   * @remarks
   * WARNING: This should not ever be called directly.
   *
   * @internal
   */
  static initStatic() {
    const typeIdStr = stringifyTypeId(this.typeId);
    if (typeIdStr === '????') {
      throw new Error(
        'BufferStruct.typeId must be set to a valid 32-bit integer',
      );
    }
    this.typeIdStr = typeIdStr;
    this.propDefs = [...this.propDefs];
    this.staticInitialized = true;
  }

  protected setDirty(propIndex: number) {
    const dirtyWordOffset = Math.floor(propIndex / 32);
    const dirtyBitOffset = propIndex - dirtyWordOffset * 32;
    this.int32array[DIRTY_INT32_INDEX + dirtyWordOffset] =
      this.int32array[DIRTY_INT32_INDEX + dirtyWordOffset]! |
      (1 << dirtyBitOffset);
  }

  resetDirty() {
    // TODO: Do we need to use atomics here?
    this.int32array[NOTIFY_INT32_INDEX] = 0;
    this.int32array[DIRTY_INT32_INDEX] = 0;
    this.int32array[DIRTY_INT32_INDEX + 1] = 0;
  }

  isDirty(propIndex?: number): boolean {
    if (propIndex !== undefined) {
      const dirtyWordOffset = Math.floor(propIndex / 32);
      const dirtyBitOffset = propIndex - dirtyWordOffset * 32;
      return !!(
        this.int32array[DIRTY_INT32_INDEX + dirtyWordOffset]! &
        (1 << dirtyBitOffset)
      );
    }
    return !!(
      this.int32array[DIRTY_INT32_INDEX] ||
      this.int32array[DIRTY_INT32_INDEX + 1]
    );
  }

  protected setUndefined(propIndex: number, value: boolean) {
    const undefWordOffset = Math.floor(propIndex / 32);
    const undefBitOffset = propIndex - undefWordOffset * 32;

    if (value) {
      this.int32array[UNDEFINED_INT32_INDEX + undefWordOffset] =
        this.int32array[UNDEFINED_INT32_INDEX + undefWordOffset]! |
        (1 << undefBitOffset);
    } else {
      this.int32array[UNDEFINED_INT32_INDEX + undefWordOffset] =
        this.int32array[UNDEFINED_INT32_INDEX + undefWordOffset]! &
        ~(1 << undefBitOffset);
    }
  }

  protected isUndefined(propIndex: number): boolean {
    const undefWordOffset = Math.floor(propIndex / 32);
    const undefBitOffset = propIndex - undefWordOffset * 32;
    return !!(
      this.int32array[UNDEFINED_INT32_INDEX + undefWordOffset]! &
      (1 << undefBitOffset)
    );
  }

  get typeId(): number {
    // Atomic load not required here because typeId is constant
    return this.int32array[TYPEID_INT32_INDEX]!;
  }

  get id(): number {
    // Atomic load not required here because id is constant
    return this.float64array[ID_FLOAT64_INDEX]!;
  }

  /**
   * Returns the current notify value
   */
  get notifyValue(): number {
    return Atomics.load(this.int32array, NOTIFY_INT32_INDEX);
  }

  /**
   * Returns true if the BufferStruct is currently locked
   */
  get isLocked(): boolean {
    return Atomics.load(this.int32array, LOCK_INT32_INDEX) !== 0;
  }

  lock<T>(callback: () => T): T {
    let origLock = Atomics.compareExchange(
      this.int32array,
      LOCK_INT32_INDEX,
      0,
      this.lockId,
    );
    while (origLock !== 0) {
      try {
        Atomics.wait(this.int32array, LOCK_INT32_INDEX, origLock);
      } catch (e: unknown) {
        if (
          e instanceof TypeError &&
          e.message === 'Atomics.wait cannot be called in this context'
        ) {
          // Atomics.wait() not supported in this context (main worker), so just spin
          // TODO: Maybe we detect this earlier and avoid this exception? This works for now.
        } else {
          throw e;
        }
      }
      origLock = Atomics.compareExchange(
        this.int32array,
        LOCK_INT32_INDEX,
        0,
        this.lockId,
      );
    }
    let result: T;
    try {
      result = callback();
    } finally {
      Atomics.store(this.int32array, LOCK_INT32_INDEX, 0);
      Atomics.notify(this.int32array, LOCK_INT32_INDEX);
    }
    return result;
  }

  async lockAsync<T>(callback: (...args: any[]) => Promise<T>): Promise<T> {
    let origLock = Atomics.compareExchange(
      this.int32array,
      LOCK_INT32_INDEX,
      0,
      this.lockId,
    );
    while (origLock !== 0) {
      const result = Atomics.waitAsync(
        this.int32array,
        LOCK_INT32_INDEX,
        origLock,
      );
      await result.value;
      origLock = Atomics.compareExchange(
        this.int32array,
        LOCK_INT32_INDEX,
        0,
        this.lockId,
      );
    }
    let result: T;
    try {
      result = await callback();
    } finally {
      Atomics.store(this.int32array, LOCK_INT32_INDEX, 0);
      Atomics.notify(this.int32array, LOCK_INT32_INDEX);
    }
    return result;
  }

  notify(value?: number) {
    if (value !== undefined) {
      Atomics.store(this.int32array, NOTIFY_INT32_INDEX, value);
    }
    return Atomics.notify(this.int32array, NOTIFY_INT32_INDEX);
  }

  wait(expectedValue: number, timeout = Infinity) {
    const result = Atomics.wait(
      this.int32array,
      NOTIFY_INT32_INDEX,
      expectedValue,
      timeout,
    );
    return result;
  }

  async waitAsync(
    expectedValue: number,
    timeout = Infinity,
  ): Promise<'not-equal' | 'timed-out' | 'ok'> {
    const result = Atomics.waitAsync(
      this.int32array,
      NOTIFY_INT32_INDEX,
      expectedValue,
      timeout,
    );
    return result.value;
  }
}
