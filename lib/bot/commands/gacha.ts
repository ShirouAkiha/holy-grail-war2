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
  .setDescription('👑 Throne of Heroes & Greater Grail Invocation — Summon Servants & Craft Essences')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('servant')
      .setDescription('Summon Heroic Spirits from the Throne of Heroes into your roster (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1 or 10)')
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
      .setDescription('💎 Claim your Daily 30 Saint Quartz reward (Free 10x Multi-Summon)')
  )
  .addSubcommand(sub =>
    sub
      .setName('rates')
      .setDescription('📜 View summoning rates and balance matrix')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content: '👑 Greater Grail Invocation Sanctum opened! Use the interactive tabs to summon Servants, forge Craft Essences, and claim daily rewards.',
    ephemeral: true
  });
}
