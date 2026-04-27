import { Navbar } from "@/components/layout/Navbar";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useGetSavedProperties } from "@workspace/api-client-react";
import { Loader2, HeartCrack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Saved() {
  const { data: savedProperties, isLoading } = useGetSavedProperties();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">العقارات المحفوظة</h1>
        <p className="text-muted-foreground mb-8">قائمة بالعقارات التي قمت بحفظها للرجوع إليها لاحقاً</p>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : savedProperties && savedProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {savedProperties.map((prop) => (
              <PropertyCard key={prop.id} property={prop} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-muted/20 border border-dashed rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <HeartCrack className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">لا توجد عقارات محفوظة</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              لم تقم بحفظ أي عقارات بعد. استكشف العقارات المتاحة واحفظ ما يناسبك للرجوع إليه لاحقاً.
            </p>
            <Button asChild size="lg">
              <Link href="/properties">تصفح العقارات</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
