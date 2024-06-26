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

import { BufferStruct, genTypeId, structProp } from '@lightningjs/threadx';

export interface TestBufferStructWritableProps {
  numProp1: number;
  stringProp1: string;
  booleanProp1: boolean;
  numProp2?: number;
  stringProp2?: string;
  booleanProp2: boolean | undefined;
}

export class TestBufferStruct
  extends BufferStruct
  implements TestBufferStructWritableProps
{
  static override typeId = genTypeId('TEST');

  @structProp('number')
  get numProp1(): number {
    return 0;
  }

  set numProp1(v: number) {
    // Provided by decorator
  }

  @structProp('string')
  get stringProp1(): string {
    return '';
  }

  set stringProp1(v: string) {
    // Provided by decorator
  }

  @structProp('boolean')
  get booleanProp1(): boolean {
    return false;
  }

  set booleanProp1(v: boolean) {
    // Provided by decorator
  }

  @structProp('number', {
    allowUndefined: true,
  })
  get numProp2(): number | undefined {
    return 0;
  }

  set numProp2(v: number | undefined) {
    // Provided by decorator
  }

  @structProp('string', {
    allowUndefined: true,
  })
  get stringProp2(): string | undefined {
    return '';
  }

  set stringProp2(v: string | undefined) {
    // Provided by decorator
  }

  @structProp('boolean', {
    allowUndefined: true,
  })
  get booleanProp2(): boolean | undefined {
    return false;
  }

  set booleanProp2(v: boolean | undefined) {
    // Provided by decorator
  }
}
