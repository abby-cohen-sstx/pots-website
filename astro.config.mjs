// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import { remarkCitations } from './src/plugins/remark-citations.mjs';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx({ remarkPlugins: [remarkCitations] })],
  devToolbar: { enabled:false }
});
