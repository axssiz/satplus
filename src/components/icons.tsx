import {
  Apple,
  Baby,
  BadgePercent,
  Banknote,
  BedDouble,
  Beef,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  Candy,
  Car,
  Croissant,
  CupSoda,
  Drama,
  Droplets,
  Dumbbell,
  GraduationCap,
  Landmark,
  Megaphone,
  Milk,
  Newspaper,
  Package,
  Pill,
  Scissors,
  ShoppingBag,
  SprayCan,
  Star,
  Stethoscope,
  Tag,
  TriangleAlert,
  Utensils,
  Wheat,
  Wrench,
  Hammer,
  Zap,
  WashingMachine,
  Smartphone,
  Sparkles,
  Truck,
  Camera,
  PartyPopper,
  Shirt,
  Factory,
  HardHat,
  Calculator,
  Monitor,
  Shield,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement } from "react";
import type { SectionIcon } from "@/config/sections";

const SECTION_ICONS: Record<SectionIcon, LucideIcon> = {
  tag: Tag,
  newspaper: Newspaper,
  "badge-percent": BadgePercent,
  "building-2": Building2,
  wrench: Wrench,
  briefcase: Briefcase,
  megaphone: Megaphone,
  "calendar-days": CalendarDays,
  bus: Bus,
  "triangle-alert": TriangleAlert,
  star: Star,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  milk: Milk,
  croissant: Croissant,
  wheat: Wheat,
  apple: Apple,
  beef: Beef,
  "cup-soda": CupSoda,
  candy: Candy,
  "spray-can": SprayCan,
  droplets: Droplets,
  baby: Baby,
};

export function sectionIcon(name: SectionIcon): LucideIcon {
  return SECTION_ICONS[name];
}

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Package;
}

const BUSINESS_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-bag": ShoppingBag,
  pill: Pill,
  stethoscope: Stethoscope,
  landmark: Landmark,
  banknote: Banknote,
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  scissors: Scissors,
  car: Car,
  wrench: Wrench,
  drama: Drama,
  "bed-double": BedDouble,
  "building-2": Building2,
};

/** Icon for a directory category (`business_categories.icon`); unknown names get a building. */
export function businessIcon(name: string | null | undefined): LucideIcon {
  return (name && BUSINESS_ICONS[name]) || Building2;
}

export const BUSINESS_ICON_NAMES = Object.keys(BUSINESS_ICONS);

/** Renders a directory category icon by name (a stable component, so it can be used directly in render). */
export function BusinessIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  return createElement(businessIcon(name), props);
}

const SERVICE_ICONS: Record<string, LucideIcon> = {
  hammer: Hammer,
  droplets: Droplets,
  zap: Zap,
  "washing-machine": WashingMachine,
  smartphone: Smartphone,
  sparkles: Sparkles,
  truck: Truck,
  car: Car,
  scissors: Scissors,
  "graduation-cap": GraduationCap,
  camera: Camera,
  "party-popper": PartyPopper,
  shirt: Shirt,
  wrench: Wrench,
};

export const SERVICE_ICON_NAMES = Object.keys(SERVICE_ICONS);

/** Renders a service category icon by name (`service_categories.icon`); unknown names get a wrench. */
export function ServiceIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  return createElement((name && SERVICE_ICONS[name]) || Wrench, props);
}

const JOB_ICONS: Record<string, LucideIcon> = {
  "shopping-bag": ShoppingBag,
  utensils: Utensils,
  factory: Factory,
  truck: Truck,
  "hard-hat": HardHat,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  calculator: Calculator,
  monitor: Monitor,
  scissors: Scissors,
  wrench: Wrench,
  shield: Shield,
  car: Car,
  briefcase: Briefcase,
};

export const JOB_ICON_NAMES = Object.keys(JOB_ICONS);

/** Renders a job category icon by name (`job_categories.icon`); unknown names get a briefcase. */
export function JobIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  return createElement((name && JOB_ICONS[name]) || Briefcase, props);
}
