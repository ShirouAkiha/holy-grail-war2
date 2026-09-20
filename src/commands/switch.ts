import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession } from '../engine/grailwar';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { SERVANT_DATABASE } from '../data/servants';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('switch')
  .setDescription('Switch your active contracted Servant for Holy Grail War battles and dialogues')
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Target contracted servant by name or class to set active immediately')
      .setAutocomplete(true)
      .setRequired(false)
  );

// ==========================================
// 2. AUTOCOMPLETE HANDLER
// ==========================================
export async function autocomplete(interaction: AutocompleteInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.respond([]);
      return;
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const choices = master.servants
      .map((s: any, idx: number) => {
        const sName = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
        const sCls = s.template?.servantClass || s.servantClass || 'Saber';
        const isAct = master.activeServantId === s.id;
        return {
          name: `${idx + 1}. [${sCls}] ${sName} (Lv.${s.level || 1})${isAct ? ' ⭐ [ACTIVE]' : ''}`.slice(0, 100),
          value: s.id
        };
      })
      .filter(c => c.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(choices);
  } catch {
    try {
      await interaction.respond([]);
    } catch {}
  }
}

// ==========================================
// 3. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ You do not have any contracted Servants yet. Use `/summon` to summon a Heroic Spirit first!'
      });
      return;
    }

    const servantInput = interaction.options.getString('servant');

    // If specific servant requested, switch directly
    if (servantInput) {
      const chosen = master.servants.find(
        (s: any) =>
          s.id === servantInput ||
          (s.nickname && s.nickname.toLowerCase() === servantInput.toLowerCase()) ||
          (s.template?.name && s.template.name.toLowerCase() === servantInput.toLowerCase()) ||
          (s.templateId && s.templateId.toLowerCase() === servantInput.toLowerCase()) ||
          (s.nickname && s.nickname.toLowerCase().includes(servantInput.toLowerCase())) ||
          (s.template?.name && s.template.name.toLowerCase().includes(servantInput.toLowerCase()))
      );

      if (!chosen) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Could not find a contracted Servant matching \`${servantInput}\`. Use \`/switch\` without options to see your roster.`
        });
        return;
      }

      master.activeServantId = chosen.id;
      await saveMaster(master);
      getOrInitWarSession(master);

      const sTemplate = chosen.template || SERVANT_DATABASE.find(t => t.id === chosen.templateId) || chosen;
      const sName = chosen.nickname || sTemplate.name || 'Heroic Spirit';
      const sClass = sTemplate.servantClass || 'Saber';

      const embed = new EmbedBuilder()
        .setTitle(`👑 Active Servant Changed: ${sName}!`)
        .setDescription(
          `Master **${master.username}** has designated **${sName}** (\`${sClass}\`) as their active combat partner!\n\n` +
          `🗡️ **Class:** \`${sClass}\`\n` +
          `⭐ **Level:** \`Lv. ${chosen.level || 1} / 100\`\n` +
          `💖 **Bond Level:** \`Bond Lv. ${chosen.bondLevel || 1}\`\n` +
          `💥 **Noble Phantasm:** **${sTemplate.noblePhantasm?.name || 'Classified'}** (${sTemplate.noblePhantasm?.cardType || 'Buster'})\n\n` +
          `🗣️ *" ${chosen.customQuotes?.summon || sTemplate.summonQuote || sTemplate.battleStartQuote || 'Ready for battle, Master.'} "*`
        )
        .setColor(0xeab308)
        .setFooter({ text: 'Contract active for all Holy Grail War battles, duels, and dialogues.' });

      safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
      safeSetEmbedImage(embed, sTemplate.cardArtUrl || sTemplate.avatarUrl);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Otherwise render interactive switch hub
    const activeServant =
      master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    const { embed, components } = buildSwitchHub(master, activeServant.id);

    const reply = await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i: any) => i.user.id === interaction.user.id,
      time: 120000
    });

    collector.on('collect', async (i: any) => {
      try {
        if (i.replied || i.deferred) return;

        let selectedId = '';
        if (i.isStringSelectMenu()) {
          selectedId = i.values[0];
        } else if (i.customId.startsWith('btn_switch_servant:')) {
          selectedId = i.customId.split(':')[1];
        }

        if (selectedId) {
          const picked = master.servants.find(
            (s: any, idx: number) => s.id === selectedId || `s_${idx}` === selectedId
          );

          if (picked) {
            master.activeServantId = picked.id;
            await saveMaster(master);
            getOrInitWarSession(master);

            const sTemp = picked.template || SERVANT_DATABASE.find(t => t.id === picked.templateId) || picked;
            const sName = picked.nickname || sTemp.name || 'Heroic Spirit';
            const sClass = sTemp.servantClass || 'Saber';

            const updatedHub = buildSwitchHub(master, picked.id, `👑 Switched active partner to **${sName}** (\`${sClass}\`)!`);

            await i.update({
              embeds: [updatedHub.embed],
              components: updatedHub.components
            });
            return;
          }
        }
      } catch (err: any) {
        if (err.code === 10062 || err.code === 40060 || err.code === 50027) return;
        console.error('Error in /switch collector:', err);
      }
    });

  } catch (error: any) {
    if (error?.code === 10062 || error?.code === 40060 || error?.code === 50027) return;
    console.error('Error executing /switch:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}

// ==========================================
// 4. UI BUILDER
// ==========================================
function buildSwitchHub(master: any, currentActiveId: string, bannerMessage?: string) {
  const activeServant =
    master.servants.find((s: any) => s.id === currentActiveId) || master.servants[0];

  const sTemplate = activeServant.template || SERVANT_DATABASE.find(t => t.id === activeServant.templateId) || activeServant;
  const activeName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';
  const activeClass = sTemplate.servantClass || 'Saber';

  const rosterLines = master.servants.map((s: any, idx: number) => {
    const sT = s.template || SERVANT_DATABASE.find(t => t.id === s.templateId) || s;
    const name = s.nickname || sT.name || 'Heroic Spirit';
    const cls = sT.servantClass || 'Saber';
    const isAct = s.id === master.activeServantId;
    const tag = isAct ? ' 👑 **[CURRENT ACTIVE]**' : '';
    return `**${idx + 1}. [${cls}] ${name}** — Lv.${s.level || 1} • Bond Lv.${s.bondLevel || 1}${tag}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🔄 Servant Command Nexus — Active Partner Selection`)
    .setDescription(
      (bannerMessage ? `✅ ${bannerMessage}\n\n` : '') +
      `Current Active Partner: **${activeName}** (\`${activeClass}\`) [Lv.${activeServant.level || 1}]\n\n` +
      `**📜 Contracted Roster (${master.servants.length} Servants):**\n` +
      rosterLines +
      `\n\n*Select a Servant below to switch your active Holy Grail War partner.*`
    )
    .setColor(0xeab308)
    .setFooter({ text: `Master ${master.username} • Use /servant for workshop & parameter upgrades` });

  safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);

  const selectOptions = master.servants.slice(0, 25).map((s: any, idx: number) => {
    const sT = s.template || SERVANT_DATABASE.find(t => t.id === s.templateId) || s;
    const name = s.nickname || sT.name || 'Heroic Spirit';
    const cls = sT.servantClass || 'Saber';
    const isAct = s.id === master.activeServantId;
    return {
      label: `${idx + 1}. ${name} (${cls})`.slice(0, 100),
      description: `Lv. ${s.level || 1} • Bond Lv. ${s.bondLevel || 1} • Points: ${s.availableStatPoints || 0} pts`.slice(0, 100),
      value: s.id,
      default: isAct
    };
  });

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_switch_servant')
      .setPlaceholder(`Switch Active Servant (${activeName})`)
      .addOptions(selectOptions)
  );

  const components: any[] = [selectRow];

  // If up to 5 servants, add quick one-click buttons
  if (master.servants.length <= 5) {
    const buttonRow = new ActionRowBuilder<ButtonBuilder>();
    master.servants.forEach((s: any, idx: number) => {
      const sT = s.template || SERVANT_DATABASE.find(t => t.id === s.templateId) || s;
      const name = s.nickname || sT.name || 'Heroic Spirit';
      const isAct = s.id === master.activeServantId;
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_switch_servant:${s.id}`)
          .setLabel(`${idx + 1}. ${name.slice(0, 15)}`)
          .setEmoji(isAct ? '👑' : '⚔️')
          .setStyle(isAct ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(isAct)
      );
    });
    components.push(buttonRow);
  }

  return { embed, components };
}
