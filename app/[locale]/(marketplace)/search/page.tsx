import { getTranslations } from "next-intl/server";
import { getApprovedProducts } from "@/services/products";
import { SearchView } from "@/components/marketplace/SearchView";

export default async function SearchPage() {
  const t = await getTranslations();

  // Get all approved products for client-side search
  const products = await getApprovedProducts();

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <SearchView products={products} />
    </div>
  );
}
