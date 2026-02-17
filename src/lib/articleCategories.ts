export const ARTICLE_CATEGORY_IDS = ["1", "2", "3"] as const;
export type ArticleCategoryId = (typeof ARTICLE_CATEGORY_IDS)[number];

// Record<ArticleCategoryId, string> creates an object type whose keys come from ArticleCategoryId and whose values are string
export const ARTICLE_CATEGORY_NAME: Record<ArticleCategoryId, string> = {
    // Format: "ID": "Category Name" - name will be displayed on menus

    "1": "Category 1",
    "2": "Category 2",
    "3": "Category 3",
};