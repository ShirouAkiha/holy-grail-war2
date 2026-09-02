import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  Events, 
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import * as summonCommand from './commands/summon';
import * as servantCommand from './commands/servant';
import * as servantsCommand from './commands/servants';
import * as duelCommand from './commands/duel';
import * as grailwarCommand from './commands/grailwar';
import * as defensesCommand from './commands/defenses';
import * as profileCommand from './commands/profile';
import * as attackCommand from './commands/attack';
import * as leakCommand from './commands/leak';
import * as customiseCommand from './commands/customise';
import * as addservantCommand from './commands/addservant';
import * as cegachaCommand from './commands/cegacha';
import * as addceCommand from './commands/addce';
import { getOrCreateMaster, saveMaster } from './database/service';
import { CRAFT_ESSENCE_DATABASE } from './data/craftEssences';
import { buildProfileEmbed, buildProfileButtons } from './commands/profile';
import { buildDefensesEmbed, buildDefensesButtons } from './commands/defenses';
import { buildWarEmbed, buildWarButtons } from './commands/grailwar';
import { 
  getOrInitWarSession, 
  executeWarAction, 
  patrolCityInWar, 
  simulateWarSkirmish,
  disarmChannelTrapsInWar,
  recallFamiliarsInWar
} from './engine/grailwar';

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
commands.set(servantsCommand.data.name, servantsCommand);
commands.set(duelCommand.data.name, duelCommand);
commands.set(grailwarCommand.data.name, grailwarCommand);
commands.set(defensesCommand.data.name, defensesCommand);
commands.set(profileCommand.data.name, profileCommand);
commands.set(attackCommand.data.name, attackCommand);
commands.set(leakCommand.data.name, leakCommand);
commands.set(customiseCommand.data.name, customiseCommand);
commands.set(addservantCommand.data.name, addservantCommand);
commands.set(cegachaCommand.data.name, cegachaCommand);
commands.set(addceCommand.data.name, addceCommand);

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
    const names = Array.from(commands.keys()).map(n => `/${n}`).join(', ');
    console.log(`🔄 Registering ${commandData.length} Slash Commands with Discord [${names}]...`);
    
    // If DISCORD_GUILD_ID is provided, register commands immediately to that specific test server.
    // (Guild commands update instantly, whereas global commands can take up to an hour to cache).
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(`✅ Successfully registered ${commandData.length} commands to Guild [${guildId}] (Instant availability).`);
    } else {
      // Otherwise, register globally to all servers where the bot is installed.
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log(`✅ Successfully registered ${commandData.length} global application commands.`);
      console.log('💡 Note: Global commands can take up to 1 hour to propagate. Add DISCORD_GUILD_ID to .env for 0-second instant updates, then press Ctrl+R in Discord.');
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
    // ROUTE 0: Autocomplete (e.g. searching servants in /addservant or /servants)
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command && typeof (command as any).autocomplete === 'function') {
        await (command as any).autocomplete(interaction);
      }
      return;
    }

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

    // ROUTE D: Button Component Interactions
    if (interaction.isButton()) {
      if (interaction.replied || interaction.deferred) return;

      const btnId = interaction.customId;
      const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
      let war = getOrInitWarSession(master);
      const isCivilian = !master.servants || master.servants.length === 0;

      // Profile Buttons
      if (btnId === 'war_my_profile' || btnId === 'profile_refresh') {
        if (isCivilian) {
          await interaction.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }
        const uP = war.participants[interaction.user.id];
        const embed = buildProfileEmbed(master, war, btnId === 'profile_refresh' ? '🔄 Profile refreshed.' : undefined);
        const btns = buildProfileButtons(uP);
        if (btnId === 'war_my_profile') {
          await interaction.reply({ embeds: [embed], components: btns, ephemeral: true });
        } else {
          await interaction.update({ embeds: [embed], components: btns });
        }
        return;
      }

      if (btnId.startsWith('profile_ward_') || btnId === 'profile_toggle_evade' || btnId === 'profile_heal') {
        if (isCivilian) {
          await interaction.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }

        let msg = '';
        if (btnId === 'profile_ward_none') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'none');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'profile_ward_ward') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'ward');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'profile_ward_alarm') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'alarm');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'profile_toggle_evade') {
          const curP = war.participants[interaction.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(war, interaction.user.id, 'toggle_evade', newMode);
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'profile_heal') {
          const res = executeWarAction(war, interaction.user.id, 'rest_and_heal');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        }

        const uP = war.participants[interaction.user.id];
        await interaction.update({ embeds: [buildProfileEmbed(master, war, msg)], components: buildProfileButtons(uP) });
        return;
      }

      // Defenses Buttons
      if (btnId === 'war_defenses' || btnId === 'war_refresh_defenses') {
        if (isCivilian) {
          await interaction.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }
        const uP = war.participants[interaction.user.id];
        const embed = buildDefensesEmbed(uP, btnId === 'war_refresh_defenses' ? '🔄 Workshop settings refreshed.' : undefined);
        const btns = buildDefensesButtons(uP);
        if (btnId === 'war_defenses') {
          await interaction.reply({ embeds: [embed], components: btns, ephemeral: true });
        } else {
          await interaction.update({ embeds: [embed], components: btns });
        }
        return;
      }

      if (btnId.startsWith('ward_') || btnId === 'toggle_auto_evade') {
        if (isCivilian) {
          await interaction.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }

        let msg = '';
        if (btnId === 'ward_none') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'none');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'ward_ward') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'ward');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'ward_alarm') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'alarm');
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'toggle_auto_evade') {
          const curP = war.participants[interaction.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(war, interaction.user.id, 'toggle_evade', newMode);
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        }

        const uP = war.participants[interaction.user.id];
        await interaction.update({ embeds: [buildDefensesEmbed(uP, msg)], components: buildDefensesButtons(uP) });
        return;
      }

      // War Board Buttons
      if (btnId === 'war_patrol') {
        const chanTag = interaction.channel && 'name' in interaction.channel ? `#${(interaction.channel as any).name}` : '#general';
        const res = patrolCityInWar(war, interaction.user.id, interaction.user.username, chanTag);
        const uP = res.updatedWar.participants[interaction.user.id];
        await interaction.update({ embeds: [buildWarEmbed(res.updatedWar, uP, res.message)], components: [buildWarButtons()] });
        return;
      }

      if (btnId === 'war_skirmish') {
        const chanTag = interaction.channel && 'name' in interaction.channel ? `#${(interaction.channel as any).name}` : '#general';
        const res = simulateWarSkirmish(war, chanTag);
        const uP = res.updatedWar.participants[interaction.user.id];
        await interaction.update({ embeds: [buildWarEmbed(res.updatedWar, uP, res.message)], components: [buildWarButtons()] });
        return;
      }

      if (btnId === 'war_refresh' || btnId === 'war_status_board' || btnId === 'quick_war_status') {
        const uP = war.participants[interaction.user.id];
        const embed = buildWarEmbed(war, uP, '🔄 Intelligence Board refreshed.');
        const btns = [buildWarButtons()];
        if (btnId === 'quick_war_status') {
          await interaction.reply({ embeds: [embed], components: btns, ephemeral: true });
        } else {
          await interaction.update({ embeds: [embed], components: btns });
        }
        return;
      }

      if (btnId === 'disarm_all_traps') {
        const res = disarmChannelTrapsInWar(war, interaction.user.id);
        war = res.updatedWar;
        await saveMaster(master);
        const disarmEmbed = new EmbedBuilder()
          .setTitle('🧹 Bounded Fields Dissolved')
          .setDescription(res.message)
          .setColor(0x10b981);
        await interaction.update({ embeds: [disarmEmbed], components: [] });
        return;
      }

      if (btnId === 'recall_all_familiars') {
        const res = recallFamiliarsInWar(war, interaction.user.id);
        war = res.updatedWar;
        await saveMaster(master);
        const recallEmbed = new EmbedBuilder()
          .setTitle('🕊️ Familiars Recalled')
          .setDescription(res.message)
          .setColor(0x0ea5e9);
        await interaction.update({ embeds: [recallEmbed], components: [] });
        return;
      }

      if (btnId === 'war_familiars_hub') {
        if (isCivilian) {
          await interaction.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }
        const userFamiliars = (war.familiars || []).filter(f => f.masterId === interaction.user.id);
        let desc = '';
        if (userFamiliars.length === 0) {
          desc = 'You currently have **no active familiars** dispatched in Fuyuki City.\n\nUse `/grailwar familiar` to deploy Scouting Ravens, Homunculus Decoys, or Shadow Imps!';
        } else {
          desc = `You currently command **${userFamiliars.length}/2** active familiars stationed across Fuyuki:\n\n` +
            userFamiliars.map((f, idx) => {
              const typeLabel = f.familiarType === 'raven'
                ? '🦅 **Scouting Raven** (Surveillance)'
                : f.familiarType === 'homunculus'
                ? '🗿 **Homunculus Decoy** (Ambush Shield)'
                : '🦇 **Shadow Imp** (Sabotage & Siphon)';
              const intelLogs = (f.detectedIntel && f.detectedIntel.length > 0)
                ? `\n  ↳ **Surveillance Logs:**\n  ${f.detectedIntel.slice(0, 3).join('\n  ')}`
                : `\n  ↳ *No movement observed yet.*`;
              return `**${idx + 1}. Sector ${f.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(f.createdAt / 1000)}:R>*${intelLogs}`;
            }).join('\n\n');
        }

        const famsEmbed = new EmbedBuilder()
          .setTitle('🦅 Active Familiar Reconnaissance Network')
          .setDescription(desc)
          .setColor(0x0ea5e9)
          .setFooter({ text: 'Familiars gather intelligence and shield their Masters' });

        const row = new ActionRowBuilder<ButtonBuilder>();
        if (userFamiliars.length > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('recall_all_familiars')
              .setLabel('Recall All Familiars')
              .setEmoji('🕊️')
              .setStyle(ButtonStyle.Danger)
          );
        }
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('war_status_board')
            .setLabel('Grail War Status')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [famsEmbed], components: [row], ephemeral: true });
        return;
      }

      // Navigation Shortcuts
      if (btnId === 'go_summon' || btnId === 'quick_summon_ritual') {
        await interaction.reply({
          content: '✨ Use the `/summon ritual` slash command to invoke the Throne of Heroes and contract a Servant!',
          ephemeral: true
        });
        return;
      }

      if (btnId === 'quick_start_duel' || btnId === 'quick_duel_ai') {
        await interaction.reply({
          content: '⚔️ Use `/duel` to enter the battle arena or challenge another Master with `/duel opponent:@Master`!',
          ephemeral: true
        });
        return;
      }
    }

  } catch (err: any) {
    // Catch-all error safety net to prevent bot crashing on unexpected Discord API exceptions
    if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) {
      return; // Token expired or already acknowledged; silently ignore
    }
    console.error('Unhandled interaction error:', err);
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ ephemeral: true, content: `❌ Error: ${err.message}` });
        } else {
          await interaction.reply({ ephemeral: true, content: `❌ Error: ${err.message}` });
        }
      }
    } catch {}
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
