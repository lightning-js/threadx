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

type ExtractMethods<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

type SafeParameters<T> = T extends (...args: infer P) => any ? P : never;

type SafeReturnType<T> = T extends (...args: any) => infer R ? R : never;

interface SpyOnOptions<T, M extends keyof ExtractMethods<T>> {
  onCall?: (...args: SafeParameters<T[M]>) => void;
  onReturn?: (
    result: SafeReturnType<T[M]>,
    ...args: SafeParameters<T[M]>
  ) => void;
}

type UntilConditionCallback<Method> = (
  result: SafeReturnType<Method>,
  ...args: SafeParameters<Method>
) => boolean;

interface SimpleSpy<Method> {
  called: boolean;
  lastArgs: SafeParameters<Method> | undefined;
  lastResult: SafeReturnType<Method> | undefined;
  numCalls: number;
  untilCalledNTimes: (n: number) => Promise<void>;
  untilCondition: (condition: UntilConditionCallback<Method>) => Promise<void>;
  restore: () => void;
}

export function simpleSpy<T, M extends keyof ExtractMethods<T>>(
  object: T,
  method: M,
  options: SpyOnOptions<T, M> = {},
) {
  const original = object[method];
  const untilCalledNTimesResolves: Map<number, () => void> = new Map();
  const untilCalledNTimesPromises: Map<number, Promise<void>> = new Map();
  const untilConditionResolves: Map<
    UntilConditionCallback<T[M]>,
    () => void
  > = new Map();
  const untilConditionPromises: WeakMap<
    UntilConditionCallback<T[M]>,
    Promise<void>
  > = new WeakMap();
  const spy: SimpleSpy<T[M]> = {
    called: false,
    lastArgs: undefined,
    lastResult: undefined,
    numCalls: 0,
    untilCalledNTimes(n: number) {
      if (untilCalledNTimesPromises.has(n)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return untilCalledNTimesPromises.get(n)!;
      }

      let promise: Promise<void>;
      if (this.numCalls >= n) {
        promise = Promise.resolve();
      } else {
        promise = new Promise<void>((resolve) => {
          untilCalledNTimesResolves.set(n, resolve);
        });
      }

      untilCalledNTimesPromises.set(n, promise);
      return promise;
    },
    untilCondition(condition) {
      if (untilConditionPromises.has(condition)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return untilConditionPromises.get(condition)!;
      }

      const promise: Promise<void> = new Promise<void>((resolve) => {
        untilConditionResolves.set(condition, resolve);
      });

      untilConditionPromises.set(condition, promise);
      return promise;
    },
    restore: () => (object[method] = original),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object[method] = function (this: T, ...args: SafeParameters<T[M]>): any {
    if (options.onCall) {
      options.onCall(...args);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (original as any).call(this, ...args);
    spy.called = true;
    spy.lastArgs = args;
    spy.lastResult = result;
    spy.numCalls++;
    if (options.onReturn) {
      options.onReturn(result, ...args);
    }
    if (untilCalledNTimesResolves.has(spy.numCalls)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      untilCalledNTimesResolves.get(spy.numCalls)!.call(null);
    }
    untilConditionResolves.forEach((resolve, condition) => {
      if (condition(result, ...args)) {
        // Remove resolver from map
        untilConditionResolves.delete(condition);
        resolve();
      }
    });
    return result;
  } as T[M];
  return spy as Readonly<typeof spy>;
}

/**
 * Generate a SharedArrayBuffer with random values of the given size.
 *
 * @param size
 * @returns
 */
export function generateRandomSAB(size: number) {
  const buffer = new SharedArrayBuffer(size);
  // Fill in shared array buffer with random values
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    view[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

/**
 * Delay for the given number of milliseconds.
 *
 * @param ms
 * @returns
 */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function assertTruthy(
  condition: unknown,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}
