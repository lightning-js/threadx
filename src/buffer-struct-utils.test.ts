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

import { describe, it, expect } from 'vitest';
import {
  genTypeId,
  isValidTypeId,
  stringifyTypeId,
} from './buffer-struct-utils.js';

describe('buffer-struct-utils', () => {
  describe('genTypeId', () => {
    it('should generate a type ID from a string', () => {
      expect(genTypeId('ABCD')).toBe(0x44434241);
      expect(genTypeId('NODE')).toBe(0x45444f4e);
      expect(genTypeId('WXYZ')).toBe(0x5a595857);
      expect(genTypeId('Q')).toBe(0x00000051);
      expect(genTypeId('QR')).toBe(0x00005251);
      expect(genTypeId('QRS')).toBe(0x00535251);
    });

    it('should throw if tidStr is longer than 4 characters', () => {
      expect(() => genTypeId('ABCDX')).toThrowError(
        `Type ID string must be 4 characters or less`,
      );
    });

    it('should throw if tidStr is empty', () => {
      expect(() => genTypeId('')).toThrowError(
        `Type ID string must be at least 1 character`,
      );
    });

    it('should throw if tidStr contains characters not in the range A-Z and 0-9', () => {
      function errMsg(char: string) {
        return `Invalid character '${char}' (char code: ${char.charCodeAt(
          0,
        )}) in type ID string. A-Z and 0-9 only.`;
      }
      expect(() => genTypeId('\u0000')).toThrowError(errMsg('\u0000'));
      expect(() => genTypeId('\u0000\u0000\u0000\u0000')).toThrowError(
        errMsg('\u0000'),
      );
      expect(() => genTypeId('\u00ff')).toThrowError(errMsg('\u00ff'));
      expect(() => genTypeId('/')).toThrowError(errMsg('/'));
      // Valid IDs: 0x30 - 0x39 ('0' - '9')
      expect(() => genTypeId(':' /* 0x3a */)).toThrowError(errMsg(':'));
      expect(() => genTypeId('@' /* 0x40 */)).toThrowError(errMsg('@'));
      // Valid IDs: 0x41 - 0x5a ('A' - 'Z')
      expect(() => genTypeId('[' /* 0x5b */)).toThrowError(errMsg('['));

      // Invalid IDs: 0x60 - 0x7a ('a' - 'z')
      expect(() => genTypeId('a' /* 0x60 */)).toThrowError(errMsg('a'));
      expect(() => genTypeId('z' /* 0x60 */)).toThrowError(errMsg('z'));

      // Additional
      expect(() => genTypeId('A/')).toThrowError(errMsg('/'));
      expect(() => genTypeId('AA/')).toThrowError(errMsg('/'));
      expect(() => genTypeId('AAA/')).toThrowError(errMsg('/'));
    });

    it('should only generate type IDs that are signed Int32 compatible', () => {
      const buffer = new ArrayBuffer(4);
      const int32View = new Int32Array(buffer);

      let typeId = genTypeId('0000');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);

      typeId = genTypeId('9999');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);

      typeId = genTypeId('AAAA');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);

      typeId = genTypeId('ABCD');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);

      typeId = genTypeId('WXYZ');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);

      typeId = genTypeId('ZZZZ');
      int32View[0] = typeId;
      expect(int32View[0]).toBe(typeId);
    });
  });

  describe('isValidTypeId', () => {
    //
    // Important: Keep test cases in sync with stringifyTypeId() tests below
    //
    it('should return true if type ID is valid', () => {
      expect(isValidTypeId(genTypeId('ABCD'))).toBe(true);
      expect(isValidTypeId(genTypeId('NODE'))).toBe(true);
      expect(isValidTypeId(genTypeId('WXYZ'))).toBe(true);
      expect(isValidTypeId(genTypeId('Q'))).toBe(true);
      expect(isValidTypeId(genTypeId('QR'))).toBe(true);
      expect(isValidTypeId(genTypeId('QRS'))).toBe(true);
    });

    it('should return false if the type ID is not a valid type ID', () => {
      expect(isValidTypeId(0)).toBe(false);
      // Edge conditions...
      expect(isValidTypeId(0x0000002f)).toBe(false); // '/'
      // Valid IDs: 0x30 - 0x39 ('0' - '9')
      expect(isValidTypeId(0x0000003a)).toBe(false); // ':'
      expect(isValidTypeId(0x00000040)).toBe(false); // '@'
      // Valid IDs: 0x41 - 0x5a ('A' - 'Z')
      expect(isValidTypeId(0x0000005b)).toBe(false); // '['

      // Invalid IDs: 0x60 - 0x7a ('a' - 'z')
      expect(isValidTypeId(0x00000060)).toBe(false); // 'a'
      expect(isValidTypeId(0x0000007a)).toBe(false); // 'z'

      expect(isValidTypeId(0xff)).toBe(false);

      // Invalid char codes can be at any part of the ID
      expect(isValidTypeId(0x00002f41)).toBe(false); // 'A/'
      expect(isValidTypeId(0x00214141)).toBe(false); // 'AA/'
      expect(isValidTypeId(0x21414141)).toBe(false); // 'AAA/'

      // Zero cannot be in the first byte position of the ID
      expect(isValidTypeId(0x41414100)).toBe(false); // 'AAA\0'

      expect(isValidTypeId(0xffffffff)).toBe(false);
    });
  });

  describe('stringifyTypeId', () => {
    //
    // Important: Keep test cases in sync with isValidTypeId() tests above
    //
    it('should stringify a type ID to its string form', () => {
      expect(stringifyTypeId(genTypeId('ABCD'))).toBe('ABCD');
      expect(stringifyTypeId(genTypeId('NODE'))).toBe('NODE');
      expect(stringifyTypeId(genTypeId('WXYZ'))).toBe('WXYZ');
      expect(stringifyTypeId(genTypeId('Q'))).toBe('Q');
      expect(stringifyTypeId(genTypeId('QR'))).toBe('QR');
      expect(stringifyTypeId(genTypeId('QRS'))).toBe('QRS');
    });

    it('should return "????" if the type ID is not a valid type ID', () => {
      expect(stringifyTypeId(0)).toBe('????');
      // Edge conditions...
      expect(stringifyTypeId(0x0000002f)).toBe('????'); // '/'
      // Valid IDs: 0x30 - 0x39 ('0' - '9')
      expect(stringifyTypeId(0x0000003a)).toBe('????'); // ':'
      expect(stringifyTypeId(0x00000040)).toBe('????'); // '@'
      // Valid IDs: 0x41 - 0x5a ('A' - 'Z')
      expect(stringifyTypeId(0x0000005b)).toBe('????'); // '['

      // Invalid IDs: 0x60 - 0x7a ('a' - 'z')
      expect(stringifyTypeId(0x00000060)).toBe('????'); // 'a'
      expect(stringifyTypeId(0x0000007a)).toBe('????'); // 'z'

      expect(stringifyTypeId(0xff)).toBe('????');

      // Invalid char codes can be at any part of the ID
      expect(stringifyTypeId(0x00002f41)).toBe('????'); // 'A/'
      expect(stringifyTypeId(0x00214141)).toBe('????'); // 'AA/'
      expect(stringifyTypeId(0x21414141)).toBe('????'); // 'AAA/'

      // Zero cannot be in the first byte position of the ID
      expect(stringifyTypeId(0x41414100)).toBe('????'); // 'AAA\0'

      expect(stringifyTypeId(0xffffffff)).toBe('????');
    });
  });
});
