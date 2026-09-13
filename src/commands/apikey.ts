import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonInteraction
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { ApiProviderType, UserCustomApiConfig } from '../types';
import {
  maskApiKey,
  PROVIDER_DISPLAY_NAMES,
  DEFAULT_PROVIDER_MODELS,
  testProviderConnection
} from '../engine/byokService';

export const data = new SlashCommandBuilder()
  .setName('apikey')
  .setDescription('Configure your personal AI API key (Gemini, OpenRouter, NanoGPT) for unlimited Servant chats')
  .addSubcommand(sub =>
    sub
      .setName('tutorial')
      .setDescription('Beginner-friendly step-by-step guide on how to get a free API key in 1 minute')
  )
  .addSubcommand(sub =>
    sub
      .setName('dashboard')
      .setDescription('Open your private API Key management dashboard')
  )
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Set or update your personal API key')
      .addStringOption(opt =>
        opt
          .setName('provider')
          .setDescription('Select the AI provider')
          .setRequired(true)
          .addChoices(
            { name: 'Google Gemini (AI Studio)', value: 'gemini' },
            { name: 'OpenRouter.ai', value: 'openrouter' },
            { name: 'NanoGPT', value: 'nanogpt' },
            { name: 'Custom OpenAI-Compatible API', value: 'custom' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('key')
          .setDescription('Your private API key (e.g. AIzaSy..., sk-or-v1-...)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('model')
          .setDescription('Optional specific model name to use')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('endpoint')
          .setDescription('Optional custom base URL endpoint (for custom provider only)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('test')
      .setDescription('Test your currently active API key connection')
  )
  .addSubcommand(sub =>
    sub
      .setName('toggle')
      .setDescription('Enable or disable your personal API key')
  )
  .addSubcommand(sub =>
    sub
      .setName('clear')
      .setDescription('Remove your stored API keys and return to standard server quota')
  );

/**
 * Builds the private BYOK dashboard embed and control buttons.
 */
export function buildApiKeyDashboard(master: any) {
  const cfg: UserCustomApiConfig = master.customApiConfig || {
    activeProvider: 'gemini',
    enabled: false
  };

  const activeProvider = cfg.activeProvider || 'gemini';
  const isEnabled = !!cfg.enabled;

  const geminiMasked = maskApiKey(cfg.geminiKey);
  const openrouterMasked = maskApiKey(cfg.openrouterKey);
  const nanogptMasked = maskApiKey(cfg.nanogptKey);
  const customMasked = maskApiKey(cfg.customKey);

  const activeModel =
    activeProvider === 'gemini' ? (cfg.geminiModel || DEFAULT_PROVIDER_MODELS.gemini) :
    activeProvider === 'openrouter' ? (cfg.openrouterModel || DEFAULT_PROVIDER_MODELS.openrouter) :
    activeProvider === 'nanogpt' ? (cfg.nanogptModel || DEFAULT_PROVIDER_MODELS.nanogpt) :
    (cfg.customModel || 'default');

  const hasAnyKey = !!(cfg.geminiKey || cfg.openrouterKey || cfg.nanogptKey || cfg.customKey);

  const embed = new EmbedBuilder()
    .setTitle('🔑 Personal AI API Key Management (BYOK)')
    .setDescription(
      `Master **${master.username}**, connect your personal API key from **Google AI Studio**, **OpenRouter**, or **NanoGPT** to bypass daily chat limits and unlock **unlimited telepathic communion** with your Servants!\n\n` +
      `🛡️ *All API keys are strictly private and accessible only to your account.*`
    )
    .addFields(
      {
        name: '⚙️ BYOK Status',
        value: `${isEnabled ? '🟢 **Active & Enabled** (Unlimited Chats)' : '⚪ **Disabled** (Using Standard Server Quota)'}\n• **Selected Provider:** \`${PROVIDER_DISPLAY_NAMES[activeProvider]}\`\n• **Model:** \`${activeModel}\``,
        inline: false
      },
      {
        name: '🤖 Provider Credentials',
        value:
          `• **Google Gemini:** \`${geminiMasked}\` ${activeProvider === 'gemini' ? '◀ *(Active)*' : ''}\n` +
          `• **OpenRouter:** \`${openrouterMasked}\` ${activeProvider === 'openrouter' ? '◀ *(Active)*' : ''}\n` +
          `• **NanoGPT:** \`${nanogptMasked}\` ${activeProvider === 'nanogpt' ? '◀ *(Active)*' : ''}\n` +
          `• **Custom API:** \`${customMasked}\` ${activeProvider === 'custom' ? '◀ *(Active)*' : ''}`,
        inline: false
      }
    )
    .setColor(isEnabled ? 0x10b981 : 0x64748b)
    .setFooter({ text: 'Fate BYOK Engine • Unlimited Telepathic Resonance' });

  if (cfg.lastTestedAt) {
    const statusText = cfg.lastTestStatus === 'success' ? '✅ Operational' : '❌ Test Failed';
    const dateStr = new Date(cfg.lastTestedAt).toLocaleTimeString();
    embed.addFields({
      name: '📡 Last Test Connection',
      value: `Status: **${statusText}** at \`${dateStr}\``,
      inline: false
    });
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:gemini')
      .setLabel('Set Gemini Key')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔷'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:openrouter')
      .setLabel('Set OpenRouter Key')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:nanogpt')
      .setLabel('Set NanoGPT Key')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚡'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_tutorial')
      .setLabel('📖 Setup Guide')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_test')
      .setLabel('Test Active Key')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🧪')
      .setDisabled(!hasAnyKey),
    new ButtonBuilder()
      .setCustomId('btn_apikey_toggle')
      .setLabel(isEnabled ? 'Disable BYOK' : 'Enable BYOK')
      .setStyle(isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setEmoji(isEnabled ? '⏸️' : '▶️')
      .setDisabled(!hasAnyKey),
    new ButtonBuilder()
      .setCustomId('btn_apikey_clear')
      .setLabel('Clear Keys')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
      .setDisabled(!hasAnyKey)
  );

  return { embed, components: [row1, row2] };
}

/**
 * Builds the beginner-friendly step-by-step tutorial embed.
 */
export function buildApiKeyTutorial() {
  const embed = new EmbedBuilder()
    .setTitle('📖 Beginner’s Guide: How to Get a Free AI API Key (In 60 Seconds)')
    .setDescription(
      `### 🤔 What is an API Key?\n` +
      `Think of an **API Key** as a **free VIP pass from Google** that lets the bot talk directly to Google's AI on your behalf.\n\n` +
      `• **Cost:** **$0.00 (100% Free)** — No credit card or payment required.\n` +
      `• **Benefit:** Gives you **unlimited telepathic chats** with your Servant, completely bypassing server daily limits!\n` +
      `• **Privacy:** Your key is strictly private to your Discord user and never shown in public channels.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🔷 Option 1: Google Gemini (Recommended — 100% Free)\n` +
      `1️⃣ Open **[Google AI Studio (Click Here)](https://aistudio.google.com/apikey)** in your browser or phone.\n` +
      `2️⃣ Sign in with your standard **Google / Gmail account**.\n` +
      `3️⃣ Click the blue button that says **"Create API key"** (or "Get API key").\n` +
      `4️⃣ Click **"Copy"** next to your new key (starts with \`AIzaSy...\`).\n` +
      `5️⃣ Come back to Discord and click **"Set Gemini Key"** below, then paste it!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### 🌐 Option 2: OpenRouter or NanoGPT (For Advanced Users)\n` +
      `• **OpenRouter:** Visit [openrouter.ai/keys](https://openrouter.ai/keys) to generate a key for models like Claude, Llama 3.3, or Mistral.\n` +
      `• **NanoGPT:** Visit [nano-gpt.com](https://nano-gpt.com) for pay-as-you-go micro-inference.\n\n` +
      `💡 *Tip: Most players only need the **Google Gemini** free key for infinite chats!*`
    )
    .setColor(0x38bdf8)
    .setFooter({ text: 'Fate Holy Grail War • Zero-Cost Setup Guide' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:gemini')
      .setLabel('🔷 Set Gemini Key (Free)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:openrouter')
      .setLabel('🌐 Set OpenRouter Key')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('🔙 Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, components: [row] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand(false) || 'dashboard';
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

  if (subcommand === 'tutorial' || subcommand === 'guide' || subcommand === 'help') {
    const { embed, components } = buildApiKeyTutorial();
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'dashboard') {
    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'set') {
    const provider = interaction.options.getString('provider', true) as ApiProviderType;
    const key = interaction.options.getString('key', true).trim();
    const model = interaction.options.getString('model')?.trim();
    const endpoint = interaction.options.getString('endpoint')?.trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Test the key first
    const testResult = await testProviderConnection(provider, key, model, endpoint);

    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: provider,
        enabled: true
      };
    }

    master.customApiConfig.activeProvider = provider;
    master.customApiConfig.enabled = true;
    master.customApiConfig.lastTestedAt = Date.now();
    master.customApiConfig.lastTestStatus = testResult.success ? 'success' : 'failed';

    if (provider === 'gemini') {
      master.customApiConfig.geminiKey = key;
      if (model) master.customApiConfig.geminiModel = model;
    } else if (provider === 'openrouter') {
      master.customApiConfig.openrouterKey = key;
      if (model) master.customApiConfig.openrouterModel = model;
    } else if (provider === 'nanogpt') {
      master.customApiConfig.nanogptKey = key;
      if (model) master.customApiConfig.nanogptModel = model;
    } else if (provider === 'custom') {
      master.customApiConfig.customKey = key;
      if (model) master.customApiConfig.customModel = model;
      if (endpoint) master.customApiConfig.customEndpoint = endpoint;
    }

    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);

    const statusMsg = testResult.success
      ? `✅ **API Key verified and activated successfully!**\n• ${testResult.message}\n• Provider: **${PROVIDER_DISPLAY_NAMES[provider]}**\n• Unlimited Servant chats are now **Active**.`
      : `⚠️ **Key saved, but connection test failed:**\n• *${testResult.message}*\n• Please verify your key or model name and try testing again.`;

    await interaction.editReply({
      content: statusMsg,
      embeds: [embed],
      components
    });
    return;
  }

  if (subcommand === 'test') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cfg = master.customApiConfig;
    if (!cfg) {
      await interaction.editReply({
        content: '❌ No custom API key configured yet. Use `/apikey set` or `/apikey dashboard`.'
      });
      return;
    }

    const provider = cfg.activeProvider || 'gemini';
    const key =
      provider === 'gemini' ? cfg.geminiKey :
      provider === 'openrouter' ? cfg.openrouterKey :
      provider === 'nanogpt' ? cfg.nanogptKey :
      cfg.customKey;

    if (!key) {
      await interaction.editReply({
        content: `❌ No API key found for the active provider (${PROVIDER_DISPLAY_NAMES[provider]}).`
      });
      return;
    }

    const model =
      provider === 'gemini' ? cfg.geminiModel :
      provider === 'openrouter' ? cfg.openrouterModel :
      provider === 'nanogpt' ? cfg.nanogptModel :
      cfg.customModel;

    const testRes = await testProviderConnection(provider, key, model, cfg.customEndpoint);
    cfg.lastTestedAt = Date.now();
    cfg.lastTestStatus = testRes.success ? 'success' : 'failed';
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.editReply({
      content: testRes.success
        ? `✅ **Test Passed!** Connection to **${PROVIDER_DISPLAY_NAMES[provider]}** is operational. (${testRes.message})`
        : `❌ **Test Failed:** ${testRes.message}`,
      embeds: [embed],
      components
    });
    return;
  }

  if (subcommand === 'toggle') {
    if (!master.customApiConfig) {
      await interaction.reply({
        content: '❌ No custom API key configured yet.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    master.customApiConfig.enabled = !master.customApiConfig.enabled;
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: master.customApiConfig.enabled
        ? '🟢 **BYOK Enabled!** Unlimited telepathic chats activated.'
        : '⚪ **BYOK Disabled.** Standard daily server quota restored.',
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'clear') {
    master.customApiConfig = undefined;
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: '🗑️ **Custom API keys removed.** Returned to standard daily server quota.',
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Creates the modal for setting a key via interactive button.
 */
export function createApiKeyModal(provider: ApiProviderType) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_set_api_key:${provider}`)
    .setTitle(`Configure ${PROVIDER_DISPLAY_NAMES[provider]}`);

  const keyInput = new TextInputBuilder()
    .setCustomId('api_key_input')
    .setLabel('API Key')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(
      provider === 'gemini' ? 'AIzaSy...' :
      provider === 'openrouter' ? 'sk-or-v1-...' :
      'Your API key'
    )
    .setRequired(true);

  const modelInput = new TextInputBuilder()
    .setCustomId('model_name_input')
    .setLabel('Model Name (Optional - leave blank for default)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Default: ${DEFAULT_PROVIDER_MODELS[provider]}`)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput)
  );

  return modal;
}

/**
 * Handles modal submit for saving an API key.
 */
export async function handleApiKeyModalSubmit(interaction: ModalSubmitInteraction, provider: ApiProviderType) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const key = interaction.fields.getTextInputValue('api_key_input')?.trim();
  const model = interaction.fields.getTextInputValue('model_name_input')?.trim();

  if (!key) {
    await interaction.editReply({ content: '❌ API Key cannot be empty.' });
    return;
  }

  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const testRes = await testProviderConnection(provider, key, model);

  if (!master.customApiConfig) {
    master.customApiConfig = {
      activeProvider: provider,
      enabled: true
    };
  }

  master.customApiConfig.activeProvider = provider;
  master.customApiConfig.enabled = true;
  master.customApiConfig.lastTestedAt = Date.now();
  master.customApiConfig.lastTestStatus = testRes.success ? 'success' : 'failed';

  if (provider === 'gemini') {
    master.customApiConfig.geminiKey = key;
    if (model) master.customApiConfig.geminiModel = model;
  } else if (provider === 'openrouter') {
    master.customApiConfig.openrouterKey = key;
    if (model) master.customApiConfig.openrouterModel = model;
  } else if (provider === 'nanogpt') {
    master.customApiConfig.nanogptKey = key;
    if (model) master.customApiConfig.nanogptModel = model;
  }

  await saveMaster(master);

  const { embed, components } = buildApiKeyDashboard(master);

  const statusMsg = testRes.success
    ? `✅ **${PROVIDER_DISPLAY_NAMES[provider]} Key configured and tested successfully!**\n• ${testRes.message}\n• Unlimited Servant chats are now **Active**.`
    : `⚠️ **Key saved, but initial connection test failed:**\n• *${testRes.message}*\n• You can re-test or edit your settings anytime from the dashboard.`;

  await interaction.editReply({
    content: statusMsg,
    embeds: [embed],
    components
  });
}

/**
 * Handles button interactions for the API Key dashboard.
 */
export async function handleApiKeyButtonInteraction(interaction: ButtonInteraction, btnId: string) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

  if (btnId.startsWith('btn_apikey_modal:')) {
    const provider = btnId.split(':')[1] as ApiProviderType;
    const modal = createApiKeyModal(provider);
    await interaction.showModal(modal);
    return;
  }

  if (btnId === 'btn_apikey_test') {
    await interaction.deferUpdate();
    const cfg = master.customApiConfig;
    if (!cfg) {
      await interaction.followUp({ content: '❌ No API key configured.', flags: MessageFlags.Ephemeral });
      return;
    }
    const provider = cfg.activeProvider || 'gemini';
    const key =
      provider === 'gemini' ? cfg.geminiKey :
      provider === 'openrouter' ? cfg.openrouterKey :
      provider === 'nanogpt' ? cfg.nanogptKey :
      cfg.customKey;

    if (!key) {
      await interaction.followUp({ content: '❌ No key found for active provider.', flags: MessageFlags.Ephemeral });
      return;
    }

    const model =
      provider === 'gemini' ? cfg.geminiModel :
      provider === 'openrouter' ? cfg.openrouterModel :
      provider === 'nanogpt' ? cfg.nanogptModel :
      cfg.customModel;

    const testRes = await testProviderConnection(provider, key, model, cfg.customEndpoint);
    cfg.lastTestedAt = Date.now();
    cfg.lastTestStatus = testRes.success ? 'success' : 'failed';
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.editReply({
      embeds: [embed],
      components
    });
    return;
  }

  if (btnId === 'btn_apikey_toggle') {
    if (master.customApiConfig) {
      master.customApiConfig.enabled = !master.customApiConfig.enabled;
      await saveMaster(master);
    }
    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.update({
      embeds: [embed],
      components
    });
    return;
  }

  if (btnId === 'btn_apikey_clear') {
    master.customApiConfig = undefined;
    await saveMaster(master);
    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.update({
      embeds: [embed],
      components
    });
    return;
  }

  if (btnId === 'btn_apikey_tutorial') {
    const { embed, components } = buildApiKeyTutorial();
    if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
      await interaction.update({
        embeds: [embed],
        components
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral
      });
    }
    return;
  }

  if (btnId === 'btn_apikey_dashboard') {
    const { embed, components } = buildApiKeyDashboard(master);
    if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
      await interaction.update({
        embeds: [embed],
        components
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral
      });
    }
  }
}
