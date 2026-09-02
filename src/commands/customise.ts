import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

// ==========================================
// 1. SLASH COMMAND DEFINITION WITH SUBCOMMANDS
// ==========================================
// Provides 4 specialized subcommands:
// - `/customise stats`: Allocate earned parameter points into STR, END, AGI, MNA, LCK
// - `/customise equip`: Attach/swap Craft Essences to boost combat passives
// - `/customise quote`: Overwrite standard Fate voice lines with custom dialogue
// - `/customise nickname`: Set a custom name for the Servant
export const data = new SlashCommandBuilder()
  .setName('customise')
  .setDescription('Customize your active Servant parameters, Craft Essence, and dialogue lines')
  .addSubcommand(sub =>
    sub
      .setName('stats')
      .setDescription('Allocate available parameter points to your Servant')
      .addIntegerOption(opt => opt.setName('strength').setDescription('Points for STR (ATK/Buster)').setRequired(false))
      .addIntegerOption(opt => opt.setName('endurance').setDescription('Points for END (HP/DEF)').setRequired(false))
      .addIntegerOption(opt => opt.setName('agility').setDescription('Points for AGI (Speed/Quick)').setRequired(false))
      .addIntegerOption(opt => opt.setName('mana').setDescription('Points for MNA (NP/Arts)').setRequired(false))
      .addIntegerOption(opt => opt.setName('luck').setDescription('Points for LCK (Crits)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('equip')
      .setDescription('Equip a Craft Essence from your inventory')
      .addStringOption(opt =>
        opt
          .setName('craft_essence')
          .setDescription('Select Craft Essence to equip')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('quote')
      .setDescription('Set custom dialogue lines for your Servant')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Dialogue trigger')
          .setRequired(true)
          .addChoices(
            { name: 'Summon Quote', value: 'summon' },
            { name: 'Battle Start', value: 'battleStart' },
            { name: 'Noble Phantasm Chant', value: 'noblePhantasm' },
            { name: 'Victory Quote', value: 'victory' },
            { name: 'Defeat Quote', value: 'defeat' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('text')
          .setDescription('New custom dialogue text')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('nickname')
      .setDescription('Set a custom nickname for your Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('New nickname')
          .setRequired(true)
      )
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // Validation: Player must have at least 1 Servant
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant using `/summon` before you can customize them!'
      });
      return;
    }

    const activeServant =
      master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    const sAny = activeServant as any;
    const sTemplate = sAny.template || sAny;
    const servantName = sAny.nickname || sTemplate.name || sAny.name || 'Heroic Spirit';
    const baseStats = sTemplate.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // SUBCOMMAND A: STAT POINT ALLOCATION
    // ==========================================
    if (subcommand === 'stats') {
      const str = interaction.options.getInteger('strength') || 0;
      const end = interaction.options.getInteger('endurance') || 0;
      const agi = interaction.options.getInteger('agility') || 0;
      const mna = interaction.options.getInteger('mana') || 0;
      const lck = interaction.options.getInteger('luck') || 0;

      const totalRequested = str + end + agi + mna + lck;

      // If no points passed, display the current allocation overview and instructions
      if (totalRequested <= 0) {
        const embed = new EmbedBuilder()
          .setTitle(`📊 Parameter Allocation: ${servantName}`)
          .setDescription(
            `Available Stat Points: **${activeServant.availableStatPoints || 0} pts**\n\n` +
            `**Current Allocated:**\n` +
            `• **STR:** +${activeServant.allocatedStats?.strength || 0}\n` +
            `• **END:** +${activeServant.allocatedStats?.endurance || 0}\n` +
            `• **AGI:** +${activeServant.allocatedStats?.agility || 0}\n` +
            `• **MNA:** +${activeServant.allocatedStats?.mana || 0}\n` +
            `• **LCK:** +${activeServant.allocatedStats?.luck || 0}\n\n` +
            `*To allocate points, use:*\n\`/customise stats strength:2 endurance:2 mana:1\``
          )
          .setColor(0xd4af37);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if player has enough unused points
      if (totalRequested > (activeServant.availableStatPoints || 0)) {
        await interaction.reply({
          ephemeral: true,
          content: `❌ Cannot allocate **${totalRequested} pts**. You only have **${activeServant.availableStatPoints || 0} available stat points** on ${servantName}.`
        });
        return;
      }

      if (!activeServant.allocatedStats) {
        activeServant.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
      }

      // Apply points
      activeServant.allocatedStats.strength = (activeServant.allocatedStats.strength || 0) + str;
      activeServant.allocatedStats.endurance = (activeServant.allocatedStats.endurance || 0) + end;
      activeServant.allocatedStats.agility = (activeServant.allocatedStats.agility || 0) + agi;
      activeServant.allocatedStats.mana = (activeServant.allocatedStats.mana || 0) + mna;
      activeServant.allocatedStats.luck = (activeServant.allocatedStats.luck || 0) + lck;
      activeServant.availableStatPoints -= totalRequested;

      await saveMaster(master);

      const embed = new EmbedBuilder()
        .setTitle('✅ Parameters Allocated Successfully!')
        .setDescription(
          `Allocated **${totalRequested} points** to **${servantName}**:\n` +
          (str ? `• STR: +${str}\n` : '') +
          (end ? `• END: +${end}\n` : '') +
          (agi ? `• AGI: +${agi}\n` : '') +
          (mna ? `• MNA: +${mna}\n` : '') +
          (lck ? `• LCK: +${lck}\n` : '') +
          `\nRemaining Available Points: **${activeServant.availableStatPoints} pts**`
        )
        .setColor(0x22c55e);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ==========================================
    // SUBCOMMAND B: EQUIP CRAFT ESSENCE
    // ==========================================
    if (subcommand === 'equip') {
      const ceNameParam = interaction.options.getString('craft_essence');

      // Direct text search
      if (ceNameParam) {
        const found = CRAFT_ESSENCE_DATABASE.find(
          (c: any) => c.name.toLowerCase().includes(ceNameParam.toLowerCase()) || c.id === ceNameParam
        );

        if (!found) {
          await interaction.reply({
            ephemeral: true,
            content: `❌ Craft Essence "${ceNameParam}" not found in database.`
          });
          return;
        }

        activeServant.equippedCeId = found.id;
        activeServant.equippedCe = found;
        await saveMaster(master);

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Craft Essence Equipped!')
          .setDescription(
            `Equipped **${found.name}** (★${found.rarity}) to **${servantName}**!\n\n` +
            `**Effect:** ${found.effectText}\n` +
            `**Bonus:** +${found.atkBonus || 0} ATK, +${found.hpBonus || 0} HP`
          )
          .setColor(0x38bdf8);

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Interactive Dropdown Menu selector
      const availableCes = master.craftEssences?.length ? master.craftEssences : CRAFT_ESSENCE_DATABASE;

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('customise_select_ce')
        .setPlaceholder('Choose a Craft Essence to equip...')
        .addOptions(
          availableCes.slice(0, 25).map((c: any) => ({
            label: c.name,
            description: `★${c.rarity} • ${c.effectText.slice(0, 50)}`,
            value: c.id,
            default: activeServant.equippedCeId === c.id
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Equip Craft Essence: ${servantName}`)
        .setDescription(
          `Current CE: **${activeServant.equippedCe?.name || 'None'}**\n\n` +
          `Select an essence from the menu below to bind its mystic code to your Servant:`
        )
        .setColor(0x38bdf8);

      const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i: any) => i.user.id === interaction.user.id,
        idle: 120000,
        time: 600000
      });

      collector.on('collect', async (i: any) => {
        try {
          if (i.replied || i.deferred) return;
          collector.resetTimer();
          const ceId = i.values[0];
        const picked = CRAFT_ESSENCE_DATABASE.find(c => c.id === ceId);
        if (picked) {
          activeServant.equippedCeId = picked.id;
          activeServant.equippedCe = picked;
          await saveMaster(master);

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🛡️ Craft Essence Equipped!')
                .setDescription(
                  `Successfully equipped **${picked.name}** to **${servantName}**!\n\n` +
                  `**Effect:** ${picked.effectText}\n` +
                  `**Stat Bonus:** +${picked.atkBonus || 0} ATK | +${picked.hpBonus || 0} HP`
                )
                .setColor(0x22c55e)
            ],
            components: []
          });
        }
        } catch (err: any) {
          if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
          console.error('Error in customise collector:', err);
        }
      });
      return;
    }

    // ==========================================
    // SUBCOMMAND C: CUSTOM QUOTES
    // ==========================================
    if (subcommand === 'quote') {
      const type = interaction.options.getString('type', true);
      const text = interaction.options.getString('text', true);

      if (!activeServant.customQuotes) {
        activeServant.customQuotes = {};
      }

      // Overwrite the specific voice line
      (activeServant.customQuotes as any)[type] = text;
      await saveMaster(master);

      const embed = new EmbedBuilder()
        .setTitle('💬 Custom Voice Line Saved!')
        .setDescription(
          `Updated **${type}** line for **${servantName}**:\n\n` +
          `*"${text}"*`
        )
        .setColor(0x22c55e);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ==========================================
    // SUBCOMMAND D: NICKNAME
    // ==========================================
    if (subcommand === 'nickname') {
      const name = interaction.options.getString('name', true);
      activeServant.nickname = name;
      await saveMaster(master);

      await interaction.reply({
        content: `✨ Servant nickname updated to **${name}**!`
      });
      return;
    }

  } catch (error: any) {
    console.error('Error executing /customise:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}
