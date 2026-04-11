// https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection } from 'astro:content';

// 2. Import loader
import { glob } from 'astro/loaders';

// 3. Import Zod
import { z } from 'astro/zod';

import { COLLECTION_LIST } from "@/globals/collectionList"


const References = z.array(
    z.object({
        id: z.string(),
        authors: z.string(),
        title: z.string(),
        date: z.date(),
        link: z.url(),
        journal: z.string(),
        citation: z.string(),
    })
)


// 4. Define your collection
const articles = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/pages/articles" }),
    schema: z.object({
        layout: z.string(),
        title: z.string(),
        header: z.string(),
        subheader: z.string(),
        pubDate: z.date(),
        collection: z.enum(COLLECTION_LIST),
        type: z.enum(["Overviews", "Deep Dives", "Resources"]),
        references: References.optional(),
        referenceOrder: z.array(z.string()).optional(),
    }),
});

// 5. Export a single `collections` object to register your collection(s)
export const collections = { articles };