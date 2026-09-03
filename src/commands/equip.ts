import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('equip')
  .setDescription('⚔️ Equip a Craft Essence to your active Servant')
  .addStringOption(opt =>
    opt
      .setName('craft_essence')
      .setDescription('Name of the Craft Essence from your inventory')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You have no active Servant to equip! Use `/summon` first.'
      });
      return;
    }

    const query = interaction.options.getString('craft_essence');
    const ownedCes = (master.craftEssences || []).filter(Boolean);

    if (!query) {
      const activeCe = activeServant.equippedCe;
      const list = ownedCes.length > 0 
        ? ownedCes.map((c: any) => `• **${c.name}** (★${c.rarity}) — *${c.effectText || c.description || c.effectDescription || ''}*`).slice(0, 10).join('\n')
        : '*Your inventory is empty. Roll in `/cegacha` using Saint Quartz!*';

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Craft Essence Equipment — ${activeServant.nickname || activeServant.template.name}`)
        .setDescription(
          (activeCe ? `Currently Equipped: **${activeCe.name}** (★${activeCe.rarity})\n*${activeCe.effectText || activeCe.description || (activeCe as any).effectDescription || ''}*\n\n` : `*No Craft Essence equipped.*\n\n`) +
          `**Your Available Craft Essences:**\n${list}\n\n*Use \`/equip craft_essence:<name>\` or \`/inventory\` to equip.*`
        )
        .setColor(0xd4af37);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const targetCe = ownedCes.find((c: any) => c.name?.toLowerCase().includes(query.toLowerCase()) || c.id === query);
    if (!targetCe) {
      await interaction.reply({
        ephemeral: true,
        content: `❌ You do not own a Craft Essence matching "${query}". Check your inventory with \`/inventory\`.`
      });
      return;
    }

    activeServant.equippedCeId = targetCe.id;
    activeServant.equippedCe = { ...targetCe };
    await saveMaster(master);

    const atkBonus = targetCe.atkBonus ?? targetCe.bonusAtk ?? (targetCe as any).stats?.atk ?? 0;
    const hpBonus = targetCe.hpBonus ?? targetCe.bonusHp ?? (targetCe as any).stats?.hp ?? 0;
    const effectDesc = targetCe.effectText || targetCe.description || (targetCe as any).effectDescription || 'Passive Enhancement';

    const embed = new EmbedBuilder()
      .setTitle('✅ CRAFT ESSENCE EQUIPPED!')
      .setDescription(
        `Equipped **${targetCe.name}** (★${targetCe.rarity}) to **${activeServant.nickname || activeServant.template.name}**!\n\n` +
        `**Passives & Bonuses:**\n• ATK Boost: +${atkBonus}\n• HP Boost: +${hpBonus}\n• Effect: *${effectDesc}*`
      )
      .setColor(0x22c55e);

    if (targetCe.artworkUrl) {
      embed.setThumbnail(targetCe.artworkUrl);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /equip:', error);
    await interaction.reply({ content: `❌ Equip error: ${error.message}`, ephemeral: true });
  }
}
