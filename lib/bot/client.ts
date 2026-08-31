/**
 * Discord Bot Main Entry Point (discord.js v14)
 * Architecture: Slash Command Registry, Interaction Router, Error Handling
 */

export const discordBotMainCode = `import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  Events, 
  Collection, 
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction
} from 'discord.js';
import * as summonCommand from './commands/summon';
import * as servantCommand from './commands/servant';
import * as servantsCommand from './commands/servants';
import * as addservantCommand from './commands/addservant';
import * as duelCommand from './commands/duel';
import * as grailwarCommand from './commands/grailwar';
import * as attackCommand from './commands/attack';
import * as leakCommand from './commands/leak';
import * as customiseCommand from './commands/customise';
import { updateCustomDialogueQuotes, equipCraftEssence } from './engine/customization';
import { getOrCreateMaster, updateMasterProfile } from './database/service';

// Initialize Client with necessary Intents
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Command Collection
export const commands = new Collection<string, any>();
commands.set(summonCommand.data.name, summonCommand);
commands.set(servantCommand.data.name, servantCommand);
commands.set(servantsCommand.data.name, servantsCommand);
commands.set(addservantCommand.data.name, addservantCommand);
commands.set(duelCommand.data.name, duelCommand);
commands.set(grailwarCommand.data.name, grailwarCommand);
commands.set(attackCommand.data.name, attackCommand);
commands.set(leakCommand.data.name, leakCommand);
commands.set(customiseCommand.data.name, customiseCommand);

// Deploy Slash Commands to Discord Gateway
export async function registerSlashCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.warn('⚠️ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is missing in environment variables.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  try {
    console.log(\`🔄 Registering \${commandData.length} Slash Commands with Discord...\`);
    if (guildId) {
      // Instant Guild-scoped deployment
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(\`✅ Successfully registered commands to Guild: \${guildId}\`);
    } else {
      // Global deployment
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log('✅ Successfully registered global application commands.');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

// Event: Client Ready
client.once(Events.ClientReady, c => {
  console.log(\`🔥 Holy Grail War Discord Bot online as \${c.user.tag}!\`);
  c.user.setActivity('Fuyuki Holy Grail War | /summon', { type: 0 });
});

// Event: Interaction Create
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 1. Slash Command Router
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ ephemeral: true, content: 'Command not found.' });
        return;
      }
      await command.execute(interaction);
      return;
    }

    // 2. Modal Submission Router
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_quotes:')) {
        const servantId = interaction.customId.replace('modal_quotes:', '');
        const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
        const servant = master.servants.find(s => s.id === servantId);

        if (servant) {
          const summonQuote = interaction.fields.getTextInputValue('quote_summon');
          const npQuote = interaction.fields.getTextInputValue('quote_np');
          const victoryQuote = interaction.fields.getTextInputValue('quote_victory');

          servant.customQuotes = {
            ...servant.customQuotes,
            summon: summonQuote || servant.customQuotes.summon,
            noblePhantasm: npQuote || servant.customQuotes.noblePhantasm,
            victory: victoryQuote || servant.customQuotes.victory
          };

          await updateMasterProfile(master);

          await interaction.reply({
            ephemeral: true,
            content: \`✅ Custom quotes successfully saved for **\${servant.template.name}**!\`
          });
        }
      }
      return;
    }

    // 3. String Select Menu Router
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('select_ce:')) {
        const servantId = interaction.customId.replace('select_ce:', '');
        const selectedCeId = interaction.values[0];
        const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
        const servant = master.servants.find(s => s.id === servantId);

        if (servant) {
          equipCraftEssence(servant, selectedCeId);
          await updateMasterProfile(master);

          await interaction.reply({
            ephemeral: true,
            content: \`🛡️ Equipped **\${servant.equippedCe?.name}** to **\${servant.template.name}**!\`
          });
        }
      }
      return;
    }

  } catch (err: any) {
    console.error('Unhandled interaction error:', err);
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ephemeral: true, content: \`❌ Error: \${err.message}\` });
      } else {
        await interaction.reply({ ephemeral: true, content: \`❌ Error: \${err.message}\` });
      }
    }
  }
});

// Start the bot
export async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ DISCORD_BOT_TOKEN not provided. Bot cannot connect to Discord Gateway.');
    return;
  }
  await registerSlashCommands();
  await client.login(token);
}
`;
