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

import { SharedObject } from './SharedObject.js';
import { stringifyTypeId } from './buffer-struct-utils.js';
import { assertTruthy, resolvedGlobal } from './utils.js';

interface ThreadXOptions {
  /**
   * The ID of the worker. Must be unique across all workers.
   *
   * Should be an integer value between 1 and 899.
   *
   * @internalRemarks
   * The reason for the 899 limit is the way we generate unique IDs for
   * BufferStructs. See `BufferStruct.ts` for more details.
   */
  workerId: number;
  workerName: string;
  sharedObjectFactory?: (buffer: SharedArrayBuffer) => SharedObject | null;
  // TOOD: Ultimately replace this with a more generic event handler system
  onObjectShared?: (sharedObject: SharedObject) => void;
  onBeforeObjectForgotten?: (sharedObject: SharedObject) => void;
  onMessage?: (message: any) => Promise<any>;
}

declare global {
  class DedicatedWorkerGlobalScope {
    DedicatedWorkerGlobalScope: typeof DedicatedWorkerGlobalScope;

    postMessage(message: any, transfer?: Transferable[]): void;
    addEventListener<K extends keyof WindowEventHandlersEventMap>(
      type: K,
      listener: (
        this: WindowEventHandlers,
        ev: WindowEventHandlersEventMap[K],
      ) => any,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void;
  }

  interface WindowOrWorkerGlobalScope {
    THREADX?: ThreadX;

    DedicatedWorkerGlobalScope?: typeof DedicatedWorkerGlobalScope;
  }
}

/**
 * Created to define a common interface for both Worker parents (`self`) and
 * Worker instances
 */
interface WorkerCommon {
  postMessage(message: any, transfer?: Transferable[]): void;
  addEventListener<K extends keyof WindowEventHandlersEventMap>(
    type: K,
    listener: (
      this: WindowEventHandlers,
      ev: WindowEventHandlersEventMap[K],
    ) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  terminate?(): void;
}

interface ForgetOptions {
  /**
   * If true, no warning will be logged if the object is not found.
   */
  silent?: boolean;
}

interface ThreadXMessage {
  threadXMessageType: string;
}

interface ReadyMessage extends ThreadXMessage {
  threadXMessageType: 'ready';
}

interface ShareObjectsMessage extends ThreadXMessage {
  threadXMessageType: 'shareObjects';
  buffers: SharedArrayBuffer[];
}

interface ForgetObjectsMessage extends ThreadXMessage {
  threadXMessageType: 'forgetObjects';
  objectIds: number[];
}
interface SharedObjectEmitMessage extends ThreadXMessage {
  threadXMessageType: 'sharedObjectEmit';
  sharedObjectId: number;
  eventName: string;
  data: Record<string, unknown>;
}

interface ResponseMessage extends ThreadXMessage {
  threadXMessageType: 'response';
  asyncMsgId: number;
  error?: true;
  data: Record<string, unknown>;
}

interface CloseMessage extends ThreadXMessage {
  threadXMessageType: 'close';
}

function isMessage(
  messageType: 'ready',
  message: unknown,
): message is ReadyMessage;
function isMessage(
  messageType: 'shareObjects',
  message: unknown,
): message is ShareObjectsMessage;
function isMessage(
  messageType: 'forgetObjects',
  message: unknown,
): message is ForgetObjectsMessage;
function isMessage(
  messageType: 'sharedObjectEmit',
  message: unknown,
): message is SharedObjectEmitMessage;
function isMessage(
  messageType: 'response',
  message: unknown,
): message is ResponseMessage;
function isMessage(
  messageType: 'close',
  message: unknown,
): message is CloseMessage;
function isMessage(
  messageType: string,
  message: unknown,
): message is MessageEvent {
  return (
    typeof message === 'object' &&
    message !== null &&
    'threadXMessageType' in message &&
    message.threadXMessageType === messageType
  );
}

function isWebWorker(selfObj: any): selfObj is DedicatedWorkerGlobalScope {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return typeof selfObj.DedicatedWorkerGlobalScope === 'function';
}

export class ThreadX {
  static init(options: ThreadXOptions) {
    if (resolvedGlobal.THREADX) {
      throw new Error('ThreadX.init(): ThreadX already initialized.');
    }
    const threadX = new ThreadX(options);
    resolvedGlobal.THREADX = threadX;
    return threadX;
  }

  static destroy() {
    if (!resolvedGlobal.THREADX) {
      console.warn('ThreadX.destroy(): ThreadX is not initialized.');
      return;
    }
    delete resolvedGlobal.THREADX;
    return;
  }

  /**
   * Get the Worker ID of the current worker
   *
   * @remarks
   * This is only valid after ThreadX.init() has been called.
   */
  static get workerId(): number {
    if (!resolvedGlobal.THREADX) {
      throw new Error('ThreadX not initialized');
    }
    return resolvedGlobal.THREADX.workerId;
  }

  /**
   * Get the Worker Name of the current thread
   *
   * @remarks
   * This is only valid after ThreadX.init() has been called.
   */
  static get workerName(): string {
    if (!resolvedGlobal.THREADX) {
      throw new Error('ThreadX not initialized');
    }
    return resolvedGlobal.THREADX.workerName;
  }

  static get instance(): ThreadX {
    if (!resolvedGlobal.THREADX) {
      throw new Error('ThreadX not initialized');
    }
    return resolvedGlobal.THREADX;
  }

  readonly workerId: number;
  readonly workerName: string;
  readonly sharedObjectFactory?: (
    buffer: SharedArrayBuffer,
  ) => SharedObject | null;
  private readonly onSharedObjectCreated?: (sharedObject: SharedObject) => void;
  private readonly onBeforeObjectForgotten?: (
    sharedObject: SharedObject,
  ) => void;
  /**
   * User-defined message handler
   */
  private readonly onUserMessage?: (message: any) => Promise<void>;
  readonly sharedObjects = new Map<number, SharedObject>();
  /**
   * WeakMap of SharedObjects to additional metadata
   */
  private sharedObjectData = new WeakMap<
    SharedObject,
    {
      workerName: string;
      /**
       * Whether the SharedObject has been confirmed to be shared with the other worker
       */
      shareConfirmed: boolean;
      /**
       * Queue of messages to emit on the SharedObject once it is confirmed to be shared
       */
      emitQueue: Array<
        [eventName: string, data: Record<string, unknown>]
      > | null;
    }
  >();
  readonly workers = new Map<string, WorkerCommon>();
  private workerReadyPromises = new Map<
    string,
    {
      promise: Promise<void> | null;
      resolve: () => void;
    }
  >();
  private pendingAsyncMsgs = new Map<
    number,
    {
      resolve: (data: any) => void;
      reject: (data: any) => void;
    }
  >();
  private nextAsyncMsgId = 0;
  private nextUniqueId = 0;

  /**
   * Suppress emitting events from SharedObjects
   *
   * @remarks
   * This is used to prevent infinite loops when emitting events from a SharedObject
   * that is shared with another worker.
   *
   * We set this to true when we receive a SharedObjectEmitMessage from another worker
   * and set it back to false after we have emitted the event on the SharedObject.
   */
  private suppressSharedObjectEmit = false;

  private constructor(options: ThreadXOptions) {
    this.workerId = options.workerId;
    this.workerName = options.workerName;
    this.nextUniqueId = options.workerId * 10000000000000 + 1;
    this.sharedObjectFactory = options.sharedObjectFactory;
    this.onSharedObjectCreated = options.onObjectShared;
    this.onBeforeObjectForgotten = options.onBeforeObjectForgotten;
    this.onUserMessage = options.onMessage;
    const mySelf: unknown = resolvedGlobal;
    if (isWebWorker(mySelf)) {
      this.registerWorker('parent', mySelf);
      this.sendMessage('parent', {
        threadXMessageType: 'ready',
      } satisfies ReadyMessage);
    }
  }

  registerWorker(workerName: string, worker: WorkerCommon) {
    this.workers.set(workerName, worker);

    // Set up a promise that will resolve when the worker sends the
    // 'ready' message
    let readyResolve!: () => void;
    let readyPromise: Promise<void>;

    if (workerName === 'parent') {
      // parent worker is always ready
      readyPromise = Promise.resolve();
      readyResolve = () => {
        // do nothing
      };
    } else {
      readyPromise = new Promise<void>((resolve) => {
        readyResolve = resolve;
      });
    }

    this.workerReadyPromises.set(workerName, {
      promise: readyPromise,
      resolve: readyResolve,
    });

    this.listenForWorkerMessages(workerName, worker);
  }

  closeWorker(workerName: string) {
    if (!this.workers.has(workerName)) {
      throw new Error(`Worker ${workerName} not registered.`);
    }
    this.closeWorkerAsync(workerName).catch(console.error);
  }

  async closeWorkerAsync(
    workerName: string,
    timeout = 5000,
  ): Promise<'graceful' | 'forced'> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not registered.`);
    }
    const result = await Promise.race([
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, timeout);
      }),
      this.sendMessageAsync(workerName, {
        threadXMessageType: 'close',
      } satisfies CloseMessage) as Promise<boolean>,
    ]);
    this.workers.delete(workerName);
    this.workerReadyPromises.delete(workerName);
    if (!result) {
      console.warn(
        `threadX.closeWorkerAsync(): Worker "${workerName}" did not respond to "close" message within ${timeout}ms. Forcing termination.`,
      );
      worker.terminate?.();
      return 'forced';
    }
    return 'graceful';
  }

  private listenForWorkerMessages(workerName: string, worker: WorkerCommon) {
    worker.addEventListener('message', (event) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = event as { data: Record<string, unknown> };
      // Process only if message is a ThreadX message
      const asyncMsgId = data.__asyncMsgId as number | undefined;
      this.onMessage(workerName, data)
        .then((response) => {
          if (asyncMsgId !== undefined) {
            worker.postMessage({
              threadXMessageType: 'response',
              asyncMsgId: asyncMsgId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              data: response,
            } satisfies ResponseMessage);
          }
        })
        .catch((error) => {
          if (asyncMsgId !== undefined) {
            worker.postMessage({
              threadXMessageType: 'response',
              asyncMsgId: asyncMsgId,
              error: true,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              data: error,
            } satisfies ResponseMessage);
          }
        });
    });
  }

  /**
   * Share a SharedObject with a worker
   *
   * @param workerName Worker to share with
   * @param sharedObject
   */
  async shareObjects(workerName: string, sharedObjects: SharedObject[]) {
    for (const sharedObject of sharedObjects) {
      if (this.sharedObjects.get(sharedObject.id)) {
        // Currently we only support sharing objects with only a single worker
        // TODO: Support sharing objects with multiple workers?
        //   - Do we really need to do this?
        console.warn(
          `ThreadX.shareObject(): SharedObject ${
            sharedObject.id
          } (TypeID: ${stringifyTypeId(
            sharedObject.typeId,
          )}) is already shared.`,
        );
      } else {
        this.sharedObjects.set(sharedObject.id, sharedObject);
        this.sharedObjectData.set(sharedObject, {
          workerName: workerName,
          shareConfirmed: false,
          emitQueue: null,
        });
      }
    }
    await this.sendMessageAsync(workerName, {
      threadXMessageType: 'shareObjects',
      buffers: sharedObjects.map((so) => {
        return SharedObject.extractBuffer(so);
      }),
    } satisfies ShareObjectsMessage);
    for (const sharedObject of sharedObjects) {
      const soData = this.sharedObjectData.get(sharedObject);
      if (soData) {
        soData.shareConfirmed = true;
        const { emitQueue } = soData;
        if (emitQueue) {
          for (const event of emitQueue) {
            this.__sharedObjectEmit(sharedObject, event[0], event[1]);
          }
          soData.emitQueue = null;
        }
      }
    }

    // TODO: Handle case where worker fails to create shared object on its end
    //  - We could issue you an error event back to the sharer
  }

  /**
   * Tell ThreadX to forget about SharedObjects
   *
   * @remarks
   * This causes ThreadX on the current worker and the worker that the object
   * is shared with to forget about the object. It is up to the worker code to
   * actually make sure that no other references to the SharedObjects exist so
   * that they can be garbage collected.
   *
   * A worker can implement the onObjectForgotten() callback to be notified
   * when a SharedObject is forgotten.
   *
   * @param sharedObject
   * @param options Options
   */
  async forgetObjects(
    sharedObjects: SharedObject[],
    options: ForgetOptions = {},
  ) {
    /**
     * Map of worker name to array of SharedObjects
     *
     * @remarks
     * We group the shared objects by worker so that we can send a single message
     * to forget all of the objects shared with each worker.
     */
    const objectsByWorker = new Map<string, SharedObject[]>();
    for (const sharedObject of sharedObjects) {
      if (!this.sharedObjects.has(sharedObject.id)) {
        // Currently we only support sharing objects with only a single worker
        if (!options.silent) {
          console.warn(
            `ThreadX.forgetObject(): SharedObject ${
              sharedObject.id
            } (TypeID: ${stringifyTypeId(sharedObject.typeId)}) is not shared.`,
          );
        }
      } else {
        const soData = this.sharedObjectData.get(sharedObject);
        assertTruthy(soData);
        let objectsInWorker = objectsByWorker.get(soData.workerName);
        if (!objectsInWorker) {
          objectsInWorker = [];
          objectsByWorker.set(soData.workerName, objectsInWorker);
        }
        objectsInWorker.push(sharedObject);
        this.sharedObjects.delete(sharedObject.id);
        this.sharedObjectData.delete(sharedObject);
      }
    }

    const promises: Promise<void>[] = [];
    for (const [workerName, objectsInWorker] of objectsByWorker) {
      promises.push(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.sendMessageAsync(workerName, {
          threadXMessageType: 'forgetObjects',
          objectIds: objectsInWorker.map((so) => so.id),
        } satisfies ForgetObjectsMessage),
      );
    }
    await Promise.all(promises);
  }

  sendMessage(
    workerName: string,
    message: Record<string, unknown>,
    transfer?: Transferable[] | undefined,
  ): void {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(
        `ThreadX.sendMessage(): Worker '${workerName}' not registered.`,
      );
    }
    this.sendMessageAsync(workerName, message, transfer, {
      skipResponseWait: true,
    }).catch(console.error);
  }

  async sendMessageAsync(
    workerName: string,
    message: Record<string, unknown>,
    transfer?: Transferable[] | undefined,
    options: { skipResponseWait?: boolean } = {},
  ): Promise<any> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(
        `ThreadX.execMessage(): Worker '${workerName}' not registered.`,
      );
    }
    // Wait for the worker to be ready (if it isn't already)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.workerReadyPromises.get(workerName)!.promise;
    if (options.skipResponseWait) {
      worker.postMessage(message, transfer);
      return;
    }
    const asyncMsgId = this.nextAsyncMsgId++;
    const promise = new Promise((resolve, reject) => {
      this.pendingAsyncMsgs.set(asyncMsgId, {
        resolve,
        reject,
      });
    });
    message.__asyncMsgId = asyncMsgId;
    worker.postMessage(message, transfer);
    return promise;
  }

  private async onMessage(srcWorkerName: string, message: any): Promise<any> {
    if (isMessage('shareObjects', message)) {
      message.buffers.forEach((buffer: SharedArrayBuffer) => {
        const sharedObject = this.sharedObjectFactory?.(buffer);
        if (!sharedObject) {
          throw new Error(
            'ThreadX.onMesasge(): Failed to create shared object.',
          );
        }
        this.sharedObjects.set(sharedObject.id, sharedObject);
        this.sharedObjectData.set(sharedObject, {
          workerName: srcWorkerName,
          shareConfirmed: true,
          emitQueue: null,
        });
        this.onSharedObjectCreated?.(sharedObject);
      });
    } else if (isMessage('forgetObjects', message)) {
      message.objectIds.forEach((id: number) => {
        const sharedObject = this.sharedObjects.get(id);
        if (!sharedObject) {
          // If we can't find the SharedObject then it wasn't shared with this
          // worker. Just ignore the message.
          return;
        }
        this.onBeforeObjectForgotten?.(sharedObject);
        this.sharedObjects.delete(id);
        sharedObject.destroy();
      });
    } else if (isMessage('sharedObjectEmit', message)) {
      const sharedObject = this.sharedObjects.get(message.sharedObjectId);
      if (!sharedObject) {
        // If we can't find the SharedObject then it wasn't shared with this
        // worker. Just ignore the message.
        return;
      }
      // Prevent emitting the event back to the worker that sent it.
      this.suppressSharedObjectEmit = true;
      sharedObject.emit(message.eventName, message.data);
      this.suppressSharedObjectEmit = false;
    } else if (isMessage('response', message)) {
      const response = this.pendingAsyncMsgs.get(message.asyncMsgId);
      if (!response) {
        throw new Error(
          `ThreadX.onMessage(): Received response for unknown request (ID: ${message.asyncMsgId})`,
        );
      }
      this.pendingAsyncMsgs.delete(message.asyncMsgId);
      if (message.error) {
        response.reject(message.data);
      } else {
        response.resolve(message.data);
      }
    } else if (isMessage('close', message)) {
      resolvedGlobal.close();
      return true;
    } else if (isMessage('ready', message)) {
      // Resolve the worker ready promise
      this.workerReadyPromises.get(srcWorkerName)?.resolve();
      return true;
    } else if (this.onUserMessage) {
      return await this.onUserMessage(message);
    }
  }

  getSharedObjectById(id: number): SharedObject | null {
    return this.sharedObjects.get(id) || null;
  }

  /**
   * Generates an ID that is unique across all ThreadX workers.
   *
   * @remarks
   * The ID is based on the `workerId` set in the `ThreadXOptions` and an
   * incrementing counter. For the ID to actually be unique the `workerId` must
   * also be unique.
   *
   * @returns A unique ID
   */
  generateUniqueId(): number {
    return this.nextUniqueId++;
  }

  /**
   * Emit an event from a SharedObject to all other workers
   *
   * @internalRemarks
   * For internal ThreadX use only.
   *
   * Since we aren't sure what workers are sharing a SharedObject we need to
   * emit the event to all workers. (TODO: Possible optimization?)
   *
   * @param sharedObject
   * @param eventName
   * @param data
   * @returns
   */
  __sharedObjectEmit(
    sharedObject: SharedObject,
    eventName: string,
    data: Record<string, unknown>,
  ) {
    // If we are currently emitting an event from a SharedObject that originated
    // from another worker then we don't want to emit the event again.
    if (this.suppressSharedObjectEmit) {
      return;
    }
    const soData = this.sharedObjectData.get(sharedObject);
    if (!soData) {
      // Object isn't shared with any workers yet. Not even in process to do so.
      // Just ignore the emit.
      return;
    }
    if (!soData.shareConfirmed) {
      // Object is in the process of being shared with other workers. Queue the
      // emit until the share is confirmed.
      if (!soData.emitQueue) {
        soData.emitQueue = [];
      }
      soData.emitQueue.push([eventName, data]);
      return;
    }
    const worker = this.workers.get(soData.workerName);
    assertTruthy(worker, 'Worker not found');
    worker.postMessage({
      threadXMessageType: 'sharedObjectEmit',
      sharedObjectId: sharedObject.id,
      eventName,
      data,
    });
  }
}
