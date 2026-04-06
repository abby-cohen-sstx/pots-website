import { getCollection } from "astro:content";

async function getArticles() {
    const articles = (await getCollection("articles"));

    return articles.map(article => ({
        title: article.data.title,
        subheader: article.data.subheader,
        id: article.id,
    }));
}

export async function GET({}){
    return new Response(
        JSON.stringify(await getArticles()), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}