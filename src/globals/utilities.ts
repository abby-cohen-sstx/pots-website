export type ClassOf<T> = { new (...args: any[]): T }; // javascript is so weird... this syntax is disgusting lol

// Gets element by ID and checks that it is of the expected type
export function getByID<T extends Element>(
    id: string,
    myClass: ClassOf<T>
): T {
    const element = document.getElementById(id) as Element | null;
    if(!(element instanceof myClass)) {
        throw new Error(`getByID Failed. Element ID: ${id}`);
    }
    return element as T;
}

// Gets element by query selector
export function getByQuery<T extends Element>(
    query: string,
    myClass: ClassOf<T>,
    parent: Element | Document = document
): T {
    const element = parent.querySelector(query) as Element | null;
    if(!(element instanceof myClass)) {
        throw new Error(`getByQuery Failed. Query: ${query}`);
    }
    return element as T;
}

// Gets all elements matching query selector
export function getAllByQuery<T extends Element>(
    query: string,
    myClass: ClassOf<T>,
    parent: Element | Document = document
): T[] {
    const elements = parent.querySelectorAll(query) as NodeListOf<Element>;
    const result: T[] = [];
    elements.forEach(element => {
        if(!(element instanceof myClass)) {
            throw new Error(`getAllByQuery Failed. Query: ${query}`);
        }
        result.push(element as T);
    });
    return result;
}

// Remove all characters except a-z, 0-9, and whitespaces
export function validateSearch(searchTerm: string) {
    return searchTerm.replace(/[^a-z0-9\s]/gi, '');
}

import { getCollection } from "astro:content";
import { ARTICLE_ORDER } from "@/globals/articleOrder";
import { COLLECTION_LIST } from "@/globals/collectionList";

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

export async function getArticleListByCollectionAndType() {
    const articles = await sortArticles();
    // Group by collection
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

    console.log("-------------");
    console.log(byCollection);
    return byCollection;
}