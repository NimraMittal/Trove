import { sampleRecipes } from "@/features/recipes/data/sample-recipes";
import DiscoverRecipesPage from "@/features/recipes/pages/DiscoverRecipesPage";

export default function RecipesPage() {
  return <DiscoverRecipesPage recipes={sampleRecipes} />;
}