import { useParams } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProperty,
  useTrackInteraction,
  useGetSavedProperties,
  getGetPropertyQueryKey,
  getGetSavedPropertiesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, BedDouble, Maximize, Home, Heart, Phone, 
  Share2, ArrowRight, Loader2, Calendar, Eye
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { format } from "date-fns";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const trackMutation = useTrackInteraction();

  const { data: savedProperties } = useGetSavedProperties({
    query: {
      queryKey: getGetSavedPropertiesQueryKey(),
      enabled: !!user,
      staleTime: 60_000,
    },
  });
  const isSaved = savedProperties?.some((p) => p.id === propertyId) ?? false;

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const scrollTrackedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  
  const { data: property, isLoading, error } = useGetProperty(propertyId, {
    query: {
      enabled: !!propertyId,
      queryKey: getGetPropertyQueryKey(propertyId)
    }
  });

  useEffect(() => {
    if (property) {
      trackMutation.mutate({
        data: { propertyId: property.id, interactionType: "view" }
      });
    }
  }, [property?.id]);

  const handleScroll = useCallback(() => {
    if (scrollTrackedRef.current || !property) return;
    const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
    if (scrollPercent > 0.5) {
      scrollTrackedRef.current = true;
      trackMutation.mutate({
        data: { propertyId: property.id, interactionType: "scroll" }
      });
    }
  }, [property?.id]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const trackTimeSpent = () => {
      if (property) {
        const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (seconds >= 3) {
          trackMutation.mutate({
            data: { propertyId: property.id, interactionType: "time_spent", seconds }
          });
        }
      }
    };
    window.addEventListener("beforeunload", trackTimeSpent);
    return () => {
      window.removeEventListener("beforeunload", trackTimeSpent);
      trackTimeSpent();
    };
  }, [property?.id]);

  const handleSave = async () => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول لحفظ العقار", variant: "destructive" });
      return;
    }

    const currentlySaved = savedProperties?.some((p) => p.id === propertyId) ?? false;

    try {
      await trackMutation.mutateAsync({
        data: {
          propertyId,
          interactionType: currentlySaved ? "unsave" : "save",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetSavedPropertiesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(propertyId) });
      toast({
        title: currentlySaved ? "تم إزالة العقار من المحفوظات" : "تم حفظ العقار بنجاح",
      });
    } catch (err) {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleContact = async () => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول للتواصل مع البائع", variant: "destructive" });
      return;
    }
    
    try {
      await trackMutation.mutateAsync({
        data: { propertyId, interactionType: "contact" }
      });
      toast({ 
        title: "تم تسجيل طلب التواصل", 
        description: "سيتواصل معك البائع قريباً على رقم هاتفك" 
      });
    } catch (err) {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "تم نسخ رابط العقار" });
    } catch (err) {
      toast({ title: "لم يتم نسخ الرابط", variant: "destructive" });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const typeMap: Record<string, string> = {
    apartment: "شقة",
    villa: "فيلا",
    commercial: "تجاري",
    land: "أرض",
  };

  const propertyImages = property
    ? [
        ...new Set(
          ((property as { imageUrls?: string[] }).imageUrls ?? [])
            .concat(property.imageUrl ? [property.imageUrl] : [])
            .filter(Boolean),
        ),
      ]
    : [];

  useEffect(() => {
    if (!property) return;
    setActiveImage(propertyImages[0] ?? null);
  }, [property?.id]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <h1 className="text-3xl font-bold mb-4">العقار غير موجود</h1>
          <p className="text-muted-foreground mb-8">عذراً، لم نتمكن من العثور على العقار المطلوب.</p>
          <Button onClick={() => window.history.back()} className="gap-2">
            <ArrowRight className="w-4 h-4" /> العودة
          </Button>
        </div>
      </div>
    );
  }
  const displayedImage = activeImage ?? propertyImages[0] ?? null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Image Header */}
        <div className="w-full h-[45vh] md:h-[65vh] relative bg-black/90">
          {displayedImage ? (
            <img
              src={displayedImage}
              alt={property.title}
              className="w-full h-full object-contain"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="w-24 h-24 text-muted-foreground opacity-20" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-white">
            <div className="container mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4">
                <Badge className="bg-primary hover:bg-primary text-primary-foreground text-base px-4 py-1">
                  {typeMap[property.propertyType] || property.propertyType}
                </Badge>
                <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-md">
                  {property.title}
                </h1>
                <div className="flex items-center text-white/90 text-lg">
                  <MapPin className="w-5 h-5 mr-1 ml-2" />
                  {property.location}
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-white/80 mb-1">السعر المطلوب</p>
                <p className="text-4xl md:text-5xl font-bold text-white drop-shadow-md">
                  {formatPrice(property.price)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {propertyImages.length > 1 && (
          <div className="container mx-auto px-4 -mt-8 relative z-10">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {propertyImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    displayedImage === image
                      ? "border-primary"
                      : "border-white/60 hover:border-primary/70"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${property.title} ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">
              
              {/* Key Details Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-secondary/10 border-none shadow-none">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <Maximize className="w-8 h-8 text-primary mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">المساحة</p>
                    <p className="text-xl font-bold">{property.area} م²</p>
                  </CardContent>
                </Card>
                
                {property.rooms && (
                  <Card className="bg-secondary/10 border-none shadow-none">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                      <BedDouble className="w-8 h-8 text-primary mb-3" />
                      <p className="text-sm text-muted-foreground mb-1">الغرف</p>
                      <p className="text-xl font-bold">{property.rooms}</p>
                    </CardContent>
                  </Card>
                )}
                
                <Card className="bg-secondary/10 border-none shadow-none">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <Calendar className="w-8 h-8 text-primary mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">تاريخ الإضافة</p>
                    <p className="text-lg font-bold">{format(new Date(property.createdAt), "yyyy/MM/dd")}</p>
                  </CardContent>
                </Card>

                <Card className="bg-secondary/10 border-none shadow-none">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <Eye className="w-8 h-8 text-primary mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">المشاهدات</p>
                    <p className="text-xl font-bold">{property.views}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold border-b pb-4">وصف العقار</h2>
                <div className="prose prose-neutral dark:prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {property.description}
                </div>
              </div>

              {/* Features */}
              {property.features && property.features.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold border-b pb-4">المميزات والمرافق</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {property.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-6">
              <Card className="sticky top-24 border-primary/20 shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <Button 
                      size="lg" 
                      className="w-full text-lg h-14 gap-2"
                      onClick={handleContact}
                    >
                      <Phone className="w-5 h-5" />
                      تواصل مع البائع
                    </Button>
                    
                    <div className="flex gap-4">
                      <Button 
                        variant={isSaved ? "default" : "outline"} 
                        size="lg" 
                        className={`flex-1 h-14 gap-2 ${isSaved ? "bg-destructive hover:bg-destructive/90 text-white" : ""}`}
                        onClick={handleSave}
                      >
                        <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
                        {isSaved ? "محفوظ" : "حفظ العقار"}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="flex-1 h-14 gap-2"
                        onClick={handleShare}
                      >
                        <Share2 className="w-5 h-5" />
                        مشاركة
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-4">
                    <div className="p-3 bg-card rounded-full text-primary shadow-sm">
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold mb-1">ضمان عقاري</p>
                      <p className="text-sm text-muted-foreground">جميع العقارات المعروضة تم مراجعتها والتأكد من صحة بياناتها من قبل فريق عقاري.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
