import { getRecipes } from "@/features/recipes/api/recipes.api";
import DiscoverRecipesPage from "@/features/recipes/pages/DiscoverRecipesPage";

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return <DiscoverRecipesPage recipes={recipes} />;
}