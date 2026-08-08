import { supabase } from "../db.js";
export const browseCategoriesSchema = {};
export async function browseCategories(_args) {
    const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, url")
        .order("name", { ascending: true });
    if (error)
        return { error: error.message };
    return {
        category_count: data?.length ?? 0,
        categories: data,
    };
}
