import { z } from "zod";

export const PACK_UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export const PHOTO_KINDS = ["price_tag", "receipt", "shelf"] as const;
export const REPORT_REASONS = ["wrong_price", "wrong_info", "duplicate", "outdated", "other"] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const decimal = z.coerce.number().refine((n) => Number.isFinite(n), "invalid");

/** Date in YYYY-MM-DD, not in the future (Almaty time) and not older than 30 days. */
export function isAllowedObservedDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const today = almatyDate(now);
  const min = almatyDate(new Date(now.getTime() - 30 * 86_400_000));
  return value <= today && value >= min;
}

export function almatyDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(d);
}

export const priceSubmissionSchema = z
  .object({
    productId: z.uuid(),
    branchId: z.uuid(),
    kind: z.enum(["new", "confirm"]).default("new"),
    price: decimal.pipe(z.number().min(1).max(1_000_000)),
    packQuantity: z
      .union([z.literal(""), decimal.pipe(z.number().positive().max(100_000))])
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    packUnit: z
      .union([z.literal(""), z.enum(PACK_UNITS)])
      .optional()
      .transform((v) => (v ? v : undefined)),
    brandLabel: optionalText(80),
    observedDate: z.string().refine((v) => isAllowedObservedDate(v), "dateRange"),
    comment: optionalText(500),
    consent: z.literal("on", { error: "consent" }),
    photoKind: z.enum(PHOTO_KINDS).optional(),
    photoRedacted: z.enum(["0", "1"]).optional(),
  })
  .refine((v) => (v.packQuantity === undefined) === (v.packUnit === undefined), {
    path: ["packQuantity"],
    message: "packRequired",
  });

export type PriceSubmissionInput = z.input<typeof priceSubmissionSchema>;

export const reportSchema = z.object({
  targetType: z.enum(["product", "verified_price", "store_branch"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  message: optionalText(1000),
});

export const priceRequestSchema = z.object({
  productId: z.uuid(),
  branchId: z.uuid().optional(),
});

/** Checks the real file signature, not just the declared type. */
export function sniffImageType(bytes: Uint8Array): (typeof PHOTO_TYPES)[number] | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "url");

/** Reader suggestion of a news item (public form). */
export const newsSuggestionSchema = z.object({
  title: z.string().trim().min(5, "titleLength").max(200, "titleLength"),
  body: z.string().trim().min(20, "bodyLength").max(5000, "bodyLength"),
  categoryId: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((v) => (v ? v : undefined)),
  sourceUrl: httpsUrl,
  contact: optionalText(120),
  consent: z.literal("on", { error: "consent" }),
});

export type NewsSuggestionInput = z.input<typeof newsSuggestionSchema>;

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Article as edited by staff in the admin panel. */
export const newsArticleSchema = z
  .object({
    id: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .transform((v) => (v ? v : undefined)),
    submissionId: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .transform((v) => (v ? v : undefined)),
    slug: z.string().trim().regex(/^[a-z0-9-]{2,120}$/, "Слаг: латиница, цифры и дефис, 2–120 символов"),
    title: z.string().trim().min(5, "Заголовок: от 5 до 200 символов").max(200, "Заголовок: от 5 до 200 символов"),
    summary: optionalText(400),
    body: z.string().trim().min(20, "Текст: минимум 20 символов").max(20000, "Текст: не больше 20 000 символов"),
    lang: z.enum(["ru", "kk"]).default("ru"),
    categoryId: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .transform((v) => (v ? v : undefined)),
    sourceName: z.string().trim().min(2, "Укажите источник").max(120),
    sourceUrl: httpsUrl,
    coverAlt: optionalText(200),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    publishedAt: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), "Неверная дата публикации"),
    isImportant: checkbox,
    isSponsored: checkbox,
    removeCover: checkbox,
  });

export type NewsArticleInput = z.input<typeof newsArticleSchema>;

/** `datetime-local` value (Almaty wall time, no offset) → ISO string. */
export function almatyLocalToIso(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return new Date(`${value.length === 16 ? `${value}:00` : value}+05:00`).toISOString();
  }
  return new Date(value).toISOString();
}

/** ISO → `datetime-local` value in Almaty wall time. */
export function isoToAlmatyLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "date");
const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Reader report of a promotion seen in a store (public form). */
export const promotionReportSchema = z
  .object({
    storeSlug: z
      .union([z.literal(""), z.string().regex(/^[a-z0-9-]{2,64}$/)])
      .optional()
      .transform((v) => (v ? v : undefined)),
    storeText: optionalText(120),
    title: z.string().trim().min(5, "titleLength").max(160, "titleLength"),
    details: optionalText(2000),
    endsOn: z
      .union([z.literal(""), isoDate])
      .optional()
      .transform((v) => (v ? v : undefined)),
    sourceUrl: httpsUrl,
    contact: optionalText(120),
    consent: z.literal("on", { error: "consent" }),
  })
  .refine((v) => v.storeSlug || v.storeText, { message: "store", path: ["store"] });

