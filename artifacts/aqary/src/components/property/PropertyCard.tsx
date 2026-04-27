import { useQueryClient } from "@tanstack/react-query";
import {
  PropertyItem,
  RecommendedProperty,
  useTrackInteraction,
  useGetSavedProperties,
  getGetSavedPropertiesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, BedDouble, Maximize, Home, Phone } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface PropertyCardProps {
  property: PropertyItem | RecommendedProperty;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const { toast } = useToast();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const trackMutation = useTrackInteraction();
  const { data: savedProperties } = useGetSavedProperties({
    query: {
      queryKey: getGetSavedPropertiesQueryKey(),
      enabled: !!token,
      staleTime: 60_000,
    },
  });
  const isSaved = savedProperties?.some((p) => p.id === property.id) ?? false;
  const isRecommended = "matchScore" in property;

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!token) {
      toast({ title: "يرجى تسجيل الدخول لحفظ العقار", variant: "destructive" });
      return;
    }

    try {
      await trackMutation.mutateAsync({
        data: {
          propertyId: property.id,
          interactionType: isSaved ? "unsave" : "save",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetSavedPropertiesQueryKey() });
      toast({
        title: isSaved ? "تمت إزالة العقار من المحفوظات" : "تم حفظ العقار بنجاح",
      });
    } catch (err) {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleContact = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await trackMutation.mutateAsync({
        data: { propertyId: property.id, interactionType: "contact" }
      });
      toast({ title: "تم تسجيل طلب التواصل", description: "سنتواصل معك قريباً" });
    } catch (err) {
      toast({ title: "حدث خطأ", variant: "destructive" });
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

  return (
    <Card className="overflow-hidden hover-elevate transition-all group flex flex-col h-full border-border/50 shadow-sm">
      <Link href={`/property/${property.id}`} className="flex-1 flex flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {property.imageUrl ? (
            <img
              src={property.imageUrl}
              alt={property.title}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              <Home className="w-12 h-12 opacity-20" />
            </div>
          )}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-foreground">
              {typeMap[property.propertyType] || property.propertyType}
            </Badge>
            {isRecommended && (
              <Badge variant="default" className="bg-primary/90 backdrop-blur-sm">
                مقترح لك {property.matchScore}%
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 hover:text-destructive text-foreground"
            onClick={handleToggleSave}
          >
            <Heart className={`w-5 h-5 ${isSaved ? "fill-destructive text-destructive" : ""}`} />
          </Button>
        </div>

        <CardHeader className="p-4 pb-2 flex-none">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                {property.title}
              </h3>
              <div className="flex items-center text-muted-foreground mt-1 text-sm">
                <MapPin className="w-4 h-4 mr-1 ml-1" />
                <span className="line-clamp-1">{property.location}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 flex-1">
          <p className="text-xl font-bold text-primary mb-4">
            {formatPrice(property.price)}
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {property.rooms && (
              <div className="flex items-center gap-1">
                <BedDouble className="w-4 h-4" />
                <span>{property.rooms} غرف</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Maximize className="w-4 h-4" />
              <span>{property.area} م²</span>
            </div>
          </div>

          {isRecommended && property.matchReasons && property.matchReasons.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {property.matchReasons.slice(0, 2).map((reason, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] bg-secondary/30">
                  {reason}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-0 border-t border-border/50 mt-auto">
          <Button className="w-full gap-2 mt-4" onClick={handleContact}>
            <Phone className="w-4 h-4" />
            تواصل مع البائع
          </Button>
        </CardFooter>
      </Link>
    </Card>
  );
}
