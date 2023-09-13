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

import { genTypeId, structProp } from '@lightningjs/threadx';
import {
  TestBufferStruct,
  type TestBufferStructWritableProps,
} from './TestBufferStruct.js';

export interface ExtTestBufferStructWritableProps
  extends TestBufferStructWritableProps {
  extNumProp1: number;
  extStringProp1: string;
}

export class ExtTestBufferStruct
  extends TestBufferStruct
  implements ExtTestBufferStructWritableProps
{
  static override typeId = genTypeId('EXTT');

  @structProp('number')
  get extNumProp1(): number {
    return 0;
  }

  set extNumProp1(v: number) {
    // Provided by decorator
  }

  @structProp('string')
  get extStringProp1(): string {
    return '';
  }

  set extStringProp1(v: string) {
    // Provided by decorator
  }
}
