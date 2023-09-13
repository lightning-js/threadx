/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2023 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the License);
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
 */

import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

/**
 * Vite Config
 *
 * @remarks
 * Currenly only for tests
 */
export default defineConfig(({ command, mode, ssrBuild }) => {
  return {
    resolve: {
      mainFields: ['browser', 'module', 'jsnext:main', 'jsnext'],
      alias: [{ find: /((\/|^)(src)\/.*)\.js$/, replacement: '$1.ts' }],
    },
    server: {
      https: false,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    plugins: [mkcert()],
    optimizeDeps: {
      exclude: ['vitest/utils'],
      include: ['@vitest/utils', 'vitest/browser'],
    },
    test: {
      exclude: [
        // Default vitest exclusions
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',

        // Added exclusions
        '**/browser-tests/**/*',
      ],
      // browser: {
      //   enabled: true,
      //   name: 'chrome', // browser name is required
      // },
    },
  };
});
