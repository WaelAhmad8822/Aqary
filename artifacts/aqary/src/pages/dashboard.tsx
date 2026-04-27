import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import {
  useGetMyProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  getGetMyPropertiesQueryKey,
} from "@workspace/api-client-react";
import type { CreatePropertyBody } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Home, Eye, Heart, Phone, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";

const AMENITY_OPTIONS = [
  "موقف سيارات",
  "مصعد",
  "مسبح",
  "أمن 24 ساعة",
  "تكييف مركزي",
  "مفروش",
  "شرفة",
  "حديقة",
];

const propertySchema = z.object({
  title: z.string().min(5, "العنوان يجب أن يكون 5 أحرف على الأقل"),
  description: z.string().min(20, "الوصف يجب أن يكون 20 حرفاً على الأقل"),
  price: z.coerce.number().min(1, "السعر مطلوب"),
  location: z.string().min(3, "المنطقة مطلوبة"),
  area: z.coerce.number().min(1, "المساحة مطلوبة"),
  rooms: z.coerce.number().optional(),
  propertyType: z.enum(["apartment", "villa", "commercial", "land"]),
  amenities: z.array(z.string()).optional(),
  imageUrl1: z.string().url("رابط الصورة الأولى غير صحيح").optional().or(z.literal("")),
  imageUrl2: z.string().url("رابط الصورة الثانية غير صحيح").optional().or(z.literal("")),
  imageUrl3: z.string().url("رابط الصورة الثالثة غير صحيح").optional().or(z.literal("")),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function Dashboard() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties, isLoading } = useGetMyProperties({
    query: {
      queryKey: getGetMyPropertiesQueryKey()
    }
  });

  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();
  const deleteMutation = useDeleteProperty();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      propertyType: "apartment",
      amenities: [],
      imageUrl1: "",
      imageUrl2: "",
      imageUrl3: "",
    },
  });

  const openEditDialog = (prop: {
    id: number;
    title: string;
    description: string;
    price: number;
    location: string;
    area: number;
    rooms?: number | null;
    propertyType: string;
    features?: string[];
    imageUrl?: string | null;
    imageUrls?: string[];
  }) => {
    const images = prop.imageUrls && prop.imageUrls.length > 0
      ? prop.imageUrls
      : (prop.imageUrl ? [prop.imageUrl] : []);
    setEditingPropertyId(prop.id);
    form.reset({
      title: prop.title,
      description: prop.description,
      price: prop.price,
      location: prop.location,
      area: prop.area,
      rooms: prop.rooms ?? undefined,
      propertyType: prop.propertyType as "apartment" | "villa" | "commercial" | "land",
      amenities: prop.features || [],
      imageUrl1: images[0] || "",
      imageUrl2: images[1] || "",
      imageUrl3: images[2] || "",
    });
    setIsAddDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingPropertyId(null);
    form.reset({
      title: "",
      description: "",
      location: "",
      propertyType: "apartment",
      amenities: [],
      imageUrl1: "",
      imageUrl2: "",
      imageUrl3: "",
    });
    setIsAddDialogOpen(true);
  };

  const invalidateProperties = () => {
    queryClient.invalidateQueries({ queryKey: getGetMyPropertiesQueryKey() });
  };

  const onSubmit = async (values: PropertyFormValues) => {
    const imageUrls = [values.imageUrl1, values.imageUrl2, values.imageUrl3]
      .map((url) => (url || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const features = (values.amenities || []).slice(0, 20);
    const payload = {
      title: values.title,
      description: values.description,
      price: values.price,
      location: values.location,
      area: values.area,
      rooms: values.rooms,
      propertyType: values.propertyType,
      features,
      imageUrl: imageUrls[0] || undefined,
      imageUrls,
    };

    try {
      if (editingPropertyId) {
        await updateMutation.mutateAsync({
          id: editingPropertyId,
          data: payload,
        });
        toast({ title: "تم تحديث العقار بنجاح" });
      } else {
        await createMutation.mutateAsync({
          data: payload as CreatePropertyBody
        });
        toast({ title: "تم إضافة العقار بنجاح" });
      }
      setIsAddDialogOpen(false);
      setEditingPropertyId(null);
      form.reset();
      invalidateProperties();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleDelete = async (propertyId: number) => {
    try {
      await deleteMutation.mutateAsync({ id: propertyId });
      toast({ title: "تم حذف العقار بنجاح" });
      invalidateProperties();
    } catch {
      toast({ title: "حدث خطأ أثناء الحذف", variant: "destructive" });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const statusMap: Record<string, { label: string, color: string }> = {
    pending: { label: "قيد المراجعة", color: "text-amber-500 bg-amber-500/10" },
    approved: { label: "معتمد", color: "text-emerald-500 bg-emerald-500/10" },
    rejected: { label: "مرفوض", color: "text-destructive bg-destructive/10" },
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 container px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">لوحة التحكم</h1>
            <p className="text-muted-foreground">إدارة عقاراتك ومتابعة أداء الإعلانات</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setEditingPropertyId(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openAddDialog} data-testid="button-add-property">
                <Plus className="w-5 h-5" /> إعلان جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPropertyId ? "تعديل العقار" : "إضافة عقار جديد"}</DialogTitle>
                <DialogDescription>{editingPropertyId ? "عدّل تفاصيل العقار." : "أدخل تفاصيل العقار لنشره على المنصة."}</DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عنوان الإعلان</FormLabel>
                        <FormControl><Input {...field} data-testid="input-property-title" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="propertyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>النوع</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-property-type">
                                <SelectValue placeholder="اختر النوع" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="apartment">شقة</SelectItem>
                              <SelectItem value="villa">فيلا</SelectItem>
                              <SelectItem value="commercial">تجاري</SelectItem>
                              <SelectItem value="land">أرض</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المنطقة</FormLabel>
                          <FormControl><Input {...field} data-testid="input-property-location" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>السعر</FormLabel>
                          <FormControl><Input type="number" {...field} data-testid="input-property-price" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="area"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المساحة</FormLabel>
                          <FormControl><Input type="number" {...field} data-testid="input-property-area" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الغرف</FormLabel>
                          <FormControl><Input type="number" {...field} data-testid="input-property-rooms" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الوصف</FormLabel>
                        <FormControl><Textarea className="resize-none" rows={4} {...field} data-testid="input-property-description" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amenities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المرافق</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {AMENITY_OPTIONS.map((amenity) => {
                            const checked = field.value?.includes(amenity);
                            return (
                              <label
                                key={amenity}
                                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!checked}
                                  onChange={(e) => {
                                    const value = field.value || [];
                                    if (e.target.checked) {
                                      field.onChange([...value, amenity]);
                                    } else {
                                      field.onChange(value.filter((v: string) => v !== amenity));
                                    }
                                  }}
                                />
                                <span>{amenity}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          اختر المرافق المتوفرة في العقار (يمكن اختيار أكثر من خيار).
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageUrl1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رابط الصورة الأولى (اختياري)</FormLabel>
                        <FormControl><Input dir="ltr" className="text-right" {...field} data-testid="input-property-image" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imageUrl2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رابط الصورة الثانية (اختياري)</FormLabel>
                        <FormControl><Input dir="ltr" className="text-right" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imageUrl3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رابط الصورة الثالثة (اختياري)</FormLabel>
                        <FormControl><Input dir="ltr" className="text-right" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isMutating} className="w-full" data-testid="button-submit-property">
                      {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingPropertyId ? "حفظ التعديلات" : "نشر العقار"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-primary-foreground/80 mb-1">إجمالي العقارات</p>
                  <p className="text-3xl font-bold" data-testid="text-total-properties">{properties?.length || 0}</p>
                </div>
                <div className="p-3 bg-primary-foreground/20 rounded-lg">
                  <Home className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground mb-1">إجمالي المشاهدات</p>
                  <p className="text-3xl font-bold">{properties?.reduce((acc, p) => acc + p.views, 0) || 0}</p>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Eye className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground mb-1">المهتمين (حفظ)</p>
                  <p className="text-3xl font-bold">{properties?.reduce((acc, p) => acc + p.saves, 0) || 0}</p>
                </div>
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
                  <Heart className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground mb-1">طلبات التواصل</p>
                  <p className="text-3xl font-bold">{properties?.reduce((acc, p) => acc + p.contacts, 0) || 0}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <Phone className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-2xl font-bold mb-4 border-b pb-2">عقاراتي</h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : properties && properties.length > 0 ? (
          <div className="space-y-4">
            {properties.map(prop => (
              <Card key={prop.id} className="overflow-hidden flex flex-col sm:flex-row" data-testid={`card-property-${prop.id}`}>
                <div className="sm:w-48 h-48 sm:h-auto bg-muted relative shrink-0">
                  {prop.imageUrl ? (
                    <img
                      src={prop.imageUrl}
                      alt={prop.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Home className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${statusMap[prop.status]?.color}`}>
                      {statusMap[prop.status]?.label || prop.status}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold line-clamp-1">{prop.title}</h3>
                      <div className="flex items-center gap-2 shrink-0 mr-4">
                        <p className="font-bold text-primary whitespace-nowrap">{formatPrice(prop.price)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(prop)}
                          data-testid={`button-edit-${prop.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              data-testid={`button-delete-${prop.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>هل أنت متأكد من حذف هذا العقار؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف "{prop.title}" نهائياً ولا يمكن التراجع عن هذا الإجراء.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(prop.id)}
                                className="bg-destructive hover:bg-destructive/90"
                                data-testid={`button-confirm-delete-${prop.id}`}
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{prop.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Eye className="w-3 h-3"/> المشاهدات</span>
                      <span className="font-semibold">{prop.views}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Heart className="w-3 h-3"/> المفضلات</span>
                      <span className="font-semibold">{prop.saves}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3 h-3"/> التواصل</span>
                      <span className="font-semibold text-emerald-600">{prop.contacts}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="py-20 text-center bg-muted/20 border-dashed">
            <CardContent>
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">لا توجد لديك إعلانات عقارية بعد</p>
              <p className="text-muted-foreground mb-6">ابدأ بنشر أول عقار لك الآن للوصول إلى آلاف المشترين</p>
              <Button onClick={openAddDialog} data-testid="button-add-first-property">إضافة عقار جديد</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
