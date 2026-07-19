// https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader
import { glob } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

import { COLLECTION_LIST } from "@/globals/collectionList"


// 4. Define your collection
const articles = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
    schema: z.object({
        title: z.string(),
        header: z.string(),
        subheader: z.string(),
        description: z.string(),
        pubDate: z.date(),
        updatedDate: z.date().optional(),
        collection: z.enum(COLLECTION_LIST),
        type: z.enum(["Overviews", "Deep Dives", "Resources"]),
    }),
});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { articles };