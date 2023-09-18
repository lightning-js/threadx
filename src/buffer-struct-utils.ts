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

function isValidTypeIdCharCode(charCode: number): boolean {
  // Allow uppercase letters and numbers
  return (
    (charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)
  );
}

export function genTypeId(tidString: string): number {
  let typeId = 0;
  if (tidString.length === 0) {
    throw new Error(`genTypeId: Type ID string must be at least 1 character`);
  } else if (tidString.length > 4) {
    throw new Error(`genTypeId: Type ID string must be 4 characters or less`);
  }
  for (let i = 0; i < tidString.length; i++) {
    let charCode = tidString.charCodeAt(i);
    if (charCode !== charCode) {
      // Use 0 for NaN
      charCode = 0;
    } else if (!isValidTypeIdCharCode(charCode)) {
      // Throw if the character is not a valid type ID character
      throw new Error(
        `genTypeId: Invalid character '${tidString[
          i
        ]!}' (char code: ${charCode}) in type ID string. A-Z and 0-9 only.`,
      );
    }
    typeId |= charCode << (i * 8);
  }
  return typeId;
}

/**
 * Returns true if the given type ID is valid.
 *
 * @param typeId
 * @returns
 */
export function isValidTypeId(typeId: number): boolean {
  for (let i = 0; i < 4; i++) {
    const charCode = typeId & 0xff;
    if (!isValidTypeIdCharCode(charCode) && (charCode !== 0 || i === 0)) {
      // Bail as soon as we encounter an invalid character
      // Except if charCodes other than the first one are 0
      return false;
    }
    typeId >>>= 8;
  }
  return true;
}

/**
 * Converts a type ID to its string form.
 *
 * @remarks
 * If the type ID is not a valid type ID, null is returned.
 *
 * @param typeId
 * @returns
 */
export function stringifyTypeId(typeId: number): string {
  const chars = [];
  for (let i = 0; i < 4; i++) {
    const charCode = typeId & 0xff;
    if (isValidTypeIdCharCode(charCode)) {
      chars.push(String.fromCharCode(charCode));
    } else if (charCode !== 0 || i === 0) {
      // Bail as soon as we encounter an invalid character
      // Except if charCodes other than the first one are 0
      return '????';
    }
    typeId >>>= 8;
  }
  return chars.join('');
}
