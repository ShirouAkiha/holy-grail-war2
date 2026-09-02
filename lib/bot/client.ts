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
import * as cegachaCommand from './commands/cegacha';
import { updateCustomDialogueQuotes, equipCraftEssence } from './engine/customization';
import { getOrCreateMaster, updateMasterProfile } from './database/service';
import { buildProfileEmbed, buildProfileButtons } from './commands/profile';
import { buildDefensesEmbed, buildDefensesButtons } from './commands/defenses';
import { buildWarEmbed, buildWarButtons } from './commands/grailwar';
import { getOrInitWarSession, executeWarAction, patrolCityInWar, simulateWarSkirmish } from './engine/grailwar';

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
commands.set(cegachaCommand.data.name, cegachaCommand);
if ((cegachaCommand as any).gachaCommand) {
  commands.set((cegachaCommand as any).gachaCommand.data.name, (cegachaCommand as any).gachaCommand);
}

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
    const names = Array.from(commands.keys()).map(n => \`/\${n}\`).join(', ');
    console.log(\`🔄 Registering \${commandData.length} Slash Commands with Discord [\${names}]...\`);
    if (guildId) {
      // Instant Guild-scoped deployment
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
      console.log(\`✅ Successfully registered \${commandData.length} commands to Guild [\${guildId}] (Instant availability).\`);
    } else {
      // Global deployment
      await rest.put(Routes.applicationCommands(clientId), { body: commandData });
      console.log(\`✅ Successfully registered \${commandData.length} global application commands.\`);
      console.log('💡 Note: Discord global commands can take up to an hour to propagate globally. Add DISCORD_GUILD_ID to .env for instant guild-wide updates, and press Ctrl+R in Discord to refresh command cache.');
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
    // 0. Autocomplete Router
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command && typeof (command as any).autocomplete === 'function') {
        await (command as any).autocomplete(interaction);
      }
      return;
    }

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

    // 4. Button Component Router
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
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
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
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }

        let msg = '';
        if (btnId === 'profile_ward_none') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'none');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'profile_ward_ward') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'ward');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'profile_ward_alarm') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'alarm');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'profile_toggle_evade') {
          const curP = war.participants[interaction.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(war, interaction.user.id, 'toggle_evade', newMode);
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'profile_heal') {
          const res = executeWarAction(war, interaction.user.id, 'rest_and_heal');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
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
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
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
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }

        let msg = '';
        if (btnId === 'ward_none') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'none');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'ward_ward') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'ward');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'ward_alarm') {
          const res = executeWarAction(war, interaction.user.id, 'set_ward', 'alarm');
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        } else if (btnId === 'toggle_auto_evade') {
          const curP = war.participants[interaction.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(war, interaction.user.id, 'toggle_evade', newMode);
          war = res.updatedWar;
          msg = res.message;
          await updateMasterProfile(master);
        }

        const uP = war.participants[interaction.user.id];
        await interaction.update({ embeds: [buildDefensesEmbed(uP, msg)], components: buildDefensesButtons(uP) });
        return;
      }

      // War Board Buttons
      if (btnId === 'war_patrol') {
        const chanTag = interaction.channel && 'name' in interaction.channel ? \`#\${(interaction.channel as any).name}\` : '#general';
        const res = patrolCityInWar(war, interaction.user.id, interaction.user.username, chanTag);
        const uP = res.updatedWar.participants[interaction.user.id];
        await interaction.update({ embeds: [buildWarEmbed(res.updatedWar, uP, res.message)], components: [buildWarButtons()] });
        return;
      }

      if (btnId === 'war_skirmish') {
        const chanTag = interaction.channel && 'name' in interaction.channel ? \`#\${(interaction.channel as any).name}\` : '#general';
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

      // Navigation Shortcuts
      if (btnId === 'go_summon' || btnId === 'quick_summon_ritual') {
        await interaction.reply({
          content: '✨ Use the \`/summon ritual\` slash command to invoke the Throne of Heroes and contract a Servant!',
          ephemeral: true
        });
        return;
      }

      if (btnId === 'quick_start_duel' || btnId === 'quick_duel_ai') {
        await interaction.reply({
          content: '⚔️ Use \`/duel\` to enter the battle arena or challenge another Master with \`/duel opponent:@Master\`!',
          ephemeral: true
        });
        return;
      }
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
