-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,4),
    "unit" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredients_position_nonnegative" CHECK ("position" >= 0),
    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "instruction" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_steps_position_nonnegative" CHECK ("position" >= 0),
    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipeId_position_key" ON "recipe_ingredients"("recipeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipeId_position_key" ON "recipe_steps"("recipeId", "position");

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
