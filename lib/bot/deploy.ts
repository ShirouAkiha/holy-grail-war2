/**
 * Standalone Slash Command Deployment Script (discord.js v14)
 * Run: bun src/deploy.ts or node dist/deploy.js
 */

export const deployScriptCode = `import { REST, Routes } from 'discord.js';
import * as summonCommand from './commands/summon';
import * as servantCommand from './commands/servant';
import * as servantsCommand from './commands/servants';
import * as addservantCommand from './commands/addservant';
import * as duelCommand from './commands/duel';
import * as grailwarCommand from './commands/grailwar';
import * as attackCommand from './commands/attack';
import * as leakCommand from './commands/leak';
import * as customiseCommand from './commands/customise';
import * as dailyCommand from './commands/daily';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is missing in .env');
  process.exit(1);
}

const commands = [
  summonCommand.data.toJSON(),
  servantCommand.data.toJSON(),
  servantsCommand.data.toJSON(),
  addservantCommand.data.toJSON(),
  duelCommand.data.toJSON(),
  grailwarCommand.data.toJSON(),
  attackCommand.data.toJSON(),
  leakCommand.data.toJSON(),
  customiseCommand.data.toJSON(),
  dailyCommand.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    const names = commands.map(c => \`/\${c.name}\`).join(', ');
    console.log(\`🔄 Deploying \${commands.length} Slash Commands [\${names}]...\`);

    if (guildId) {
      console.log(\`⚡ Target: Guild ID [\${guildId}] (Instant deployment)\`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(\`✅ Successfully deployed all commands to server [\${guildId}]!\`);
    } else {
      console.log('🌐 Target: Global Application Commands');
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Successfully deployed all global commands! (May take up to 1 hour to propagate globally. Provide DISCORD_GUILD_ID in .env for instant updates)');
    }
  } catch (error) {
    console.error('❌ Deployment error:', error);
  }
}

deploy();
`;
