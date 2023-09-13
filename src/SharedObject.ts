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

import type { IEventEmitter } from './IEventEmitter.js';
import type { BufferStruct, BufferStructConstructor } from './BufferStruct.js';
import { ThreadX } from './ThreadX.js';
import { assertTruthy } from './utils.js';

export class SharedObject implements IEventEmitter {
  /**
   * The ThreadX instance that this SharedObject should interact with
   *
   * @remarks
   * It's unsafe to use `ThreadX.instance` in different, especially asyncronous,
   * locations directly because it may change during the lifetime of a
   * SharedObject. At least it can during tests. So this one should always
   * be referenced when needed.
   */
  private threadx: ThreadX;
  private sharedObjectStruct: BufferStruct | null;
  protected mutations: { [s in string]?: true };
  private waitPromise: Promise<void> | null = null;
  private mutationsQueued = false;
  static staticInitialized = false;
  private _id: number;
  private _typeId: number;
  private initialized = false;
  private destroying = false;
  declare z$__type__Props: object;
  protected curProps: this['z$__type__Props'];

  /**
   * Extract the buffer from a SharedObject
   *
   * @remarks
   * For internal use by ThreadX only
   *
   * @param sharedObject
   * @returns
   */
  static extractBuffer(sharedObject: SharedObject): SharedArrayBuffer {
    if (sharedObject.destroying || !sharedObject.sharedObjectStruct) {
      throw new Error(
        'SharedObject.extractBuffer(): SharedObject is or was being destroyed.',
      );
    }
    return sharedObject.sharedObjectStruct.buffer;
  }

  constructor(
    sharedObjectStruct: BufferStruct,
    curProps: Record<string, unknown>,
  ) {
    this.curProps = curProps;
    this.threadx = ThreadX.instance;
    this.sharedObjectStruct = sharedObjectStruct;
    this._id = sharedObjectStruct.id;
    this._typeId = sharedObjectStruct.typeId;
    const constructor = this.constructor as typeof SharedObject;
    if (
      !Object.prototype.hasOwnProperty.call(constructor, 'staticInitialized') ||
      !constructor.staticInitialized
    ) {
      constructor.staticInitialized = true;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const prototype = Object.getPrototypeOf(this);
      Object.keys(curProps).forEach((key) => {
        Object.defineProperty(prototype, key, {
          get: function (this: SharedObject) {
            return this.curProps[key as keyof object];
          },
          set: function (this: SharedObject, value: unknown) {
            this.curProps[key as keyof SharedObject['curProps']] =
              value as never;
            this.mutations[key as keyof object] = true;
            this.queueMutations();
          },
        });
      });
    }

    this.mutations = {};
    this._executeMutations();
    this.initialized = true;
  }

  get typeId(): number {
    return this._typeId;
  }

  get id(): number {
    return this._id;
  }

  /**
   * Assumes lock is acquired
   */
  protected processDirtyProperties(): void {
    if (!this.sharedObjectStruct) {
      throw new Error('SharedObject was destroyed');
    }
    const { sharedObjectStruct, mutations, curProps } = this;
    (
      sharedObjectStruct.constructor as BufferStructConstructor
    ).propDefs.forEach((propDef, index) => {
      if (sharedObjectStruct.isDirty(index)) {
        const propName = propDef.name as keyof BufferStruct;
        // If this property has a pending mutation from this worker, then
        // cancel it. The mutation from the other worker that has already
        // been applied to the SharedArrayBuffer will take precedence.
        delete mutations[propName];
        const oldValue = curProps[propName as keyof SharedObject['curProps']];
        // Apply the mutation from the other worker
        curProps[propName as keyof SharedObject['curProps']] =
          sharedObjectStruct[propName] as never;
        // Don't call onPropertyChange during the initialization process
        if (this.initialized) {
          this.onPropertyChange(
            propName as keyof SharedObject['curProps'],
            sharedObjectStruct[propName] as never,
            oldValue,
          );
        }
      }
    });
    sharedObjectStruct.resetDirty();
  }

  onPropertyChange<Key extends keyof this['z$__type__Props']>(
    propName: Key,
    newValue: this['z$__type__Props'][Key],
    oldValue: this['z$__type__Props'][Key] | undefined,
  ): void {
    // console.log(`onPropertyChange: ${propName} = ${value} (${this.dirtyProcessCount}, ${ThreadX.workerName)`);
  }

  queueMutations(): void {
    if (this.mutationsQueued) {
      return;
    }
    this.mutationsQueued = true;
    queueMicrotask(() => {
      this.mutationsQueued = false;
      // If the SharedObject has been destroyed, then forget about processing
      // any mutations.
      if (!this.sharedObjectStruct) {
        return;
      }
      this.mutationMicrotask().catch(console.error);
    });
  }

  private async mutationMicrotask() {
    if (!this.sharedObjectStruct) {
      throw new Error('SharedObject was destroyed');
    }
    await this.sharedObjectStruct.lockAsync(async () => {
      this._executeMutations();
    });
    if (this.destroying) {
      this.finishDestroy();
    }
  }

  public flush(): void {
    if (this.destroying || !this.sharedObjectStruct) {
      throw new Error('SharedObject was destroyed');
    }
    this.sharedObjectStruct.lock(() => {
      this._executeMutations();
    });
  }

