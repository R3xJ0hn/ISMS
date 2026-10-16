/**
 * Edit classroom banner and student thumbnail colors here.
 * These palettes apply to both teacher and student portals.
 *
 * Replace a color, or add/remove entries to change the available choices.
 * Write complete Tailwind classes as shown below; keep at least one entry.
 * Save to preview during development. Rebuild for production changes.
 * Each class/student keeps a consistent choice based on its saved ID.
 */

// BANNER BACKGROUNDS
// Change the hex code inside bg-[#......]. Banner text is white.
// Example: "bg-[#7b6785]" gives a muted purple background.
export const classBannerColors = [
  "bg-[#374352]", 
  "bg-[#42334F]",
  "bg-[#7D1616]",
  "bg-[#326625]", 
  "bg-[#DE7E21]", 
  "bg-[#274E54]", 
  "bg-[#424254]", 
  "bg-[#4E068C]", 
  "bg-[#4D302A]", 
  "bg-[#075482]", 
  "bg-[#3D4347]", 
  "bg-[#C2195E]", 
] as const;

// STUDENT THUMBNAILS WITHOUT PHOTOS
// Each entry sets the background (bg-...) and initials (text-...) together.
// Use Tailwind shades, or custom hex codes:
// "bg-[#fce7f3] text-[#831843]" gives a pastel pink background with dark text.
export const studentThumbnailColors = [
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
] as const;

// Shared selection logic; edit the palettes above to customize the colors.
function colorForId(colors: readonly string[], id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length] ?? "bg-slate-700 text-white";
}

export function classCoverTheme(classId: string) {
  return colorForId(classBannerColors, classId);
}

export function studentThumbnailColor(studentId: string) {
  return colorForId(studentThumbnailColors, studentId);
}
