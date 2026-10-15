import Navbar from "@/components/public/navbar";
import Footer from "@/components/public/footer";
import type { ReactNode } from "react";
import { getPublicSiteSettings } from "@/lib/site-settings/service";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSiteSettings();

  return (
    <>
      <Navbar settings={settings} />
      <main>{children}</main>
      <Footer settings={settings} />
    </>
  );
}
