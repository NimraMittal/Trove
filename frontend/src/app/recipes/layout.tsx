import type { ReactNode } from "react";

import SiteHeader from "@/shared/components/SiteHeader/SiteHeader";

type RecipesLayoutProps = {
  children: ReactNode;
};

export default function RecipesLayout({
  children,
}: RecipesLayoutProps) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}