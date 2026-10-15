"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { filterVerificationAnalytics } from "@/lib/auth/verification-privacy";

export function SiteAnalytics() {
  return <><Analytics beforeSend={filterVerificationAnalytics} /><SpeedInsights beforeSend={filterVerificationAnalytics} /></>;
}
