import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags 
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  claimDailySaintQuartz
} from '../database/service';
import { executeServantGachaRoll, executeCraftEssenceGachaRoll, executeUnifiedGachaRoll } from '../engine/ceGacha';
import { buildGachaHub, attachGachaCollector } from './gacha';
import { registerMasterSummonInWar } from '../engine/grailwar';
import { safeSetEmbedImage } from '../utils/discordEmbedHelper';
import { renderGachaSummonBanner } from '../canvas/renderer';

// ==========================================
// 1. SLASH COMMAND DEFINITION (GACHA UNIFIED SHORTCUT)
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('👑 Greater Grail Unified Invocation — Summon Servants & Craft Essences (50/50)')
  .addIntegerOption(opt =>
    opt
      .setName('rolls')
      .setDescription('Summon count: 1x (3 SQ / 1 Ticket) or 10x (30 SQ - 5 Servants + 5 CEs)')
      .setRequired(false)
      .addChoices(
        { name: '1x Single Summon (3 SQ or 1 Ticket)', value: 1 },
        { name: '10x Multi-Summon (30 SQ - 5 Servants + 5 CEs)', value: 10 }
      )
  );

// ==========================================
// 1.5. AUTHENTIC FATE SUMMONING CHANTS & VISUALS
// ==========================================
const RIN_SUMMONING_GIF = 'https://i.imgur.com/hyNsgc1.jpeg';
const FALLBACK_MAGIC_CIRCLE = 'https://i.imgur.com/hyNsgc1.jpeg';

function resolveDirectGifUrl(url: string): string {
  if (!url) return FALLBACK_MAGIC_CIRCLE;
  if (url.includes('tenor.com') || url.includes('giphy.com')) {
    return FALLBACK_MAGIC_CIRCLE;
  }
  return url;
}

const SUMMONING_CHANTS = [
  `*“Let silver and steel be the essence.”*\n` +
  `*“Let stone and the archduke of contracts be the foundation.”*\n` +
  `*“Let red be the color I pay tribute to.”*\n` +
  `*“Let rise a wall against the wind that shall fall.”*\n` +
  `*“Let the four cardinal gates close.”*\n` +
  `*“Let the three-forked road from the crown reaching unto the Kingdom rotate.”*\n\n` +
  `*“Let it be filled. Again. Again. Again. Again.”*\n` +
  `*“Let it be filled fivefold for every turn, simply breaking asunder with every filling.”*`,

  `*“Fill. Fill. Fill. Fill. Fill. Let each be turned over five times, simply breaking asunder the fulfilled time.”*\n` +
  `*“Let silver and steel be the essence. Let stone and the archduke of contracts be the foundation. Let my great master be the ancestor. Raise a wall, against the wind that shall fall. Close the four cardinal gates. Come out from the crown. Rotate the three-branched road reaching the Kingdom.”*\n\n` +
  `*“– I shall declare here. Your body shall serve under me. My fate shall be with your sword. Submit to the beckoning of the Holy Grail. If you will submit to this will and this reason…… then answer!”*\n\n` +
  `*“– An oath shall be sworn here! I shall attain all virtues of all of Heaven. I shall have dominion over all evils of all of Hell! – From the Seventh Heaven, attended to by three great words of power, come forth from the ring of restraint, Protector of the Balance!”*`,

  `*“Be gone, shadows!”*\n` +
  `*“Thou of the unseeable!”*\n` +
  `*“Fade back into oblivion, if of darkness. Be returned to the immaterial!”*\n` +
  `*“Ask not me, my answer is clear. In my hand is light. Know that all is in this hand.”*\n` +
  `*“I am the truth of creation. In face of all things, thy defeat is certain!”*`
];