/** Promotion as edited by staff in the admin panel. */
export const promotionSchema = z
  .object({
    id: optionalUuid,
    submissionId: optionalUuid,
    slug: z.string().trim().regex(/^[a-z0-9-]{2,120}$/, "Слаг: латиница, цифры и дефис, 2–120 символов"),
    storeId: z.uuid("Выберите магазин"),
    branchId: optionalUuid,
    categoryId: optionalUuid,
    title: z.string().trim().min(5, "Название: от 5 до 160 символов").max(160, "Название: от 5 до 160 символов"),
    description: optionalText(4000),
    discountLabel: optionalText(40),
    conditions: optionalText(1000),
    startsOn: z
      .union([z.literal(""), isoDate])
      .optional()
      .transform((v) => (v ? v : undefined)),
    endsOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату окончания"),
    sourceName: z.string().trim().min(2, "Укажите источник").max(120),
    sourceUrl: httpsUrl,
    coverAlt: optionalText(200),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    isSponsored: checkbox,
    removeCover: checkbox,
  })
  .refine((v) => !v.startsOn || v.startsOn <= v.endsOn, { message: "Дата начала позже даты окончания", path: ["startsOn"] });

export type PromotionInput = z.input<typeof promotionSchema>;

const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\+?[0-9 ()-]{6,24}$/.test(v), "Телефон: цифры, пробелы, скобки, дефис и +, от 6 символов");

const coordinate = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));

/** Reader suggests a new organisation or a correction to a published one (public form). */
export const businessSuggestionSchema = z
  .object({
    kind: z.enum(["new", "correction"]),
    businessSlug: z
      .union([z.literal(""), z.string().regex(/^[a-z0-9-]{2,120}$/)])
      .optional()
      .transform((v) => (v ? v : undefined)),
    name: optionalText(120),
    categoryId: optionalUuid,
    address: optionalText(200),
    phone: optionalText(40),
    website: httpsUrl,
    openingHours: optionalText(300),
    details: optionalText(2000),
    isOwner: checkbox,
    contact: optionalText(120),
    consent: z.literal("on", { error: "consent" }),
  })
  .refine((v) => v.kind !== "new" || (v.name && v.name.length >= 2), { message: "name", path: ["name"] })
  .refine((v) => v.kind !== "correction" || (v.details && v.details.length >= 5), { message: "details", path: ["details"] })
  .refine((v) => v.kind !== "correction" || v.businessSlug, { message: "notFound", path: ["businessSlug"] });

/** Organisation as edited by staff in the admin panel. */
export const businessSchema = z
  .object({
    id: optionalUuid,
    submissionId: optionalUuid,
    slug: z.string().trim().regex(/^[a-z0-9-]{2,120}$/, "Слаг: латиница, цифры и дефис, 2–120 символов"),
    name: z.string().trim().min(2, "Название: от 2 до 120 символов").max(120, "Название: от 2 до 120 символов"),
    categoryId: optionalUuid,
    description: optionalText(2000),
    address: optionalText(200),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
    phone: phone,
    phoneAlt: phone,
    website: httpsUrl,
    socialUrl: httpsUrl,
    openingHours: optionalText(300),
    coverAlt: optionalText(200),
    sourceName: z.string().trim().min(2, "Укажите, откуда данные").max(120),
    verified: checkbox,
    lastVerifiedAt: z
      .union([z.literal(""), isoDate])
      .optional()
      .transform((v) => (v ? v : undefined)),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    isSponsored: checkbox,
    removeCover: checkbox,
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: "Укажите обе координаты или ни одной",
    path: ["latitude"],
  })
  .refine((v) => !v.verified || v.lastVerifiedAt, { message: "Для отметки «проверено» укажите дату проверки", path: ["lastVerifiedAt"] });

export type BusinessInput = z.input<typeof businessSchema>;

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
export const LISTING_COMPLAINT_REASONS = ["fraud", "spam", "wrong_contacts", "not_actual", "offensive", "other"] as const;

const requiredPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,24}$/, "phone");

/** Listing a provider publishes about their own services (public form; error codes are message keys). */
export const serviceListingSchema = z.object({
  id: optionalUuid,
  categoryId: z.uuid("category"),
  title: z.string().trim().min(5, "title").max(120, "title"),
  providerName: z.string().trim().min(2, "providerName").max(80, "providerName"),
  description: z.string().trim().min(20, "description").max(3000, "description"),
  priceNote: optionalText(120),
  area: optionalText(120),
  phone: requiredPhone,
  hasWhatsapp: checkbox,
  linkUrl: httpsUrl,
  removeCover: checkbox,
  consent: z.literal("on", { error: "consent" }),
});

