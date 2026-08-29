import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  Events, 
  Collection
} from 'discord.js';
import * as summonCommand from './commands/summon';
import * as servantCommand from './commands/servant';
import * as duelCommand from './commands/duel';
import * as grailwarCommand from './commands/grailwar';
import * as customiseCommand from './commands/customise';
import { getOrCreateMaster, saveMaster } from './database/service';
import { CRAFT_ESSENCE_DATABASE } from './data/craftEssences';

// ==========================================
// 1. DISCORD CLIENT INITIALIZATION
// ==========================================
// Setup the Discord Client with the permissions (Intents) needed to interact with guilds,
// read messages, and access member profiles.
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ==========================================
// 2. COMMAND REGISTRY MAP
// ==========================================
// We store all slash command modules in a Discord.js Collection (a Map structure).
// This allows the interaction listener to look up commands in O(1) time by commandName.
export const commands = new Collection<string, any>();
commands.set(summonCommand.data.name, summonCommand);
commands.set(servantCommand.data.name, servantCommand);
commands.set(duelCommand.data.name, duelCommand);
commands.set(grailwarCommand.data.name, grailwarCommand);
commands.set(customiseCommand.data.name, customiseCommand);

// ==========================================
// 3. SLASH COMMAND DEPLOYMENT TO DISCORD API
// ==========================================
// Sends our command definitions (/summon, /duel, etc.) to Discord's servers so Discord
// displays them in the user's slash command autocomplete menu.
export async function registerSlashCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  // If credentials are not set, stop gracefully without crashing the app.
  if (!token || !clientId) {
    console.warn('⚠️ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is missing in environment variables.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  try {
    console.log(`🔄 Registering ${commandData.length} Slash Commands with Discord...`);
    
    // If DISCORD_GUILD_ID is provided, register commands immediately to that specific test server.
    // (Guild commands update instantly, whereas global commands can take up to an hour to cache).
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(`✅ Successfully registered commands to Guild: ${guildId}`);
    } else {
      // Otherwise, register globally to all servers where the bot is installed.
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log('✅ Successfully registered global application commands.');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

// ==========================================
// 4. CLIENT READY EVENT
// ==========================================
// Triggered once when the bot successfully logs in and connects to Discord Gateway.
client.once(Events.ClientReady, c => {
  console.log(`🔥 Holy Grail War Discord Bot online as ${c.user.tag}!`);
  // Set Discord presence/status message
  c.user.setActivity('Fuyuki Holy Grail War | /summon', { type: 0 });
});

// ==========================================
// 5. GLOBAL INTERACTION ROUTER
// ==========================================
// Central dispatcher that catches all user actions (Slash commands, Modal popups, Dropdowns).
client.on(Events.InteractionCreate, async interaction => {
  try {
    // ROUTE A: Slash Command execution (e.g. user typed /summon or /duel)
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ ephemeral: true, content: 'Command not found.' });
        return;
      }
      // Execute the command's main handler
      await command.execute(interaction);
      return;
    }

    // ROUTE B: Modal Text Popup Submission (e.g. user typed custom quotes in /customise quote)
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_quotes:')) {
        // Extract the servant ID from the customId string (format: "modal_quotes:servant_id")
        const servantId = interaction.customId.replace('modal_quotes:', '');
        const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
        const servant = master.servants?.find((s: any) => s.id === servantId);

        if (servant) {
          // Read the text values typed into the modal input boxes
          const summonQuote = interaction.fields.getTextInputValue('quote_summon');
          const npQuote = interaction.fields.getTextInputValue('quote_np');
          const victoryQuote = interaction.fields.getTextInputValue('quote_victory');

          // Update servant quotes (keep existing quote if the user left a field blank)
          servant.customQuotes = {
            ...servant.customQuotes,
            summon: summonQuote || servant.customQuotes.summon,
            noblePhantasm: npQuote || servant.customQuotes.noblePhantasm,
            victory: victoryQuote || servant.customQuotes.victory
          };

          // Save back to master database
          await saveMaster(master);

          await interaction.reply({
            ephemeral: true,
            content: `✅ Custom quotes successfully saved for **${servant.template.name}**!`
          });
        }
      }
      return;
    }

    // ROUTE C: Select Dropdown Menus (e.g. equipping Craft Essence from /customise equip)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('select_ce:')) {
        const servantId = interaction.customId.replace('select_ce:', '');
        const selectedCeId = interaction.values[0]; // The ID of the chosen Craft Essence
        const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
        const servant = master.servants?.find((s: any) => s.id === servantId);

        if (servant) {
          const pickedCe = CRAFT_ESSENCE_DATABASE.find(c => c.id === selectedCeId);
          if (pickedCe) {
            // Attach CE to the active servant
            servant.equippedCeId = pickedCe.id;
            servant.equippedCe = pickedCe;
            await saveMaster(master);

            await interaction.reply({
              ephemeral: true,
              content: `🛡️ Equipped **${pickedCe.name}** to **${servant.template.name}**!`
            });
          }
        }
      }
      return;
    }

  } catch (err: any) {
    // Catch-all error safety net to prevent bot crashing on unexpected Discord API exceptions
    console.error('Unhandled interaction error:', err);
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ephemeral: true, content: `❌ Error: ${err.message}` });
      } else {
        await interaction.reply({ ephemeral: true, content: `❌ Error: ${err.message}` });
      }
    }
  }
});

// ==========================================
// 6. BOT STARTUP WRAPPER
// ==========================================
export async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ DISCORD_BOT_TOKEN not provided. Bot cannot connect to Discord Gateway.');
    return;
  }
  // Register slash commands first, then log in
  await registerSlashCommands();
  await client.login(token);
}

// Auto-start if running in Node environment with DISCORD_BOT_TOKEN defined
if (process.env.DISCORD_BOT_TOKEN) {
  startBot();
}
