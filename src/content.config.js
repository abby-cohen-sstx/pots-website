// https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader
import { glob } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

import { ARTICLE_CATEGORY_IDS } from "./lib/articleCategories"; // adjust path

// 4. Define your collection
const articles = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/pages/articles" }),
    schema: z.object({
        layout: z.string(),
        title: z.string(),
        header: z.string(),
        subheader: z.string(),
        pubDate: z.date(),
        tags: z.array(z.string()),
        collection: z.enum(["Collection1", "Collection2","Collection3"]),
    }),
});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { articles };
