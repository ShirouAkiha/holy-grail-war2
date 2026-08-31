/**
 * Slash Command: /summon
 * Description: Perform authentic Holy Grail Summoning Ritual to contract a random available Heroic Spirit
 * Library: discord.js v14
 */

export const summonCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  getAvailableThroneServants, 
  getAllThroneServants 
} from '../database/service';
import { MasterServantInstance, ServantTemplate } from '../types';

export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('Perform the Holy Grail Summoning Ritual to contract a Heroic Spirit')
  .addSubcommand(sub =>
    sub
      .setName('ritual')
      .setDescription('Draw the magic circle and summon a random available Servant from the Throne of Heroes')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Inspect your active Holy Grail War Servant contract and Command Seals')
  )
  .addSubcommand(sub =>
    sub
      .setName('release')
      .setDescription('Sever your contract with your current Servant to allow a new summoning')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const subcommand = interaction.options.getSubcommand(false) || 'ritual';

  if (subcommand === 'ritual') {
    // Check if Master is already bound to a Servant
    if (master.servants && master.servants.length > 0) {
      const s = master.servants[0];
      const boundEmbed = new EmbedBuilder()
        .setTitle('⚠️ Sacred Contract Already Bound')
        .setDescription(
          \`You are already bound to **\${s.template.name}** (\\\`\${s.template.servantClass}\\\`) in this Holy Grail War!\\n\\n\` +
          \`• Command Seals: 🔴🔴🔴 **\${master.commandSeals}/3**\\n\` +
          \`• Level: **\${s.level}** | HP: \${s.template.baseHp.toLocaleString()} | ATK: \${s.template.baseAtk.toLocaleString()}\\n\\n\` +
          \`*In an authentic Holy Grail War, each Master is bound to a single Heroic Spirit. Use \\\`/summon release\\\` to sever your contract.*\`
        )
        .setThumbnail(s.template.avatarUrl)
        .setColor(0xf59e0b);

      await interaction.reply({ embeds: [boundEmbed] });
      return;
    }

    const availablePool = getAvailableThroneServants();
    if (availablePool.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 The Throne of Heroes is Fully Manifested')
            .setDescription('All Heroic Spirits in the Throne are currently contracted in this War.')
            .setColor(0xef4444)
        ]
      });
      return;
    }

    // Pick ONE random unclaimed Heroic Spirit
    const selectedTemplate: ServantTemplate = availablePool[Math.floor(Math.random() * availablePool.length)];

    const newServant: MasterServantInstance = {
      id: \`contract_\${selectedTemplate.id}_\${Date.now()}\`,
      masterId: master.id,
      templateId: selectedTemplate.id,
      level: 1,
      experience: 0,
      allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
      availableStatPoints: 10,
      skillLevels: [1, 1, 1],
      customQuotes: {
        summon: selectedTemplate.summonQuote,
        battleStart: selectedTemplate.battleStartQuote,
        noblePhantasm: selectedTemplate.noblePhantasm.chant,
        victory: selectedTemplate.victoryQuote,
        defeat: selectedTemplate.defeatQuote
      },
      bondLevel: 1,
      template: selectedTemplate
    };

    master.servants = [newServant];
    master.activeServantId = newServant.id;
    master.commandSeals = 3;
    await saveMaster(master);

    const summonEmbed = new EmbedBuilder()
      .setTitle(\`✨ HEROIC SPIRIT SUMMONED: \${selectedTemplate.name.toUpperCase()}\`)
      .setDescription(
        \`*“Let silver and iron be the essence. Let stone and the archduke of contracts be the foundation...”*\\n\\n\` +
        \`🗣️ **"\${selectedTemplate.summonQuote}"**\\n\\n\` +
        \`• **True Name:** **\${selectedTemplate.name}** [\\\`\${selectedTemplate.servantClass}\\\`]\\n\` +
        \`• **Noble Phantasm:** **\${selectedTemplate.noblePhantasm.name}** [\\\`\${selectedTemplate.noblePhantasm.cardType}\\\`]\\n\` +
        \`• **Command Seals Bestowed:** 3 / 3\\n\\n\` +
        \`*Contract bound for the Fuyuki Holy Grail War! Use \\\`/servant\\\` or \\\`/duel\\\` to begin.*\`
      )
      .setImage(selectedTemplate.cardArtUrl || selectedTemplate.avatarUrl)
      .setColor(0xd4af37);

    await interaction.reply({ embeds: [summonEmbed] });
  }
}
`;
