import 'dotenv/config';
const ids = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
export const config = {
  port: Number(process.env.PORT || 3000),
  botToken: process.env.BOT_TOKEN || '',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  adminIds: new Set(ids),
  adminChatId: process.env.ADMIN_CHAT_ID || '',
  seed: process.env.SEED_DEMO_DATA === 'true',
  checkoutEnabled: process.env.ENABLE_CHECKOUT === 'true' || (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CHECKOUT !== 'false'),
  requireVerifiedAge: process.env.REQUIRE_VERIFIED_AGE !== 'false' && process.env.NODE_ENV === 'production',
  devAuth: process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_ENABLED === 'true',
  bonusPercent: Number.isFinite(Number(process.env.BONUS_PERCENT)) && process.env.BONUS_PERCENT ? Math.min(100,Math.max(0,Number(process.env.BONUS_PERCENT))) : 5
};
export function validateConfig() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  if (process.env.NODE_ENV === 'production') {
    if (!config.botToken) throw new Error('BOT_TOKEN is required in production');
    if (!config.publicUrl.startsWith('https://')) throw new Error('PUBLIC_URL must be a full HTTPS URL in production');
    if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
    if (config.webhookSecret.length < 16) throw new Error('WEBHOOK_SECRET must contain at least 16 characters');
  }
}
