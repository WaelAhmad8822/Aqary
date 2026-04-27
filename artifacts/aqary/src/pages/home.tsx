import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useListProperties, useGetRecommendations } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ArrowLeft, Building2 } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: recentProperties, isLoading: isRecentLoading } = useListProperties(undefined, {
    query: {
      queryKey: ["recent-properties"],
      staleTime: 60000,
    }
  });
  const safeRecentProperties = Array.isArray(recentProperties) ? recentProperties : [];

  const { data: recommendations } = useGetRecommendations({
    query: {
      queryKey: ["recommendations"],
      retry: false,
    }
  });
  const safeRecommendations = Array.isArray(recommendations) ? recommendations : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/properties?search=${encodeURIComponent(searchQuery)}`);
    } else {
      setLocation("/properties");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden flex items-center justify-center min-h-[60vh]">
        {/* Abstract Background pattern instead of stock image for a cleaner modern look */}
        <div className="absolute inset-0 bg-primary/5 z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background z-0" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/sandpaper.png')] opacity-10 z-0" />
        
        <div className="container px-4 relative z-10 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight max-w-4xl">
            ابحث عن <span className="text-primary relative whitespace-nowrap">
              <span className="relative z-10">منزل أحلامك</span>
              <span className="absolute bottom-0 left-0 w-full h-3 bg-secondary/50 -z-0 transform -rotate-2"></span>
            </span> بكل سهولة وذكاء
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
            اكتشف آلاف العقارات الموثوقة في مصر. مع مساعدنا الذكي، نساعدك في العثور على العقار المناسب لاحتياجاتك وميزانيتك.
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-2xl bg-card rounded-full p-2 shadow-lg border flex items-center gap-2 hover-elevate transition-all">
            <div className="flex-1 flex items-center pl-4 pr-6">
              <Search className="w-5 h-5 text-muted-foreground ml-3 shrink-0" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالمنطقة، نوع العقار، أو المواصفات..." 
                className="border-0 focus-visible:ring-0 px-0 bg-transparent h-12 text-lg"
              />
            </div>
            <Button type="submit" size="lg" className="rounded-full px-8 h-12 shrink-0 text-base">
              بحث
            </Button>
          </form>
        </div>
      </section>

      {/* Recommendations Section (only if logged in and has data) */}
      {safeRecommendations.length > 0 && (
        <section className="py-16 bg-secondary/10">
          <div className="container px-4">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">مقترحة لك</h2>
                <p className="text-muted-foreground">بناءً على تفضيلاتك وبحثك السابق</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {safeRecommendations.slice(0, 4).map((prop) => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Listings Section */}
      <section className="py-16">
        <div className="container px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">عقارات جديدة</h2>
              <p className="text-muted-foreground">أحدث العقارات المضافة للمنصة</p>
            </div>
            <Button variant="ghost" className="gap-2 text-primary" asChild>
              <Link href="/properties">
                عرض الكل <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {isRecentLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : safeRecentProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {safeRecentProperties.slice(0, 8).map((prop) => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
              <p className="text-muted-foreground">لا توجد عقارات متاحة حالياً</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t mt-auto py-12">
        <div className="container px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">عقاري</span>
          </div>
          <p className="text-muted-foreground text-sm">
            منصة العقارات الذكية الأولى في مصر. نسهل عليك بيع وشراء العقارات.
          </p>
          <div className="mt-8 pt-8 border-t text-sm text-muted-foreground">
            © {new Date().getFullYear()} عقاري. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>

    </div>
  );
}
