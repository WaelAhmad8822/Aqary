import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useListProperties } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Search, Loader2, Filter } from "lucide-react";
import { useLocation } from "wouter";

export default function Properties() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialSearch = searchParams.get("search") || "";

  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [priceRange, setPriceRange] = useState([0, 50000000]);

  // Apply filters on button click
  const [activeFilters, setActiveFilters] = useState({
    search: initialSearch,
    type: "all",
    location: "all",
    minPrice: 0,
    maxPrice: 50000000
  });

  const { data: properties, isLoading } = useListProperties({
    search: activeFilters.search || undefined,
    type: activeFilters.type !== "all" ? activeFilters.type : undefined,
    location: activeFilters.location !== "all" ? activeFilters.location : undefined,
    minPrice: activeFilters.minPrice,
    maxPrice: activeFilters.maxPrice
  }, {
    query: {
      queryKey: ["properties", activeFilters]
    }
  });
  const safeProperties = Array.isArray(properties) ? properties : [];

  const handleApplyFilters = () => {
    setActiveFilters({
      search,
      type,
      location: locationFilter,
      minPrice: priceRange[0],
      maxPrice: priceRange[1]
    });
  };

  const formatPrice = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} مليون`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)} ألف`;
    }
    return value.toString();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">تصفح العقارات</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <div className="bg-card border rounded-xl p-6 sticky top-24 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-lg font-bold border-b pb-4">
                <Filter className="w-5 h-5 text-primary" />
                <span>الفلاتر</span>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">كلمات البحث</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                    <Input 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ابحث..." 
                      className="pr-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع العقار</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="apartment">شقة</SelectItem>
                      <SelectItem value="villa">فيلا</SelectItem>
                      <SelectItem value="commercial">تجاري</SelectItem>
                      <SelectItem value="land">أرض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">المنطقة</label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المنطقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="القاهرة">القاهرة</SelectItem>
                      <SelectItem value="الجيزة">الجيزة</SelectItem>
                      <SelectItem value="التجمع الخامس">التجمع الخامس</SelectItem>
                      <SelectItem value="الشيخ زايد">الشيخ زايد</SelectItem>
                      <SelectItem value="المعادي">المعادي</SelectItem>
                      <SelectItem value="مدينة نصر">مدينة نصر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <label>السعر (ج.م)</label>
                  </div>
                  <Slider
                    defaultValue={[0, 50000000]}
                    max={50000000}
                    step={100000}
                    value={priceRange}
                    onValueChange={setPriceRange}
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{formatPrice(priceRange[0])}</span>
                    <span>{formatPrice(priceRange[1])}</span>
                  </div>
                </div>

                <Button className="w-full mt-4" onClick={handleApplyFilters}>
                  تطبيق الفلاتر
                </Button>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="mb-4 text-muted-foreground font-medium">
              {isLoading ? (
                "جاري البحث..."
              ) : (
                `تم العثور على ${safeProperties.length} عقار`
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : safeProperties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {safeProperties.map((prop) => (
                  <PropertyCard key={prop.id} property={prop} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] bg-muted/20 border border-dashed rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">لا توجد نتائج</h3>
                <p className="text-muted-foreground max-w-md">
                  لم نتمكن من العثور على عقارات تطابق بحثك. جرب تعديل الفلاتر أو كلمات البحث.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => {
                  setSearch("");
                  setType("all");
                  setLocationFilter("all");
                  setPriceRange([0, 50000000]);
                  setActiveFilters({
                    search: "",
                    type: "all",
                    location: "all",
                    minPrice: 0,
                    maxPrice: 50000000
                  });
                }}>
                  إعادة ضبط الفلاتر
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
