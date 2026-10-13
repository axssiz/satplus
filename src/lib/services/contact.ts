/** `tel:` link: digits and a leading plus only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+0-9]/g, "")}`;
}

/**
 * WhatsApp chat link for a Kazakhstan number written the usual local ways
 * (+7 …, 8 …, or 10 digits without the code). Returns null when the number cannot be normalised.
 */
export function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  else if (digits.length === 10) digits = `7${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}
