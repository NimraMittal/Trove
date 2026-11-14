export type RecipeIngredientDetail = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  position: number;
};

export type RecipeStepDetail = {
  id: string;
  instruction: string;
  position: number;
};

export type RecipeDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  creator: { displayName: string };
  ingredients: RecipeIngredientDetail[];
  steps: RecipeStepDetail[];
};