// ==========================================
// 2. COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    let master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const rollsOption = interaction.options.getInteger('rolls');

    // If invoked with no options (e.g. /summon), open the interactive Greater Grail Sanctum Hub
    if (!rollsOption) {
      const { embed, components } = buildGachaHub(master, 'altar');
      await interaction.reply({ embeds: [embed], components });
      const reply = await interaction.fetchReply();
      attachGachaCollector(interaction, master, reply);
      return;
    }

    const rolls = (rollsOption as 1 | 10) || 1;
    const cost = rolls === 10 ? 30 : 3;

    // First-Time Starter Gift: If a brand-new player has 0 servants and < 3 SQ, bestow starter SQ
    if ((!master.servants || master.servants.length === 0) && (master.saintQuartz || 0) < cost) {
      master.saintQuartz = (master.saintQuartz || 0) + 30;
      await saveMaster(master);
    }

    // Check balance (Quartz or Tickets)
    const canUseSq = (master.saintQuartz || 0) >= cost;
    const canUseTickets = (master.summonTickets || 0) >= rolls;

    if (!canUseSq && !canUseTickets) {
      const needSqEmbed = new EmbedBuilder()
        .setTitle('💎 Insufficient Summon Resources')
        .setDescription(
          `You need **${cost} Saint Quartz** (or **${rolls} Summon Ticket(s) 🎫**) for a ${rolls}x Summon, but you currently have **${master.saintQuartz || 0} SQ** and **${master.summonTickets || 0} Tickets**.\n\n` +
          `**Earn Saint Quartz (SQ) via:**\n` +
          `• 🎁 \`/daily\` — Claim +30 SQ daily allowance (10x Multi-Summon ready!)\n` +
          `• ⚔️ \`/raid\` — Defeat Grand Calamity bosses (Barbatos & Tiamat) for SQ & Grails\n` +
          `• ⚔️ \`/war attack\` & \`/duel\` — Win Holy Grail War and PvP duel battles\n` +
          `• 🕵️ \`/patrol\` — Scout Fuyuki sectors for SQ drops, secret stashes & scouts\n` +
          `• ⛪ \`/church\` — Hunt excommunicated Heretics & claim Church bounties\n` +
          `• 💖 \`/bond\` & \`/talk\` — Raise Servant Bond level & chat with Servants for SQ rewards\n` +
          `• 🏆 \`/ranking\` & \`/reputation\` — Compete on Leaderboards & claim Fuyuki Reputation tiers`
        )
        .setColor(0xef4444);

      const needSqRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('gacha_act_claim_daily')
          .setLabel('Claim Daily SQ (+30 💎)')
          .setEmoji('🎁')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('gacha_tab_shop')
          .setLabel(`Prism Shop (${master.manaPrisms || 0} 🔵)`)
          .setEmoji('🛍️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gacha_tab_daily')
          .setLabel('Open Sanctum Hub')
          .setEmoji('🔮')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [needSqEmbed], components: [needSqRow], flags: MessageFlags.Ephemeral });
      return;
    }

    const useTickets = !canUseSq && canUseTickets;

    // Immediately defer reply to Discord so canvas generation never triggers "didn't respond in time"
    await interaction.deferReply();
    await interaction.editReply({
      content: rolls === 10
        ? '🔮 **Channeling Saint Quartz into the Greater Grail Invocation Circle...**\n> ⏳ *Manifesting 5 Heroic Spirits and 5 Craft Essences...*'
        : '✨ **Channeling Mana into the Greater Grail...**\n> ⏳ *Invoking summon ritual...*'
    }).catch(() => {});

    // Execute Unified Gacha Roll (50% Servants & 50% Craft Essences)
    const rollResult = executeUnifiedGachaRoll({ count: rolls, master, useTickets });
    const updatedMaster = rollResult.updatedMaster;

    // Ensure active servant and command seals are set if this was the first summon
    if (!updatedMaster.activeServantId && updatedMaster.servants.length > 0) {
      updatedMaster.activeServantId = updatedMaster.servants[0].id;
      updatedMaster.commandSeals = 3;
    }

    await saveMaster(updatedMaster);

    // Register active servant in war if needed
    if (updatedMaster.servants.length > 0) {
      const activeS = updatedMaster.servants.find((s: any) => s.id === updatedMaster.activeServantId) || updatedMaster.servants[0];
      registerMasterSummonInWar(updatedMaster, activeS);
    }

    // 1x Single Summon Result Display
    if (rolls === 1) {
      const pulled = rollResult.results[0];
      const chosenChant = SUMMONING_CHANTS[Math.floor(Math.random() * SUMMONING_CHANTS.length)];

      if (pulled.type === 'servant') {
        const s = (pulled.servant || pulled.item) as any;
        const isNew = pulled.isNew;

        const ritualEmbed = new EmbedBuilder()
          .setTitle('🕯️ HOLY GRAIL WAR: SACRED SUMMONING RITUAL')
          .setDescription(
            `Master **<@${interaction.user.id}>** channels magical energy through circuits into the summoning array...\n\n` +
            `${chosenChant}\n\n` +
            `✨ *The Greater Grail responds! Mana surges through the Fuyuki leylines as the magic circle erupts in brilliant light!*`
          )
          .setImage(resolveDirectGifUrl(RIN_SUMMONING_GIF))
          .setColor(0xa855f7)
          .setFooter({ text: 'Magecraft Circuits Active • Channelling Mana into the Greater Grail' });

        const summonEmbed = new EmbedBuilder()
          .setTitle(`✨ HEROIC SPIRIT SUMMONED: ${s.name.toUpperCase()}`)
          .setDescription(
            `═══════════════════════════════════\n` +
            `🗣️ **"${s.summonQuote || 'I ask of you, are you my Master?'}"**\n` +
            `═══════════════════════════════════\n\n` +
            `👤 **True Name:** **${s.name}**\n` +
            `🗡️ **Class:** \`${s.servantClass}\` | **Title:** *${s.title || 'Heroic Spirit'}*\n` +
            (isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Added to your permanent Chaldea roster!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already own this Servant. Awarded **+50 Mana Prisms 🔵**!`) +
            `\n\n` +
            `📊 **Base Parameters:**\n` +
            `• **HP:** \`${(s.baseHp || 12000).toLocaleString()}\` | **ATK:** \`${(s.baseAtk || 10000).toLocaleString()}\`\n` +
            `• **STR:** \`${s.baseStats?.strength || 10}\` | **END:** \`${s.baseStats?.endurance || 10}\` | **AGI:** \`${s.baseStats?.agility || 10}\` | **MNA:** \`${s.baseStats?.mana || 10}\` | **LCK:** \`${s.baseStats?.luck || 10}\`\n\n` +
            `💥 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Noble Phantasm'}** [${s.noblePhantasm?.cardType || 'Buster'}]\n` +
            `* "${s.noblePhantasm?.chant || 'Unleash the Phantasm'}" *\n\n` +
            `💎 **Remaining Saint Quartz:** \`${updatedMaster.saintQuartz} SQ\` | 👥 **Roster Size:** \`${updatedMaster.servants.length}\``
          )
          .setColor(isNew ? 0xd4af37 : 0x38bdf8)
          .setFooter({ text: `Use /servant to view and switch companions • /duel to battle` });
        safeSetEmbedImage(summonEmbed, s.cardArtUrl || s.avatarUrl);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_view_servant')
            .setLabel('View Active Servant (/servant)')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((updatedMaster.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('btn_enter_war')
            .setLabel('Enter Grail War (/grailwar)')
            .setEmoji('🏰')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('btn_boast_summon')
            .setLabel('Boast to Server')
            .setEmoji('📢')
            .setStyle(ButtonStyle.Danger)
        );

        const reply = await interaction.editReply({
          content: '',
          embeds: [ritualEmbed, summonEmbed],
          components: [actionRow]
        });
        attachGachaCollector(interaction, updatedMaster, reply);
        return;
      } else {
        const ce = pulled.item as any;
        const rarityStars = '★'.repeat(pulled.rarity);
        let files: AttachmentBuilder[] = [];
        try {
          const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '1x Craft Essence Forge');
          files = [new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' })];
        } catch (canvasErr) {
          console.error('Failed to render gacha canvas banner:', canvasErr);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ MYSTIC CODE FORGED: ${ce.name.toUpperCase()}!`)
          .setDescription(
            `Master **<@${interaction.user.id}>** has channeled ancient relics from the leyline altar!\n\n` +
            `🔮 **Relic:** **[${rarityStars}] ${ce.name}**\n` +
            `📜 **Effect:** *${ce.effectText || ce.description}*\n` +
            `⚔️ **Combat Modifiers:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\n` +
            `💎 **Remaining Saint Quartz:** \`${updatedMaster.saintQuartz} SQ\`\n\n` +
            `Use \`/inventory\` or \`/customise equip\` to bind this Mystic Code to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8)
          .setFooter({ text: 'Greater Grail Unified Altar • 50% Servants / 50% CEs (1% 5★ CE Rate)' });

        if (files.length > 0) {
          embed.setImage('attachment://ce_summon.png');
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((updatedMaster.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((updatedMaster.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_inventory')
            .setLabel('Inventory (/inventory)')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.editReply({
          content: '',
          embeds: [embed],
          files,
          components: [actionRow]
        });
        attachGachaCollector(interaction, updatedMaster, reply);
        return;
      }
    }

    // 10x Multi-Summon Result Display (5 Servants + 5 Craft Essences)
    const servantList = rollResult.results.filter((r: any) => r.type === 'servant');
    const ceList = rollResult.results.filter((r: any) => r.type === 'craft_essence');

    const servantSummary = servantList.map((r: any, idx: number) => {
      const s = (r.servant || r.item) as any;
      const statusTag = r.isNew ? '🌟 **[NEW!]**' : `🔵 *(+50 Prisms)*`;
      return `${idx + 1}. **${s.name}** (\`${s.servantClass}\`) ${statusTag}`;
    }).join('\n');

    const ceSummary = ceList.map((r: any, idx: number) => {
      const c = r.item as any;
      const statusTag = r.isNew ? '🌟 **[NEW!]**' : '';
      const stars = '★'.repeat(r.rarity || c.rarity || 3);
      return `${idx + 1}. **[${stars}] ${c.name}** ${statusTag} — *${(c.effectText || c.description || '').slice(0, 36)}...*`;
    }).join('\n');

    const multiEmbed = new EmbedBuilder()
      .setTitle(`👑 10x Greater Grail Unified Multi-Summon Results!`)
      .setDescription(
        `**Greater Grail Invocation Manifested (5 Servants + 5 Craft Essences):**\n\n` +
        `⚔️ **Heroic Spirits Manifested (5x):**\n` +
        servantSummary +
        `\n\n` +
        `🛡️ **Craft Essences Forged (5x):**\n` +
        ceSummary +
        `\n\n` +
        `═══════════════════════════════════════════════\n` +
        `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
        `🛡️ **SSR / SR Relics Forged:** **${rollResult.ssrsPulled}x ★5 SSR**, **${rollResult.srsPulled}x ★4 SR**\n` +
        `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded} 🔵**\n` +
        `💎 **Remaining Saint Quartz:** \`${updatedMaster.saintQuartz} SQ\` | 🔵 **Total Prisms:** \`${updatedMaster.manaPrisms || 0}\`\n\n` +
        `Use \`/servant\` to view your full roster, or \`/inventory\` to equip Mystic Codes!`
      )
      .setColor(rollResult.ssrsPulled > 0 ? 0xf59e0b : 0xeab308)
      .setFooter({ text: 'Greater Grail Sanctum • 50% Servants & 50% Craft Essences (1% 5★ CE Rate)' });

    let files: AttachmentBuilder[] = [];
    try {
      const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '10x Greater Grail Unified Summon');
      const attachment = new AttachmentBuilder(canvasBuffer, { name: 'unified_summon.png' });
      files = [attachment];
      multiEmbed.setImage('attachment://unified_summon.png');
    } catch (canvasErr) {
      console.error('Failed to render summon gacha canvas banner:', canvasErr);
    }

    const multiActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_act_multi')
        .setLabel('Summon 10x Again (30 SQ)')
        .setEmoji('🌟')
        .setStyle(ButtonStyle.Primary)
        .setDisabled((updatedMaster.saintQuartz || 0) < 30),
      new ButtonBuilder()
        .setCustomId('gacha_act_single')
        .setLabel('1x Summon (3 SQ)')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
        .setDisabled((updatedMaster.saintQuartz || 0) < 3),
      new ButtonBuilder()
        .setCustomId('gacha_link_inventory')
        .setLabel('Inventory (/inventory)')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('gacha_link_servant')
        .setLabel('Servants (/servant)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_enter_war')
        .setLabel('Grail War (/grailwar)')
        .setEmoji('🏰')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.editReply({
      content: '',
      embeds: [multiEmbed],
      components: [multiActionRow],
      files
    });
    attachGachaCollector(interaction, updatedMaster, reply);

  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060 || error.message?.includes('Unknown interaction')) return;
    console.error('Error executing /summon:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Summoning Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Summoning Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
