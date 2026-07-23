// ─── lib/lead-utils.ts — lead-pipeline helpers ────────────────────────
//
// The survivors of src/lib/fub.ts, extracted when Follow Up Boss was
// deleted from the consumer sites (Patrick 2026-07-23). Nothing here
// touches FUB — this is the bot filter that gates every form submission.

export function botScore(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
}): number {
  let score = 0;
  const words = [data.firstName, data.lastName].filter(Boolean) as string[];
  for (const word of words) {
    if (word.length > 12) score += 30;
    const internalUpper = (word.slice(1).match(/[A-Z]/g) || []).length;
    if (internalUpper >= 3) score += 40;
  }
  if (data.email) {
    const local = data.email.split('@')[0];
    if ((local.match(/\./g) || []).length >= 3) score += 30;
  }
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) score += 20;
  }
  if (data.message && /[^\x20-\x7E]/.test(data.message)) score += 40;
  return score;
}

export function isBot(data: Parameters<typeof botScore>[0]): boolean {
  return botScore(data) >= 50;
}
