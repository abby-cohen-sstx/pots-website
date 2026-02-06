// https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader
import { glob } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

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
        collection: z.enum(["1", "2", "3"]),
    }),

});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { articles };
