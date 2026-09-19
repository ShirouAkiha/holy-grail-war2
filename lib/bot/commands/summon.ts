/**
 * Slash Command: /summon
 * Description: Throne of Heroes & Greater Grail Invocation — Summon Servants & Craft Essences
 * Library: discord.js v14
 */

export const summonCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  MessageFlags 
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  claimDailySaintQuartz
} from '../database/service';
import { executeServantGachaRoll, executeCraftEssenceGachaRoll } from '../engine/ceGacha';
import { buildGachaHub, attachGachaCollector } from './gacha';
import { registerMasterSummonInWar } from '../engine/grailwar';
import { safeSetEmbedImage } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('👑 Throne of Heroes & Greater Grail Invocation — Summon Servants & Craft Essences')
  .addSubcommand(sub =>
    sub
      .setName('servant')
      .setDescription('Summon Heroic Spirits from the Throne of Heroes into your roster (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1x or 10x)')
          .setRequired(false)
          .addChoices(
            { name: '1x Single Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('ritual')
      .setDescription('Channel magical energy into the summoning array to manifest a Heroic Spirit (Shortcut)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1x or 10x)')
          .setRequired(false)
          .addChoices(
            { name: '1x Single Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('ce')
      .setDescription('Forge Mystic Codes & Craft Essences from the Sanctum Pool (3 SQ for 1x, 30 SQ for 10x)')
  )
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('daily')
      .setDescription('💎 Claim your Daily 30 Saint Quartz reward (Free 10x Multi-Summon)')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Inspect your active Servant contract, roster size, Command Seals & SQ balance')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const subcommand = interaction.options.getSubcommand(false) || 'ritual';

  if (subcommand === 'daily') {
    const claimResult = await claimDailySaintQuartz(master.discordId || master.id);
    if (claimResult.success) {
      master.saintQuartz = claimResult.newTotalSq;
      await saveMaster(master);
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: \`🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\\\\nNew Balance: **\${master.saintQuartz} SQ**\`
      });
    } else {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: \`⏳ \${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}\`
      });
    }
    return;
  }

  if (subcommand === 'menu' || subcommand === 'ce') {
    const category = subcommand === 'ce' ? 'ces' : 'servants';
    const { embed, components } = buildGachaHub(master, category);
    await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    const reply = await interaction.fetchReply();
    attachGachaCollector(interaction, master, reply);
    return;
  }

  // Default / servant / ritual
  const rolls = (interaction.options.getInteger('rolls') as 1 | 10) || 1;
  const cost = rolls === 10 ? 30 : 3;

  if ((!master.servants || master.servants.length === 0) && (master.saintQuartz || 0) < cost) {
    master.saintQuartz = (master.saintQuartz || 0) + 30;
    await saveMaster(master);
  }

  if ((master.saintQuartz || 0) < cost) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: \`❌ Insufficient Saint Quartz! You need **\${cost} SQ**, but only have **\${master.saintQuartz || 0} SQ**.\\\\nUse \`/summon daily\` to claim **+30 SQ**!\`
    });
    return;
  }

  const rollResult = executeServantGachaRoll({ count: rolls, master });
  await saveMaster(rollResult.updatedMaster);

  if (rolls === 1) {
    const s = rollResult.results[0].servant;
    const isNew = rollResult.results[0].isNew;
    const embed = new EmbedBuilder()
      .setTitle(\`✨ HEROIC SPIRIT SUMMONED: \${s.name.toUpperCase()}\`)
      .setDescription(
        \`🗣️ **"\${s.summonQuote || 'I ask of you, are you my Master?'}"**\\\\n\\\\n\` +
        \`🗡️ **Class:** \\\`\${s.servantClass}\\\` | **Title:** *\${s.title || 'Heroic Spirit'}*\\\\n\` +
        (isNew ? \`🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant!\\\\n\` : \`🔄 **[DUPLICATE SPIRIT ORIGIN]** +50 Mana Prisms awarded!\\\\n\`) +
        \`💎 **Remaining Saint Quartz:** \\\`\${rollResult.updatedMaster.saintQuartz} SQ\\\` | 👥 **Roster Size:** \\\`\${rollResult.updatedMaster.servants.length}\\\`\`
      )
      .setColor(isNew ? 0xd4af37 : 0x38bdf8);
    safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } else {
    const listSummary = rollResult.results
      .map((r, idx) => \`\${idx + 1}. **\${r.servant.name}** (\\\`\${r.servant.servantClass}\\\`) \${r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*'}\`)
      .join('\\\\n');
    const embed = new EmbedBuilder()
      .setTitle('👑 10x Heroic Spirit Multi-Summon Results!')
      .setDescription(
        \`**Throne of Heroes Gate Awakened:**\\\\n\\\\n\${listSummary}\\\\n\\\\n\` +
        \`🌟 **New Contracts:** **+\${rollResult.newServantsCount}** | 🔵 **Prisms:** **+\${rollResult.totalManaPrismsAwarded}**\\\\n\` +
        \`💎 **Remaining SQ:** \\\`\${rollResult.updatedMaster.saintQuartz} SQ\\\`\`
      )
      .setColor(0xeab308);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
`;
