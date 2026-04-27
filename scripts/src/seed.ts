import bcrypt from "bcryptjs";
import mongoose, { Schema, model } from "mongoose";

const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
const dbName = process.env.MONGODB_DB_NAME || "aqary";

if (!mongoUri) {
  throw new Error("MONGODB_URI (or DATABASE_URL) is required for seeding.");
}

const counterSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

const userSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: null },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
      default: "buyer",
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const userPreferenceSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    preferredLocation: { type: String, default: null },
    maxBudget: { type: Number, default: null },
    preferredType: { type: String, default: null },
    preferredFeatures: { type: [String], required: true, default: [] },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const propertySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    area: { type: Number, required: true },
    rooms: { type: Number, default: null },
    propertyType: {
      type: String,
      enum: ["apartment", "villa", "commercial", "land"],
      required: true,
    },
    features: { type: [String], required: true, default: [] },
    imageUrl: { type: String, default: null },
    sellerId: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    views: { type: Number, required: true, default: 0 },
    saves: { type: Number, required: true, default: 0 },
    contacts: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const CounterModel = model("Counter", counterSchema);
const UserModel = model("User", userSchema);
const UserPreferenceModel = model("UserPreference", userPreferenceSchema);
const PropertyModel = model("Property", propertySchema);

async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return counter!.seq;
}

async function seed() {
  await mongoose.connect(mongoUri, { dbName });
  console.log("Seeding database...");

  const adminHash = await bcrypt.hash("admin123", 10);
  const sellerHash = await bcrypt.hash("seller123", 10);
  const buyerHash = await bcrypt.hash("buyer123", 10);

  const existingSeller = await UserModel.findOne({ email: "seller@aqary.com" }).lean();
  if (existingSeller) {
    console.log("Users already exist, skipping seed.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const admin = await UserModel.create({
    id: await nextSequence("users"),
    name: "مدير النظام",
    email: "admin@aqary.com",
    passwordHash: adminHash,
    role: "admin",
    phone: "01000000000",
  });
  const seller = await UserModel.create({
    id: await nextSequence("users"),
    name: "أحمد محمد",
    email: "seller@aqary.com",
    passwordHash: sellerHash,
    role: "seller",
    phone: "01111111111",
  });
  const buyer = await UserModel.create({
    id: await nextSequence("users"),
    name: "سارة أحمد",
    email: "buyer@aqary.com",
    passwordHash: buyerHash,
    role: "buyer",
    phone: "01222222222",
  });

  await UserPreferenceModel.create([
    { id: await nextSequence("userPreferences"), userId: admin.id },
    { id: await nextSequence("userPreferences"), userId: seller.id },
    {
      id: await nextSequence("userPreferences"),
      userId: buyer.id,
      preferredLocation: "القاهرة",
      maxBudget: 2000000,
      preferredType: "apartment",
      preferredFeatures: ["مصعد", "أمن", "موقف سيارات"],
    },
  ]);

  const properties = [
    {
      title: "شقة فاخرة في التجمع الخامس",
      description: "شقة 3 غرف نوم بتشطيب سوبر لوكس في قلب التجمع الخامس، قريبة من الجامعة الأمريكية والخدمات الأساسية.",
      price: 1800000,
      location: "التجمع الخامس",
      area: 180,
      rooms: 3,
      propertyType: "apartment" as const,
      features: ["مصعد", "أمن", "موقف سيارات", "تكييف مركزي"],
      imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "فيلا مستقلة في الشيخ زايد",
      description: "فيلا مستقلة 5 غرف نوم مع حديقة خاصة ومسبح في كمبوند راقي بالشيخ زايد.",
      price: 8500000,
      location: "الشيخ زايد",
      area: 450,
      rooms: 5,
      propertyType: "villa" as const,
      features: ["مسبح", "حديقة", "أمن", "موقف سيارات", "تكييف مركزي"],
      imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "شقة بإطلالة بحرية في الإسكندرية",
      description: "شقة أمام البحر مباشرة في سيدي جابر، 2 غرف نوم مع بلكونة واسعة وإطلالة خلابة على البحر.",
      price: 1200000,
      location: "الإسكندرية",
      area: 120,
      rooms: 2,
      propertyType: "apartment" as const,
      features: ["إطلالة بحرية", "شرفة", "مصعد"],
      imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "محل تجاري في وسط القاهرة",
      description: "محل تجاري 80 متر في شارع رئيسي بوسط البلد، مناسب لجميع الأنشطة التجارية.",
      price: 3500000,
      location: "القاهرة",
      area: 80,
      rooms: null,
      propertyType: "commercial" as const,
      features: ["موقف سيارات", "أمن"],
      imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "شقة في المعادي الجديدة",
      description: "شقة 2 غرف نوم بتشطيب كامل في المعادي الجديدة، قريبة من المترو والمدارس.",
      price: 950000,
      location: "المعادي",
      area: 100,
      rooms: 2,
      propertyType: "apartment" as const,
      features: ["مصعد", "أمن"],
      imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "أرض للبيع في 6 أكتوبر",
      description: "قطعة أرض 500 متر مربع في منطقة سكنية هادئة بمدينة 6 أكتوبر، مناسبة للبناء السكني.",
      price: 2200000,
      location: "6 أكتوبر",
      area: 500,
      rooms: null,
      propertyType: "land" as const,
      features: [],
      imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "شقة بنتهاوس في الساحل الشمالي",
      description: "بنتهاوس فاخر 4 غرف نوم مع تراس واسع وإطلالة مباشرة على البحر في الساحل الشمالي.",
      price: 5500000,
      location: "الساحل الشمالي",
      area: 250,
      rooms: 4,
      propertyType: "apartment" as const,
      features: ["إطلالة بحرية", "شرفة", "مسبح", "أمن", "تكييف مركزي"],
      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
      sellerId: seller.id,
      status: "approved" as const,
    },
    {
      title: "شقة معلقة - بانتظار الموافقة",
      description: "شقة جديدة لم تتم الموافقة عليها بعد.",
      price: 1500000,
      location: "الجيزة",
      area: 150,
      rooms: 3,
      propertyType: "apartment" as const,
      features: ["مصعد"],
      imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
      sellerId: seller.id,
      status: "pending" as const,
    },
  ];

  const propertyDocs = [];
  for (const property of properties) {
    propertyDocs.push({
      id: await nextSequence("properties"),
      ...property,
    });
  }
  await PropertyModel.insertMany(propertyDocs);

  console.log("Seed complete!");
  console.log("Admin: admin@aqary.com / admin123");
  console.log("Seller: seller@aqary.com / seller123");
  console.log("Buyer: buyer@aqary.com / buyer123");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
