import type { NextConfig } from "next";

/**
 * رؤوس أمان أساسية. ملاحظة: ما حطّيناش Content-Security-Policy كاملة لأنها محتاجة
 * nonce مع Next عشان ما تكسرش التشغيل؛ مدرجة كبند مفتوح في PROBLEMS.md.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // الميكروفون مطلوب للملاحظات الصوتية؛ باقي الصلاحيات الحساسة مقفولة
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
