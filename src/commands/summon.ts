import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { MasterServantInstance } from '../types';

export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('Summon Heroic Spirits and Craft Essences from the Saint Quartz Summoning Gate')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Summoning type (1x Single Pull or 10x Multi-Pull)')
      .setRequired(false)
      .addChoices(
        { name: '1x Single Summon (3 SQ)', value: 'single' },
        { name: '10x Multi Summon (30 SQ)', value: 'multi' }
      )
  );

function rollSummon(master: any, isMulti: boolean) {
  const cost = isMulti ? 30 : 3;
  if (master.saintQuartz < cost) {
    return { error: `Insufficient Saint Quartz! You have **${master.saintQuartz} SQ**, but need **${cost} SQ**.` };
  }

  master.saintQuartz -= cost;
  const pullsCount = isMulti ? 10 : 1;
  const results: Array<{ item: any; type: 'servant' | 'ce'; rarity: number; isNew: boolean }> = [];

  const ssrServants = SERVANT_DATABASE.filter(s => s.rarity === 5);
  const srServants = SERVANT_DATABASE.filter(s => s.rarity === 4);
  const rServants = SERVANT_DATABASE.filter(s => s.rarity === 3);
  const ssrCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 5);
  const srCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 4);
  const rCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 3);

  for (let i = 0; i < pullsCount; i++) {
    master.pityCount = (master.pityCount || 0) + 1;
    const roll = Math.random() * 100;
    const isHardPity = master.pityCount >= 90;

    let targetRarity = 3;
    let targetType: 'servant' | 'ce' = 'servant';

    if (isHardPity || roll < 1.0) {
      targetRarity = 5;
      targetType = 'servant';
      master.pityCount = 0;
    } else if (roll < 5.0) {
      targetRarity = 5;
      targetType = 'ce';
    } else if (roll < 8.0) {
      targetRarity = 4;
      targetType = 'servant';
    } else if (roll < 20.0) {
      targetRarity = 4;
      targetType = 'ce';
    } else if (roll < 60.0) {
      targetRarity = 3;
      targetType = 'servant';
    } else {
      targetRarity = 3;
      targetType = 'ce';
    }

    if (targetType === 'servant') {
      const pool = targetRarity === 5 ? ssrServants : targetRarity === 4 ? srServants : rServants;
      const template = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwns = master.servants.some((s: any) => s.templateId === template.id);

      if (!alreadyOwns) {
        const newServant: MasterServantInstance = {
          id: `servant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          masterId: master.id,
          templateId: template.id,
          level: 1,
          experience: 0,
          allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
          availableStatPoints: 10,
          skillLevels: [1, 1, 1],
          customQuotes: {
            summon: template.summonQuote,
            battleStart: template.battleStartQuote,
            noblePhantasm: template.noblePhantasm.chant,
            victory: template.victoryQuote,
            defeat: template.defeatQuote
          },
          bondLevel: 1,
          template
        };
        master.servants.push(newServant);
        if (!master.activeServantId) {
          master.activeServantId = newServant.id;
        }
        results.push({ item: template, type: 'servant', rarity: targetRarity, isNew: true });
      } else {
        const existing = master.servants.find((s: any) => s.templateId === template.id);
        if (existing) {
          existing.availableStatPoints = (existing.availableStatPoints || 0) + 5;
          existing.bondLevel = Math.min(10, (existing.bondLevel || 1) + 1);
        }
        results.push({ item: template, type: 'servant', rarity: targetRarity, isNew: false });
      }
    } else {
      const pool = targetRarity === 5 ? ssrCes : targetRarity === 4 ? srCes : rCes;
      const ce = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwns = master.craftEssences?.some((c: any) => c.id === ce.id);
      if (!master.craftEssences) master.craftEssences = [];
      if (!alreadyOwns) {
        master.craftEssences.push(ce);
      }
      results.push({ item: ce, type: 'ce', rarity: targetRarity, isNew: !alreadyOwns });
    }
  }

  return { results, spent: cost };
}

function buildSummonEmbed(master: any, results: any[], spent: number, isMulti: boolean) {
  const servantPulls = results.filter(r => r.type === 'servant');
  const cePulls = results.filter(r => r.type === 'ce');

  const topServant = servantPulls.find(s => s.rarity === 5) || servantPulls[0];

  const embed = new EmbedBuilder()
    .setTitle(`🌟 Summoning Portal Results (${isMulti ? '10x Multi-Pull' : '1x Single Pull'})`)
    .setDescription(
      `Spent **${spent} Saint Quartz**.\n` +
      `Remaining SQ: **${master.saintQuartz} SQ** | SSR Pity: **${master.pityCount || 0}/90**\n\n` +
      (servantPulls.length > 0
        ? `⚔️ **Heroic Spirits Summoned:**\n` +
          servantPulls
            .map(
              s =>
                `${s.rarity === 5 ? '🌈' : s.rarity === 4 ? '✨' : '⚪'} **${s.item.name}** (${s.item.servantClass} • ${'★'.repeat(s.rarity)})${s.isNew ? ' 🆕 *(Contract Formed!)*' : ' 🔄 *(NP Upgrade +5 Stat Pts)*'}`
            )
            .join('\n') + '\n\n'
        : '') +
      (cePulls.length > 0
        ? `🛡️ **Craft Essences Acquired:**\n` +
          cePulls
            .map(
              c =>
                `${c.rarity === 5 ? '💎' : '🔹'} **${c.item.name}** (${'★'.repeat(c.rarity)})${c.isNew ? ' 🆕' : ''} — *${c.item.effectText}*`
            )
            .join('\n')
        : '') +
      `\n\n*Use \`/servant\` to inspect your active Servant or click the buttons below to summon again!*`
    )
    .setColor(topServant?.rarity === 5 ? 0xd4af37 : 0x38bdf8);

  if (topServant?.item?.avatarUrl) {
    embed.setThumbnail(topServant.item.avatarUrl);
  }

  return embed;
}

function buildSummonButtons(master: any) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('summon_1x')
      .setLabel('Summon 1x (3 SQ)')
      .setEmoji('🌟')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(master.saintQuartz < 3),
    new ButtonBuilder()
      .setCustomId('summon_10x')
      .setLabel('Summon 10x (30 SQ)')
      .setEmoji('💫')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(master.saintQuartz < 30),
    new ButtonBuilder()
      .setCustomId('summon_claim_sq')
      .setLabel('Daily Leyline (+30 SQ)')
      .setEmoji('💎')
      .setStyle(ButtonStyle.Success)
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const rawType = interaction.options.getString('type');
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    
    // Auto choose single if user has < 30 SQ, or user specified
    let isMulti = rawType === 'multi';
    if (!rawType) {
      isMulti = master.saintQuartz >= 30;
    }

    const rollRes = rollSummon(master, isMulti);
    if (rollRes.error || !rollRes.results) {
      const errEmbed = new EmbedBuilder()
        .setTitle('❌ Summoning Gate Error')
        .setDescription(rollRes.error || 'Failed to roll summon.')
        .setColor(0xef4444);
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('summon_1x')
          .setLabel('Summon 1x (3 SQ)')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(master.saintQuartz < 3),
        new ButtonBuilder()
          .setCustomId('summon_claim_sq')
          .setLabel('Daily Leyline (+30 SQ)')
          .setStyle(ButtonStyle.Success)
      );

      const reply = await interaction.reply({ embeds: [errEmbed], components: [row], fetchReply: true });
      setupSummonCollector(reply, interaction.user.id);
      return;
    }

    await saveMaster(master);

    const embed = buildSummonEmbed(master, rollRes.results, rollRes.spent || 3, isMulti);
    const row = buildSummonButtons(master);

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    setupSummonCollector(response, interaction.user.id);

  } catch (error: any) {
    console.error('Error executing /summon:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Summon error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Summon error: ${error.message}`, ephemeral: true });
    }
  }
}

function setupSummonCollector(message: any, userId: string) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i: any) => i.user.id === userId,
    time: 120000
  });

  collector.on('collect', async (i: any) => {
    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);

      if (i.customId === 'summon_claim_sq') {
        master.saintQuartz += 30;
        await saveMaster(master);
        await i.reply({
          content: `💎 Extracted 30 Saint Quartz from the Fuyuki Leyline! Current SQ: **${master.saintQuartz} SQ**.`,
          ephemeral: true
        });
        const updatedRow = buildSummonButtons(master);
        await message.edit({ components: [updatedRow] });
        return;
      }

      const isMulti = i.customId === 'summon_10x';
      const rollRes = rollSummon(master, isMulti);

      if (rollRes.error || !rollRes.results) {
        await i.reply({ content: `❌ ${rollRes.error || 'Summon failed.'}`, ephemeral: true });
        return;
      }

      await saveMaster(master);
      const embed = buildSummonEmbed(master, rollRes.results, rollRes.spent || 3, isMulti);
      const row = buildSummonButtons(master);

      await i.update({ embeds: [embed], components: [row] });
    } catch (err: any) {
      console.error('Error in summon collector:', err);
    }
  });
}
