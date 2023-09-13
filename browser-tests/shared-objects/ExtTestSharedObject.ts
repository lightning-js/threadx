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

import type {
  ExtTestBufferStruct,
  ExtTestBufferStructWritableProps,
} from '../buffer-structs/ExtTestBufferStruct.js';
import type { TestBufferStructWritableProps } from '../buffer-structs/TestBufferStruct.js';
import { TestSharedObject } from './TestSharedObject.js';

export class ExtTestSharedObject
  extends TestSharedObject
  implements ExtTestBufferStructWritableProps
{
  declare z$__type__Props: ExtTestBufferStructWritableProps;

  constructor(extBufferStruct: ExtTestBufferStruct, isWorker?: boolean) {
    super(extBufferStruct, isWorker, {
      extNumProp1: extBufferStruct.extNumProp1,
      extStringProp1: extBufferStruct.extStringProp1,
    } satisfies Omit<ExtTestBufferStructWritableProps, keyof TestBufferStructWritableProps>);
  }

  declare extNumProp1: number;
  declare extStringProp1: string;
}
