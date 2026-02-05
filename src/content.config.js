// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader(s)
import { glob, file } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

// 4. Define your collection(s)
const articles = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/pages/articles" }),
    schema: z.object({
        layout: z.string(),
        title: z.string(),
        header: z.string(),
        subheader: z.string(),
        pubDate: z.string().date(),
        tags: z.array(z.string()),
    }),

});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { articles };

// ID is the filename by default (ex. const articleData = await getEntry('articles', 'sample'))
// https://docs.astro.build/en/guides/content-collections/