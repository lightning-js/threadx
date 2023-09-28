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

import { SharedObject } from '../../dist/SharedObject.js';
import type {
  TestBufferStruct,
  TestBufferStructWritableProps,
} from '../buffer-structs/TestBufferStruct.js';

export class TestSharedObject
  extends SharedObject
  implements TestBufferStructWritableProps
{
  declare z$__type__Props: TestBufferStructWritableProps;

  constructor(
    sharedNodeStruct: TestBufferStruct,
    isWorker?: boolean,
    extendedCurProps?: Record<string, unknown>,
  ) {
    super(sharedNodeStruct, {
      ...extendedCurProps,
      numProp1: sharedNodeStruct.numProp1,
      stringProp1: sharedNodeStruct.stringProp1,
      booleanProp1: sharedNodeStruct.booleanProp1,
      numProp2: sharedNodeStruct.numProp2,
      stringProp2: sharedNodeStruct.stringProp2,
      booleanProp2: sharedNodeStruct.booleanProp2,
    });
    if (isWorker) {
      this.on('ping', (target, event) => {
        // Must queue the emit in a microtask because suppressSharedObjectEmit
        // is set to true when remote events are handled locally.
        queueMicrotask(() => {
          this.emit('pong', {});
        });
      });
    }
  }

  declare numProp1: number;
  declare stringProp1: string;
  declare booleanProp1: boolean;
  declare numProp2: number;
  declare stringProp2: string;
  declare booleanProp2: boolean;

  exposedOnDestroy() {
    // Exposed to allow testing of onDestroy() method
  }

  protected override onDestroy(): void {
    this.exposedOnDestroy();
    super.onDestroy();
  }
}
