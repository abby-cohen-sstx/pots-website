import { getPublishedArticles } from "@/globals/serverUtilities";

async function getArticles() {
    const articles = (await getPublishedArticles());

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