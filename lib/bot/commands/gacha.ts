import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('🔮 Greater Grail Invocation Sanctum — Summon Heroic Spirits, Craft Essences & Claim Daily SQ')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('summon')
      .setDescription('Summon a random Heroic Spirit from the Throne of Heroes (3 SQ)')
  )
  .addSubcommand(sub =>
    sub
      .setName('ce')
      .setDescription('Summon Craft Essences from the Sanctum Pool (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of rolls (1 or 10)')
          .setRequired(false)
          .addChoices(
            { name: '1x Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz - 4★+ Guaranteed)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('daily')
      .setDescription('💎 Claim your Daily 30 Saint Quartz reward')
  )
  .addSubcommand(sub =>
    sub
      .setName('rates')
      .setDescription('📜 View summoning rates and pity guarantees')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content: '🔮 Greater Grail Invocation Sanctum opened! Use the interactive tabs below to summon spirits and craft essences.',
    ephemeral: true
  });
}
