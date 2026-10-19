export function isVerificationPath(pathname: string) {
  return pathname === "/verify-email" || pathname === "/verify-email/" ||
    pathname === "/forgot-password" || pathname === "/forgot-password/" ||
    pathname === "/reset-password" || pathname === "/reset-password/" ||
    pathname === "/teacher/activate" || pathname === "/teacher/activate/" ||
    pathname === "/admission/update" || pathname.startsWith("/admission/update/");
}

export function isAnalyticsExcludedPath(pathname: string) {
  return isVerificationPath(pathname) || pathname === "/portal/employees" || pathname.startsWith("/portal/employees/") ||
    pathname === "/portal/dashboard" || pathname.startsWith("/portal/dashboard/") ||
    pathname === "/portal/users" || pathname.startsWith("/portal/users/") ||
    pathname === "/portal/students" || pathname.startsWith("/portal/students/") ||
    pathname === "/portal/teachers" || pathname.startsWith("/portal/teachers/") ||
    pathname === "/portal/classes" || pathname.startsWith("/portal/classes/") ||
    pathname === "/portal/my-classes" || pathname.startsWith("/portal/my-classes/") ||
    pathname === "/portal/classroom" || pathname.startsWith("/portal/classroom/") ||
    pathname === "/portal/admission-review" || pathname.startsWith("/portal/admission-review/") ||
    pathname === "/portal/last-schools" || pathname.startsWith("/portal/last-schools/") ||
    pathname === "/portal/information" || pathname.startsWith("/portal/information/");
}

export function filterVerificationAnalytics<T extends { url: string }>(event: T): T | null {
  try {
    return isAnalyticsExcludedPath(new URL(event.url, "https://local.invalid").pathname) ? null : event;
  } catch {
    return null;
  }
}
