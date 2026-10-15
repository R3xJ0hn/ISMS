import { SCHOOL } from "@/lib/public/site";

export type PublicSiteSettings = {
  aboutTitle: string;
  aboutIntro: string;
  mission: string;
  vision: string;
  contactIntro: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  officeHours: string;
  mapUrl: string;
  facebookUrl: string;
  officialWebsiteUrl: string;
};

// Keep the site's existing information until an administrator saves settings.
export const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  aboutTitle: `About ${SCHOOL.name}`,
  aboutIntro:
    "We take pride in offering specialized academic programs designed to prepare students for real-world success. Though focused in scope, our programs are thoughtfully crafted to meet industry standards and equip learners with practical skills, technical competence, and professional confidence. Our passionate and experienced faculty members go beyond traditional teaching they mentor, guide, and inspire students to reach their full potential. With a supportive and dynamic learning environment, we ensure that every student receives personalized attention and meaningful educational experiences. At Datamex College of Saint Adeline, we don’t just educate—we empower. We prepare our students to stand out, adapt, and thrive in today’s competitive and ever-evolving professional landscape.",
  mission: "",
  vision: "",
  contactIntro: "Contact our team for admission inquiries, program information, and campus assistance.",
  contactEmail: SCHOOL.contact.email,
  contactPhone: SCHOOL.contact.phone,
  contactAddress: SCHOOL.contact.address,
  officeHours: "",
  mapUrl: SCHOOL.contact.map,
  facebookUrl: SCHOOL.contact.facebook,
  officialWebsiteUrl: SCHOOL.contact.officialWebsite,
};
