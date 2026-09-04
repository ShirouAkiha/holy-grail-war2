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
  ButtonStyle,
  AttachmentBuilder
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
import * as adminCommand from './commands/admin';
import * as cegachaCommand from './commands/cegacha';
import * as addceCommand from './commands/addce';
import * as addsqCommand from './commands/addsq';
import * as churchCommand from './commands/church';
import * as sanctuaryCommand from './commands/sanctuary';
import * as patrolCommand from './commands/patrol';
import * as familiarCommand from './commands/familiar';
import * as trapCommand from './commands/trap';
import * as healCommand from './commands/heal';
import * as inventoryCommand from './commands/inventory';
import * as equipCommand from './commands/equip';
import * as boastCommand from './commands/boast';
import * as dailyCommand from './commands/daily';
import * as claimCommand from './commands/claim';
import { getOrCreateMaster, saveMaster, getAllThroneServants, findServantInPool, searchAndRankServants, claimDailySaintQuartz } from './database/service';
import { CRAFT_ESSENCE_DATABASE } from './data/craftEssences';
import { getNoblePhantasmGif, getNoblePhantasmChant } from './data/noblePhantasmGifs';
import { renderServantProfileCard, renderDialogueCard } from './canvas/renderer';
import { buildProfileEmbed, buildProfileButtons } from './commands/profile';
import { buildDailyEmbed, buildDailyButtons } from './commands/daily';
import { buildDefensesEmbed, buildDefensesButtons } from './commands/defenses';
import { buildChurchEmbed, buildChurchButtons } from './commands/church';
import { buildWarEmbed, buildWarButtons } from './commands/grailwar';
import { handleGlobalInventoryInteraction } from './commands/customise';
import { 
  buildServantFullProfileEmbed,
  buildServantArtworkEmbed,
  buildNoblePhantasmEmbed,
  buildNoblePhantasmActions,
  buildProfileActions,
  buildListEmbed,
  buildServantButtons,
  buildServantsListUI,
  setupServantListCollector,
  createServantTempInstance
} from './commands/servants';
import { 
  getOrInitWarSession, 
  executeWarAction, 
  patrolCityInWar, 
  simulateWarSkirmish,
  disarmChannelTrapsInWar,
  recallFamiliarsInWar,
  enterChurchSanctuary,
  leaveChurchSanctuary
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
commands.set(adminCommand.data.name, adminCommand);
commands.set(cegachaCommand.data.name, cegachaCommand);
commands.set(addceCommand.data.name, addceCommand);
commands.set(addsqCommand.data.name, addsqCommand);
commands.set(churchCommand.data.name, churchCommand);
commands.set(sanctuaryCommand.data.name, sanctuaryCommand);
commands.set(patrolCommand.data.name, patrolCommand);
commands.set(familiarCommand.data.name, familiarCommand);
commands.set(trapCommand.data.name, trapCommand);
commands.set(healCommand.data.name, healCommand);
commands.set(inventoryCommand.data.name, inventoryCommand);
commands.set(equipCommand.data.name, equipCommand);
commands.set(boastCommand.data.name, boastCommand);
commands.set(dailyCommand.data.name, dailyCommand);
commands.set(claimCommand.data.name, claimCommand);

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
        try {
          await (command as any).autocomplete(interaction);
        } catch (err: any) {
          if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) {
            return; // Normal Discord keystroke debounce timeout
          }
          console.warn(`Autocomplete warning for /${interaction.commandName}:`, err?.message || err);
        }
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

    // ROUTE C: Select Dropdown Menus (e.g. equipping Craft Essence from /customise equip or /inventory)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'inv_select_item' || interaction.customId.startsWith('inv_')) {
        await handleGlobalInventoryInteraction(interaction);
        return;
      }

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

      // Daily Claim Buttons
      if (btnId === 'quick_daily_claim' || btnId === 'daily_claim') {
        const result = await claimDailySaintQuartz(interaction.user.id, interaction.user.username);
        const embed = buildDailyEmbed(interaction.user, result);
        const buttons = buildDailyButtons(result);
        await interaction.reply({ embeds: [embed], components: [buttons] });
        return;
      }

      // Inventory Buttons
      if (btnId.startsWith('inv_')) {
        await handleGlobalInventoryInteraction(interaction);
        return;
      }

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

      if (btnId.startsWith('ward_') || btnId === 'toggle_auto_evade' || btnId === 'church_enter' || btnId === 'church_leave') {
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
        } else if (btnId === 'church_enter') {
          const res = enterChurchSanctuary(war, interaction.user.id);
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        } else if (btnId === 'church_leave') {
          const res = leaveChurchSanctuary(war, interaction.user.id);
          war = res.updatedWar;
          msg = res.message;
          await saveMaster(master);
        }

        const uP = war.participants[interaction.user.id];
        const isChurchMsg = interaction.message?.embeds?.[0]?.title?.includes('Church');
        if (isChurchMsg) {
          await interaction.update({ embeds: [buildChurchEmbed(uP, msg)], components: buildChurchButtons(uP) });
        } else {
          await interaction.update({ embeds: [buildDefensesEmbed(uP, msg)], components: buildDefensesButtons(uP) });
        }
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

      if (btnId === 'war_refresh_church') {
        const uP = war.participants[interaction.user.id];
        const embed = buildChurchEmbed(uP, '🔄 Sanctuary records verified with Father Kotomine.');
        const btns = buildChurchButtons(uP);
        await interaction.update({ embeds: [embed], components: btns });
        return;
      }

      if (btnId === 'quick_war_defenses') {
        const uP = war.participants[interaction.user.id];
        const embed = buildDefensesEmbed(uP);
        const btns = buildDefensesButtons(uP);
        await interaction.reply({ embeds: [embed], components: btns, ephemeral: true });
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

      // Navigation & Servant Interactive Buttons
      if (btnId.startsWith('view_servant_')) {
        const servantId = btnId.replace('view_servant_', '');
        const allServants = getAllThroneServants();
        const target = allServants.find(s => s.id === servantId);
        if (target) {
          await interaction.deferReply();
          const profileEmbed = buildServantFullProfileEmbed(target);
          const artworkEmbed = buildServantArtworkEmbed(target);
          const actions = buildProfileActions(target.id);

          const files: AttachmentBuilder[] = [];
          try {
            const tempInstance = createServantTempInstance(target);
            const cardBuffer = await renderServantProfileCard(tempInstance, 'Throne of Heroes');
            if (cardBuffer && cardBuffer.length > 500) {
              files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
            }
          } catch (e) {
            console.warn('Canvas render error in button view_servant:', e);
          }

          await interaction.editReply({ 
            embeds: [profileEmbed, artworkEmbed], 
            files,
            components: [actions] 
          });
        } else {
          await interaction.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (btnId.startsWith('view_np_')) {
        const servantId = btnId.replace('view_np_', '');
        const allServants = getAllThroneServants();
        const target = allServants.find(s => s.id === servantId);
        if (target) {
          const npEmbed = buildNoblePhantasmEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await interaction.reply({ embeds: [npEmbed], components: [actions] });
        } else {
          await interaction.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (btnId.startsWith('view_art_')) {
        const servantId = btnId.replace('view_art_', '');
        const allServants = getAllThroneServants();
        const target = allServants.find(s => s.id === servantId);
        if (target) {
          const artEmbed = buildServantArtworkEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await interaction.reply({ embeds: [artEmbed], components: [actions] });
        } else {
          await interaction.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (btnId.startsWith('quote_servant_')) {
        const servantId = btnId.replace('quote_servant_', '');
        const allServants = getAllThroneServants();
        const target = allServants.find(s => s.id === servantId);
        if (target) {
          const quoteEmbed = new EmbedBuilder()
            .setTitle(`💬 ${target.name} — Dialogue Line`)
            .setDescription(`*"${target.summonQuote || target.battleStartQuote}"*`)
            .setColor(0xd4af37)
            .setFooter({ text: `${target.title} • Class: ${target.servantClass}` });
          await interaction.reply({ embeds: [quoteEmbed] });
        } else {
          await interaction.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (btnId === 'btn_back_servants_list' || btnId === 'btn_show_servants_list') {
        const allServants = getAllThroneServants();
        const listEmbed = buildListEmbed(
          allServants.slice(0, 15),
          `📜 Throne of Heroes Registry (${allServants.length} Servants)`,
          `Click any Servant's button below to display their full profile:`
        );
        const rows = buildServantButtons(allServants.slice(0, 10));
        await interaction.reply({ embeds: [listEmbed], components: rows });
        return;
      }

      if (btnId === 'view_active_np') {
        const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
        if (activeServant) {
          const template = activeServant.template;
          const npEmbed = buildNoblePhantasmEmbed(template);
          const actions = buildNoblePhantasmActions(template.id);
          await interaction.reply({ embeds: [npEmbed], components: [actions] });
        } else {
          await interaction.reply({ content: 'You have no contracted Servant yet! Use `/summon` first.', ephemeral: true });
        }
        return;
      }

      if (btnId === 'hear_dialogue' || btnId === 'btn_hear_quote') {
        const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
        if (activeServant) {
          await interaction.deferReply({ ephemeral: true });
          const quotes = [
            { label: 'Summon Quote', text: activeServant.customQuotes?.summon || activeServant.template.summonQuote },
            { label: 'Battle Start', text: activeServant.customQuotes?.battleStart || activeServant.template.battleStartQuote },
            { label: 'Noble Phantasm Chant', text: activeServant.customQuotes?.noblePhantasm || activeServant.template.noblePhantasm.chant },
            { label: 'Victory Quote', text: activeServant.customQuotes?.victory || activeServant.template.victoryQuote }
          ];
          const picked = quotes[Math.floor(Math.random() * quotes.length)];
          let files: AttachmentBuilder[] = [];
          try {
            const diaBuffer = await renderDialogueCard(activeServant.template.name, picked.text, activeServant.template.title, activeServant.template.servantClass);
            if (diaBuffer && diaBuffer.length > 500) {
              files.push(new AttachmentBuilder(diaBuffer, { name: 'dialogue_card.png' }));
            }
          } catch {}

          const diaEmbed = new EmbedBuilder()
            .setTitle(`💬 ${activeServant.template.name} — [${picked.label}]`)
            .setDescription(`*"${picked.text}"*`)
            .setColor(0xd4af37);

          if (files.length > 0) {
            diaEmbed.setImage('attachment://dialogue_card.png');
          }
          await interaction.editReply({ embeds: [diaEmbed], files });
        } else {
          await interaction.reply({ content: 'You have no contracted Servant yet! Use `/summon` first.', ephemeral: true });
        }
        return;
      }

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
// 6. PREFIX COMMAND HANDLER (!command)
// ==========================================
// Allows server members to invoke bot commands using the '!' prefix alongside '/' slash commands.
client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const raw = message.content.slice(1).trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const query = args.join(' ').trim();

    const master = await getOrCreateMaster(message.author.id, message.author.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    const allServants = getAllThroneServants();

    // ----------------------------------------------------
    // !help / !commands / !guide
    // ----------------------------------------------------
    if (cmd === 'help' || cmd === 'commands' || cmd === 'guide' || cmd === 'info') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('⚔️ Holy Grail War Bot — Command Guide')
        .setDescription(
          `*You can execute any command using either \`/\` slash commands or \`!\` text prefixes.*\n\n` +
          `**👑 Servants & Throne of Heroes**\n` +
          `• \`!servant\` — View your contracted Servant profile, stats & radar card\n` +
          `• \`!servants [list]\` — Browse all canonical and custom Heroic Spirits\n` +
          `• \`!servants view <name>\` — Inspect full profile and parameters of any Servant\n` +
          `• \`!np <name>\` — Watch cinematic animated Noble Phantasm cards & chanting\n` +
          `• \`!art <name>\` — View high-definition character card artwork\n` +
          `• \`!summon\` — Initiate the Greater Grail summoning ritual\n\n` +
          `**🏆 Holy Grail War & Magecraft**\n` +
          `• \`!heal\` — Perform workshop leylines healing ritual for Servant & Master\n` +
          `• \`!grailwar\` / \`!war\` — View 7-Master tournament standing & intelligence board\n` +
          `• \`!profile\` — View Command Seals, Mana, and combat record\n` +
          `• \`!defenses\` — Manage workshop boundary fields and auto-evasion\n` +
          `• \`!church\` — Enter neutral Fuyuki Church sanctuary\n` +
          `• \`!inventory\` — Manage Craft Essences, catalysts, and vault\n` +
          `• \`!cegacha\` — Perform Craft Essence invocation\n` +
          `• \`!patrol\` — Patrol Fuyuki City for reconnaissance and skirmishes\n` +
          `• \`!boast\` — Broadcast active Servant profile card to the channel`
        )
        .setColor(0xd4af37)
        .setFooter({ text: 'Tip: Click the interactive buttons below for quick shortcuts' });

      const helpButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_show_servants_list').setLabel('All Servants (!servants)').setStyle(ButtonStyle.Primary).setEmoji('📜'),
        new ButtonBuilder().setCustomId('go_summon').setLabel('Summon Spirit (!summon)').setStyle(ButtonStyle.Success).setEmoji('✨'),
        new ButtonBuilder().setCustomId('war_my_profile').setLabel('My Profile (!profile)').setStyle(ButtonStyle.Secondary).setEmoji('👤')
      );

      await message.reply({ embeds: [helpEmbed], components: [helpButtons] });
      return;
    }

    // ----------------------------------------------------
    // !servant / !myservant / !status
    // ----------------------------------------------------
    if (cmd === 'servant' || cmd === 'myservant') {
      if (args[0]?.toLowerCase() === 'np') {
        const targetQuery = args.slice(1).join(' ').trim();
        const target = targetQuery ? findServantInPool(targetQuery, allServants) : (activeServant ? activeServant.template : undefined);
        if (target) {
          const npEmbed = buildNoblePhantasmEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await message.reply({ embeds: [npEmbed], components: [actions] });
        } else {
          await message.reply({ content: `❌ Heroic Spirit "${targetQuery}" not found in the Throne of Heroes.` });
        }
        return;
      }

      if (args[0]?.toLowerCase() === 'art' || args[0]?.toLowerCase() === 'artwork') {
        const targetQuery = args.slice(1).join(' ').trim();
        const target = targetQuery ? findServantInPool(targetQuery, allServants) : (activeServant ? activeServant.template : undefined);
        if (target) {
          const artEmbed = buildServantArtworkEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await message.reply({ embeds: [artEmbed], components: [actions] });
        } else {
          await message.reply({ content: `❌ Heroic Spirit "${targetQuery}" not found in the Throne of Heroes.` });
        }
        return;
      }

      if (!activeServant) {
        const noServantEmbed = new EmbedBuilder()
          .setTitle('🕯️ No Contracted Servant')
          .setDescription('You have not summoned a Heroic Spirit yet for the Holy Grail War!\nUse `!summon` or `/summon ritual` to invoke the Greater Grail.')
          .setColor(0xef4444);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('go_summon').setLabel('Summon Spirit').setStyle(ButtonStyle.Success).setEmoji('✨'),
          new ButtonBuilder().setCustomId('btn_show_servants_list').setLabel('Browse Throne').setStyle(ButtonStyle.Primary).setEmoji('📜')
        );

        await message.reply({ embeds: [noServantEmbed], components: [row] });
        return;
      }

      const t = activeServant.template;
      const profileEmbed = buildServantFullProfileEmbed(t);
      const artworkEmbed = buildServantArtworkEmbed(t);
      const actions = buildProfileActions(t.id);

      const files: AttachmentBuilder[] = [];
      try {
        const cardBuffer = await renderServantProfileCard(activeServant, message.author.username);
        if (cardBuffer && cardBuffer.length > 500) {
          files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
        }
      } catch (e) {
        console.warn('Canvas render error in !servant:', e);
      }

      await message.reply({ embeds: [profileEmbed, artworkEmbed], files, components: [actions] });
      return;
    }

    // ----------------------------------------------------
    // !servants [list | search <term> | view <name> | np <name> | art <name>]
    // ----------------------------------------------------
    if (cmd === 'servants' || cmd === 'throne' || cmd === 'servantlist') {
      const sub = args[0]?.toLowerCase();
      const targetQuery = args.slice(1).join(' ').trim();

      if (sub === 'np' || sub === 'noblephantasm') {
        const target = targetQuery ? findServantInPool(targetQuery, allServants) : (activeServant?.template || allServants[0]);
        if (target) {
          const npEmbed = buildNoblePhantasmEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await message.reply({ embeds: [npEmbed], components: [actions] });
        } else {
          await message.reply({ content: `❌ Heroic Spirit "${targetQuery}" not found.` });
        }
        return;
      }

      if (sub === 'art' || sub === 'artwork') {
        const target = targetQuery ? findServantInPool(targetQuery, allServants) : (activeServant?.template || allServants[0]);
        if (target) {
          const artEmbed = buildServantArtworkEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await message.reply({ embeds: [artEmbed], components: [actions] });
        } else {
          await message.reply({ content: `❌ Heroic Spirit "${targetQuery}" not found.` });
        }
        return;
      }

      if (sub === 'view' || sub === 'info' || (sub && sub !== 'list' && sub !== 'search')) {
        const queryToSearch = sub === 'view' || sub === 'info' ? targetQuery : query;
        const target = findServantInPool(queryToSearch, allServants);
        if (target) {
          const profileEmbed = buildServantFullProfileEmbed(target);
          const artworkEmbed = buildServantArtworkEmbed(target);
          const actions = buildProfileActions(target.id);

          const files: AttachmentBuilder[] = [];
          try {
            const tempInstance = createServantTempInstance(target);
            const cardBuffer = await renderServantProfileCard(tempInstance, 'Throne of Heroes');
            if (cardBuffer && cardBuffer.length > 500) {
              files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
            }
          } catch {}

          await message.reply({ embeds: [profileEmbed, artworkEmbed], files, components: [actions] });
          return;
        }
      }

      if (sub === 'search') {
        const { embed, components } = buildServantsListUI(allServants, 1, 'all', 'all', targetQuery);
        const replyMsg = await message.reply({ embeds: [embed], components });
        setupServantListCollector(replyMsg, allServants, 1, 'all', 'all', targetQuery);
        return;
      }

      // Default !servants / !servants list
      const { embed, components } = buildServantsListUI(allServants, 1, 'all', 'all');
      const replyMsg = await message.reply({ embeds: [embed], components });
      setupServantListCollector(replyMsg, allServants, 1, 'all', 'all');
      return;
    }

    // ----------------------------------------------------
    // !np <name> / !noblephantasm <name>
    // ----------------------------------------------------
    if (cmd === 'np' || cmd === 'noblephantasm') {
      const target = query ? findServantInPool(query, allServants) : (activeServant?.template || allServants[0]);
      if (target) {
        const npEmbed = buildNoblePhantasmEmbed(target);
        const actions = buildNoblePhantasmActions(target.id);
        await message.reply({ embeds: [npEmbed], components: [actions] });
      } else {
        await message.reply({ content: `❌ Heroic Spirit "${query}" not found in the Throne of Heroes.` });
      }
      return;
    }

    // ----------------------------------------------------
    // !art <name> / !artwork <name> / !portrait <name>
    // ----------------------------------------------------
    if (cmd === 'art' || cmd === 'artwork' || cmd === 'portrait') {
      const target = query ? findServantInPool(query, allServants) : (activeServant?.template || allServants[0]);
      if (target) {
        const artEmbed = buildServantArtworkEmbed(target);
        const actions = buildNoblePhantasmActions(target.id);
        await message.reply({ embeds: [artEmbed], components: [actions] });
      } else {
        await message.reply({ content: `❌ Heroic Spirit "${query}" not found in the Throne of Heroes.` });
      }
      return;
    }

    // ----------------------------------------------------
    // !heal / !rest
    // ----------------------------------------------------
    if (cmd === 'heal' || cmd === 'rest') {
      if (!master.servants || master.servants.length === 0) {
        await message.reply({ content: '❌ You have no contracted Servant to heal. Use `!summon` to enter the Holy Grail War.' });
        return;
      }

      let war = getOrInitWarSession(master);
      const res = executeWarAction(war, message.author.id, 'heal_ritual');
      war = res.updatedWar;
      await saveMaster(master);

      const healEmbed = new EmbedBuilder()
        .setTitle(res.success ? '✨ LEYLINE HEALING RITUAL COMPLETE' : '⏳ LEYLINE HEALING ON COOLDOWN')
        .setDescription(res.message)
        .setColor(res.success ? 0x22c55e : 0xf59e0b)
        .setFooter({ text: 'Command: !heal • Check !grailwar status' });

      await message.reply({ embeds: [healEmbed] });
      return;
    }

    // ----------------------------------------------------
    // !grailwar / !war / !tourney
    // ----------------------------------------------------
    if (cmd === 'grailwar' || cmd === 'war' || cmd === 'tourney' || cmd === 'tournament') {
      const war = getOrInitWarSession(master);
      const uP = war.participants[message.author.id];
      const embed = buildWarEmbed(war, uP);
      const btns = buildWarButtons();
      await message.reply({ embeds: [embed], components: [btns] });
      return;
    }

    // ----------------------------------------------------
    // !profile / !me
    // ----------------------------------------------------
    if (cmd === 'profile' || cmd === 'me') {
      const war = getOrInitWarSession(master);
      const isCivilian = !master.servants || master.servants.length === 0;
      if (isCivilian) {
        await message.reply({
          content: '📜 **Civilian Spectator Dossier:** You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `!summon` to establish a covenant and enter the Holy Grail War.'
        });
        return;
      }
      const uP = war.participants[message.author.id];
      const embed = buildProfileEmbed(master, war);
      const btns = buildProfileButtons(uP);
      await message.reply({ embeds: [embed], components: btns });
      return;
    }

    // ----------------------------------------------------
    // !defenses / !defense / !workshop
    // ----------------------------------------------------
    if (cmd === 'defenses' || cmd === 'defense' || cmd === 'workshop') {
      const war = getOrInitWarSession(master);
      const isCivilian = !master.servants || master.servants.length === 0;
      if (isCivilian) {
        await message.reply({
          content: '📜 **Civilian Spectator:** You do not have a magecraft workshop established yet. Use `!summon` first.'
        });
        return;
      }
      const uP = war.participants[message.author.id];
      const embed = buildDefensesEmbed(uP);
      const btns = buildDefensesButtons(uP);
      await message.reply({ embeds: [embed], components: btns });
      return;
    }

    // ----------------------------------------------------
    // !church / !sanctuary
    // ----------------------------------------------------
    if (cmd === 'church' || cmd === 'sanctuary') {
      const war = getOrInitWarSession(master);
      const uP = war.participants[message.author.id];
      const embed = buildChurchEmbed(uP);
      const btns = buildChurchButtons(uP);
      await message.reply({ embeds: [embed], components: btns });
      return;
    }

    // ----------------------------------------------------
    // !inventory / !inv
    // ----------------------------------------------------
    if (cmd === 'inventory' || cmd === 'inv') {
      const cesCount = master.craftEssences?.length || 0;
      const sqCount = master.saintQuartz || 0;
      const servantsCount = master.servants?.length || 0;

      const invEmbed = new EmbedBuilder()
        .setTitle(`🎒 Master Inventory: ${message.author.username}`)
        .setDescription(
          `💎 **Saint Quartz:** \`${sqCount} SQ\`\n` +
          `⚔️ **Contracted Servants:** \`${servantsCount}\`\n` +
          `🛡️ **Craft Essences:** \`${cesCount}\`\n\n` +
          (cesCount > 0 
            ? master.craftEssences.map((ce: any, i: number) => `${i + 1}. **${ce.name}** [★${ce.rarity}] — *+${ce.atkBonus} ATK, +${ce.hpBonus} HP*`).join('\n')
            : '*No Craft Essences held yet. Use `/cegacha` or `!cegacha` to summon Essences!*')
        )
        .setColor(0x38bdf8)
        .setFooter({ text: 'Command: !inventory • Use !equip to equip a Craft Essence' });

      await message.reply({ embeds: [invEmbed] });
      return;
    }

    // ----------------------------------------------------
    // !patrol / !scout
    // ----------------------------------------------------
    if (cmd === 'patrol' || cmd === 'scout') {
      let war = getOrInitWarSession(master);
      const chanName = (message.channel as any)?.name || 'fuyuki-city';
      const res = patrolCityInWar(war, message.author.id, message.author.username, chanName);
      await saveMaster(master);

      const patrolEmbed = new EmbedBuilder()
        .setTitle('👁️ Fuyuki City Reconnaissance Patrol')
        .setDescription(res.message)
        .setColor(res.success ? 0x3b82f6 : 0xf59e0b)
        .setFooter({ text: 'Command: !patrol' });

      await message.reply({ embeds: [patrolEmbed] });
      return;
    }

    // ----------------------------------------------------
    // !summon
    // ----------------------------------------------------
    if (cmd === 'summon') {
      const summonEmbed = new EmbedBuilder()
        .setTitle('✨ Throne of Heroes Invocation')
        .setDescription(
          `To invoke the Greater Grail and summon a Heroic Spirit, use the slash command:\n` +
          `\`\`\`bash\n/summon ritual\`\`\`\n` +
          `Or click the **Begin Summoning Ritual** button below!`
        )
        .setColor(0xd4af37);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('go_summon').setLabel('Begin Summoning Ritual').setStyle(ButtonStyle.Success).setEmoji('✨'),
        new ButtonBuilder().setCustomId('btn_show_servants_list').setLabel('Browse Throne (!servants)').setStyle(ButtonStyle.Primary).setEmoji('📜')
      );

      await message.reply({ embeds: [summonEmbed], components: [row] });
      return;
    }

    // ----------------------------------------------------
    // !boast
    // ----------------------------------------------------
    if (cmd === 'boast') {
      if (!activeServant) {
        await message.reply({ content: '❌ You have no contracted Servant to boast about! Use `!summon` first.' });
        return;
      }

      const files: AttachmentBuilder[] = [];
      try {
        const cardBuffer = await renderServantProfileCard(activeServant, message.author.username);
        if (cardBuffer && cardBuffer.length > 500) {
          files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
        }
      } catch {}

      const boastEmbed = new EmbedBuilder()
        .setTitle(`📢 MASTER DECLARATION: ${message.author.username} & ${activeServant.template.name}`)
        .setDescription(`*"Behold my contracted Heroic Spirit in this Holy Grail War!"*`)
        .setColor(0xd4af37);

      if (files.length > 0) {
        boastEmbed.setImage('attachment://servant_profile.png');
      }

      await message.reply({ embeds: [boastEmbed], files });
      return;
    }

  } catch (err: any) {
    console.warn('Prefix command error:', err?.message || err);
  }
});

// ==========================================
// 7. BOT STARTUP WRAPPER
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