/** Listing as edited by staff (admin panel, Russian messages). */
export const staffServiceListingSchema = z.object({
  id: optionalUuid,
  slug: z.string().trim().regex(/^[a-z0-9-]{2,110}$/, "Слаг: латиница, цифры и дефис, 2–110 символов"),
  categoryId: z.uuid("Выберите категорию"),
  title: z.string().trim().min(5, "Заголовок: от 5 до 120 символов").max(120, "Заголовок: от 5 до 120 символов"),
  providerName: z.string().trim().min(2, "Имя мастера: от 2 до 80 символов").max(80, "Имя мастера: от 2 до 80 символов"),
  description: z.string().trim().min(20, "Описание: от 20 символов").max(3000, "Описание: до 3000 символов"),
  priceNote: optionalText(120),
  area: optionalText(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/, "Телефон: цифры, пробелы, скобки, дефис и +, от 6 символов"),
  hasWhatsapp: checkbox,
  linkUrl: httpsUrl,
  coverAlt: optionalText(200),
  sourceName: optionalText(120),
  status: z.enum(["pending", "published", "archived"]).default("published"),
  expiresOn: z
    .union([z.literal(""), isoDate])
    .optional()
    .transform((v) => (v ? v : undefined)),
  isSponsored: checkbox,
  removeCover: checkbox,
});

export const listingComplaintSchema = z.object({
  listingSlug: z.string().regex(/^[a-z0-9-]{2,120}$/),
  reason: z.enum(LISTING_COMPLAINT_REASONS, { error: "reason" }),
  message: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export const EMPLOYMENT_TYPES = ["full", "part", "shift", "temporary", "internship"] as const;
export const EXPERIENCE_LEVELS = ["any", "none", "1_3", "3_plus"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Monthly salary in tenge as typed («150 000»); empty means «not stated». */
const optionalSalary = (message: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[\s ₸]/g, ""))
    .refine((v) => v === "" || /^[0-9]{1,8}$/.test(v), message)
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (v >= 1 && v <= 10_000_000), message);

const optionalEmail = (message: string) =>
  z
    .string()
    .trim()
    .max(254, message)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), message)
    .transform((v) => (v ? v : undefined));

function jobFields(m: {
  category: string;
  title: string;
  employerName: string;
  description: string;
  phone: string;
  salary: string;
  email: string;
  contactName: string;
}) {
  return {
    id: optionalUuid,
    categoryId: z.uuid(m.category),
    title: z.string().trim().min(3, m.title).max(120, m.title),
    employerName: z.string().trim().min(2, m.employerName).max(120, m.employerName),
    employmentType: z.enum(EMPLOYMENT_TYPES).default("full"),
    experience: z.enum(EXPERIENCE_LEVELS).default("any"),
    schedule: optionalText(120),
    salaryFrom: optionalSalary(m.salary),
    salaryTo: optionalSalary(m.salary),
    salaryNote: optionalText(120),
    description: z.string().trim().min(20, m.description).max(5000, m.description),
    address: optionalText(200),
    contactName: z
      .string()
      .trim()
      .max(80, m.contactName)
      .optional()
      .refine((v) => !v || v.length >= 2, m.contactName)
      .transform((v) => (v ? v : undefined)),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/, m.phone),
    hasWhatsapp: checkbox,
    email: optionalEmail(m.email),
    linkUrl: httpsUrl,
  };
}

const salaryOrder = <T extends { salaryFrom?: number; salaryTo?: number }>(v: T) =>
  v.salaryFrom === undefined || v.salaryTo === undefined || v.salaryFrom <= v.salaryTo;

/** Vacancy an employer publishes themselves (public form; error codes are message keys). */
export const jobListingSchema = z
  .object({
    ...jobFields({
      category: "category",
      title: "title",
      employerName: "employerName",
      description: "description",
      phone: "phone",
      salary: "salary",
      email: "email",
      contactName: "contactName",
    }),
    consent: z.literal("on", { error: "consent" }),
  })
  .refine(salaryOrder, { message: "salaryOrder", path: ["salaryTo"] });

/** Vacancy as edited by staff (admin panel, Russian messages). */
export const staffJobListingSchema = z
  .object({
    ...jobFields({
      category: "Выберите категорию",
      title: "Должность: от 3 до 120 символов",
      employerName: "Работодатель: от 2 до 120 символов",
      description: "Описание: от 20 до 5000 символов",
      phone: "Телефон: цифры, пробелы, скобки, дефис и +, от 6 символов",
      salary: "Зарплата: целое число в тенге до 10 000 000",
      email: "Проверьте адрес почты",
      contactName: "Контактное лицо: от 2 до 80 символов",
    }),
    slug: z.string().trim().regex(/^[a-z0-9-]{2,110}$/, "Слаг: латиница, цифры и дефис, 2–110 символов"),
    sourceName: optionalText(120),
    status: z.enum(["pending", "published", "archived"]).default("published"),
    expiresOn: z
      .union([z.literal(""), isoDate])
      .optional()
      .transform((v) => (v ? v : undefined)),
    isSponsored: checkbox,
  })
  .refine(salaryOrder, { message: "Зарплата «от» больше, чем «до»", path: ["salaryTo"] });
