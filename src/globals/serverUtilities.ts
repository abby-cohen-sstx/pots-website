import { ARTICLE_ORDER } from "@/globals/articleOrder";
import { getCollection } from "astro:content";

export async function sortArticles() {
    
    const articles = await getCollection("articles");

    /*
    Format:
    [{
        id: 'support-groups',
        data: {
        layout: '/src/layouts/MarkdownLayout.astro',
        title: 'Support Groups for POTS',
        header: 'Support Groups for POTS',
        subheader: 'My subtitle',
        pubDate: 2022-07-01T00:00:00.000Z,
        collection: 'Resources',
        type: 'Resources'
        },
        filePath: 'src/pages/articles/support-groups.mdx',
        digest: '8cebcce5919bc1a0',
        deferredRender: true,
        collection: 'articles'
        body: `text content of the article`
    }]
    */


    // Create a lookup table: id -> position in ARTICLE_ORDER
    const orderIndex = new Map<string, number>();
    ARTICLE_ORDER.forEach((id, index) => orderIndex.set(id, index));

    // Sort all articles according to orderIndex
    articles.sort((a, b) => {
    const ai = orderIndex.get(a.id);
    const bi = orderIndex.get(b.id);

    // Both explicitly ordered:
    if (ai !== undefined && bi !== undefined) return ai - bi;

    // Priortize explicitly ordered articles over non-explicitly ordered:
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;

    // Neither ordered:
    return 0;
    });

    return articles;
}

export async function filterArticles(collection: string, type: string, sort: boolean = true) {
    let articles

    if (sort) {
        articles = await sortArticles();
    } else {
        articles = await getCollection("articles");
    }

    return articles.filter(article => article.data.collection === collection && article.data.type === type);
}

export async function articlesByType(collection: string, sort: boolean = true) {
    let articles

    if (sort) {
        articles = await sortArticles();
    } else {
        articles = await getCollection("articles");
    }

    articles.filter(article => article.data.collection === collection)

    const byType = articles.reduce((accumulator, article) => {
        const type = article.data.type;

        // Initialize type array if it doesn't exist:
        accumulator[type] = accumulator[type] || [];

        // Push article into the correct type group
        accumulator[type].push(article);

        return accumulator;
    }, {} as Record<string, typeof articles>);

    return byType;
}

export async function articlesByCollectionAndType(sort: boolean = true) {
    let articles

    if (sort) {
        articles = await sortArticles();
    } else {
        articles = await getCollection("articles");
    }

    const byCollection = articles.reduce((accumulator, article) => {
        const collection = article.data.collection;
        const type = article.data.type;

        // Intiialize collection if it doesn't exist:
        accumulator[collection] = accumulator[collection] || {};

        // Initialize type array if it doesn't exist:
        accumulator[collection][type] = accumulator[collection][type] || [];

        // Push article into the correct collection and type group
        accumulator[collection][type].push(article);

        return accumulator;
    }, {} as Record<string, Record<string, typeof articles>>);

    return byCollection;
}
