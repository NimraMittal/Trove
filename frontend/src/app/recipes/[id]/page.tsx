import type { Metadata } from "next";
import RecipeDetailPage from "@/features/recipes/pages/RecipeDetailPage";

export const metadata: Metadata = {
  title: "Recipe | Trove",
  description: "Ingredients and cooking instructions on Trove.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeDetailPage key={id} id={id} />;
}
