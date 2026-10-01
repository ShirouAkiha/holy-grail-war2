import { startBot } from './src/index';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN) {
      console.log('🤖 Initializing Discord Bot via Next.js instrumentation...');
      startBot().catch(err => {
        console.error('❌ Discord Bot failed to start:', err);
      });
    }
  }
}
