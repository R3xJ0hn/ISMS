export function safeEmailHref(value: string) {
  const email = value.trim();

  if (
    email.length > 254 ||
    /[\u0000-\u001f\u007f]/.test(email) ||
    !/^[a-z\d.!#$%&'*+/=?^_{}|~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*\.[a-z]{2,}$/i.test(email)
  ) {
    return "";
  }

  return `mailto:${encodeURIComponent(email).replace(/%40/gi, "@")}`;
}

export function safePhoneHref(value: string) {
  const phone = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(phone)) return "";

  const number = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{3,15}$/.test(number) ? `tel:${number}` : "";
}