  /**
   * Called when the SharedObject is being destroyed.
   *
   * @remarks
   * This is an opportunity to clean up anything just prior to the SharedObject
   * being completely destroyed. Shared mutations are allowed in this method.
   *
   * IMPORTANT:
   * `super.onDestroy()` must be called at the END of any subclass override to
   * ensure proper cleanup.
   */
  protected onDestroy(): void {
    // Implement in subclass
  }

  /**
   * Destroy the SharedObject on this worker only.
   *
   * @remarks
   * This stops any internal mutation processing, releases the reference
   * to the underlying BufferStruct/SharedArrayBuffer, and removes all
   * event listeners so that the SharedObject can be garbage collected.
   *
   * This does not destroy the SharedObject on other worker. To do that,
   * call `SharedObject.destroy()` on the other worker.
   */
  public destroy(): void {
    const struct = this.sharedObjectStruct;
    if (this.destroying || !struct) {
      return;
    }
    this.emit('beforeDestroy', {}, { localOnly: true });
    this.destroying = true;
    this.onDestroy();
    // The remainter of the destroy process (this.finishDestroy) is called
    // after the next set of mutations is processed. This is to ensure that
    // any final mutations that are queued up are sent to the opposite thread
    // before the SharedObject is destroyed on this worker.
    this.queueMutations();
  }

  private finishDestroy(): void {
    const struct = this.sharedObjectStruct;
    if (!this.destroying || !struct) {
      return;
    }

    // Remove this object from ThreadX
    // Silently because ThreadX may already have been removed if this object
    // is being destroyed because the current worker was told to forget about it.
    this.threadx.forgetObjects([this], { silent: true }).catch(console.error);

    // Release the reference to the underlying BufferStruct/SharedArrayBuffer
    this.sharedObjectStruct = null;
    // Submit a notify in order to wake up self or other worker if waiting
    // on the struct. Need to do this otherwise memory leaks.
    struct.notify();
    // Emit the afterDestroy event
    this.emit('afterDestroy', {}, { localOnly: true });
    // Remove all event listeners
    this.eventListeners = {};
  }

  get isDestroyed(): boolean {
    return this.sharedObjectStruct === null;
  }

  private _executeMutations(): void {
    if (!this.sharedObjectStruct) {
      // SharedObject was destroyed so there's nothing to do
      return;
    }
    // Only process properties if the SharedObject is dirty and the current
    // worker is not the one that last modified it.
    if (
      this.sharedObjectStruct.notifyValue !== this.threadx.workerId &&
      this.sharedObjectStruct.isDirty()
    ) {
      this.processDirtyProperties();
    }
    const { mutations } = this;
    this.mutations = {};
    for (const key in mutations) {
      if (Object.prototype.hasOwnProperty.call(mutations, key)) {
        const value = this.curProps[key as keyof SharedObject['curProps']];
        // Workaround TypeScript limitation re-assigning to dynamic keys of a class instance:
        // https://github.com/microsoft/TypeScript/issues/53738
        const oldValue = this.sharedObjectStruct[key as keyof BufferStruct];
        // @ts-expect-error Ignore the read-only assignment errors
        this.sharedObjectStruct[key as keyof BufferStruct] =
          value as unknown as typeof oldValue;
      }
    }
    if (this.waitPromise) {
      this.waitPromise = null;
    }
    let expectedNotifyValue = this.sharedObjectStruct.notifyValue;
    if (this.sharedObjectStruct.isDirty()) {
      this.sharedObjectStruct.notify(this.threadx.workerId);
      expectedNotifyValue = this.threadx.workerId;
    }
    const waitPromise = this.sharedObjectStruct
      .waitAsync(expectedNotifyValue)
      .then(async (result) => {
        // Only respond if this is the most recent wait promise
        if (this.waitPromise === waitPromise && this.sharedObjectStruct) {
          assertTruthy(result === 'ok');
          this.waitPromise = null;
          await this.mutationMicrotask();
        }
      });
    this.waitPromise = waitPromise;
  }

  //#region EventEmitter
  private eventListeners: { [eventName: string]: any } = {};

  on(event: string, listener: (target: any, data: any) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let listeners = this.eventListeners[event];
    if (!listeners) {
      listeners = [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    listeners.push(listener);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.eventListeners[event] = listeners;
  }

  off(event: string, listener: (target: any, data: any) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const listeners = this.eventListeners[event];
    if (!listeners) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      listeners.splice(index, 1);
    }
  }

  once(event: string, listener: (target: any, data: any) => void): void {
    const onceListener = (target: any, data: any) => {
      this.off(event, onceListener);
      listener(target, data);
    };
    this.on(event, onceListener);
  }

  emit(
    event: string,
    data: Record<string, unknown>,
    options: { localOnly?: boolean } = {},
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const listeners = this.eventListeners[event];
    if (!options.localOnly) {
      // Emit on opposite worker (if shared)
      ThreadX.instance.__sharedObjectEmit(this, event, data);
    }
    if (!listeners) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    [...listeners].forEach((listener) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      listener(this, data);
    });
  }
  //#endregion EventEmitter
}
