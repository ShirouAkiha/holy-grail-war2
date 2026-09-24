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
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { ApiProviderType, UserCustomApiConfig } from '../types';
import {
  maskApiKey,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_FREE_TIER_NOTES,
  DEFAULT_PROVIDER_MODELS,
  PROVIDER_ALL_MODELS_CATALOG,
  getModelsForProvider,
  fetchLiveProviderModels,
  ProviderModelSpec,
  testProviderConnection
} from '../engine/byokService';
import { encryptSecret, redactSensitiveKeysFromText } from '../utils/cryptoSecurity';

export const data = new SlashCommandBuilder()
  .setName('apikey')
  .setDescription('Freedom of AI: Choose providers & any model (Groq, Gemini, OpenRouter, DeepSeek, Ollama, Custom)')
  .addSubcommand(sub =>
    sub
      .setName('dashboard')
      .setDescription('Open your private AI provider & model management dashboard')
  )
  .addSubcommand(sub =>
    sub
      .setName('models')
      .setDescription('Browse all available models from your active provider or any other provider')
      .addStringOption(opt =>
        opt
          .setName('provider')
          .setDescription('Optional: Choose which provider to browse models for')
          .setRequired(false)
          .addChoices(
            { name: 'Google Gemini (AI Studio)', value: 'gemini' },
            { name: 'Groq Cloud (Ultra-Fast LPUs)', value: 'groq' },
            { name: 'OpenRouter.ai (All Models & :free Tier)', value: 'openrouter' },
            { name: 'DeepSeek Direct API (V3 & R1)', value: 'deepseek' },
            { name: 'Mistral AI (La Plateforme)', value: 'mistral' },
            { name: 'Ollama / Local AI (Offline)', value: 'ollama' },
            { name: 'NanoGPT', value: 'nanogpt' },
            { name: 'Custom OpenAI-Compatible Endpoint', value: 'custom' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('freemodels')
      .setDescription('Browse all models from your active provider')
  )
  .addSubcommand(sub =>
    sub
      .setName('provider')
      .setDescription('Switch your active AI provider and choose from all its models')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Select the AI provider to activate')
          .setRequired(true)
          .addChoices(
            { name: 'Google Gemini (AI Studio - Free)', value: 'gemini' },
            { name: 'Groq Cloud (Free Ultra-Fast LPUs)', value: 'groq' },
            { name: 'OpenRouter.ai (All Models & Free Tier)', value: 'openrouter' },
            { name: 'DeepSeek Direct API', value: 'deepseek' },
            { name: 'Mistral AI (La Plateforme)', value: 'mistral' },
            { name: 'Ollama / Local AI (Offline Free)', value: 'ollama' },
            { name: 'NanoGPT', value: 'nanogpt' },
            { name: 'Custom OpenAI-Compatible API', value: 'custom' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('model')
      .setDescription('Set or customize the AI model for your active provider (Choose from list or type custom)')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Preset model or leave empty to open the full interactive Model Explorer')
          .setRequired(false)
          .addChoices(
            { name: 'Groq: Llama 3.3 70B Versatile (Flagship 300+ tok/s)', value: 'llama-3.3-70b-versatile' },
            { name: 'Groq: Llama 3.1 8B Instant (Sub-150ms)', value: 'llama-3.1-8b-instant' },
            { name: 'Groq: DeepSeek R1 Distill 70B (Reasoning)', value: 'deepseek-r1-distill-llama-70b' },
            { name: 'Gemini: 3.5 Flash (Flagship Roleplay & Free Tier)', value: 'gemini-3.5-flash' },
            { name: 'Gemini: 3.5 Flash-Lite (Fastest Low-Latency)', value: 'gemini-3.5-flash-lite' },
            { name: 'Gemini: 3.5 Pro (Deep Reasoning & Lore)', value: 'gemini-3.5-pro' },
            { name: 'OpenRouter: meta-llama/llama-3.3-70b-instruct:free', value: 'meta-llama/llama-3.3-70b-instruct:free' },
            { name: 'OpenRouter: anthropic/claude-3.5-sonnet', value: 'anthropic/claude-3.5-sonnet' },
            { name: 'OpenRouter: deepseek/deepseek-r1:free', value: 'deepseek/deepseek-r1:free' },
            { name: 'DeepSeek: deepseek-chat (V3 671B)', value: 'deepseek-chat' },
            { name: 'DeepSeek: deepseek-reasoner (R1 Reasoning)', value: 'deepseek-reasoner' },
            { name: 'Mistral: mistral-large-latest (Flagship)', value: 'mistral-large-latest' },
            { name: 'Mistral: mistral-small-latest (Fast & Free)', value: 'mistral-small-latest' },
            { name: 'Ollama: llama3.3 (Local 70B Offline)', value: 'llama3.3' },
            { name: 'Ollama: llama3.2 (Local Fast)', value: 'llama3.2' },
            { name: 'Ollama: deepseek-r1:7b (Local Reasoning)', value: 'deepseek-r1:7b' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('custom_model_id')
          .setDescription('Type any exact custom model identifier (e.g. meta-llama/llama-3.3-70b-instruct, claude-3.7-sonnet)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Securely connect or update your personal AI credentials (AES-256-GCM encrypted)')
      .addStringOption(opt =>
        opt
          .setName('provider')
          .setDescription('Select the AI provider')
          .setRequired(true)
          .addChoices(
            { name: 'Google Gemini (AI Studio)', value: 'gemini' },
            { name: 'Groq Cloud (Free Ultra-Fast LPUs)', value: 'groq' },
            { name: 'OpenRouter.ai', value: 'openrouter' },
            { name: 'DeepSeek Direct API', value: 'deepseek' },
            { name: 'Mistral AI', value: 'mistral' },
            { name: 'Ollama / Local AI', value: 'ollama' },
            { name: 'NanoGPT', value: 'nanogpt' },
            { name: 'Custom OpenAI-Compatible API', value: 'custom' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('key')
          .setDescription('Optional: Leave blank to open private popup dialog (Zero-leak privacy)')
          .setRequired(false)
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
          .setDescription('Optional custom base URL endpoint (for Ollama or Custom provider)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('tutorial')
      .setDescription('Beginner-friendly step-by-step guide on how to get free API keys in 1 minute')
  )
  .addSubcommand(sub =>
    sub
      .setName('test')
      .setDescription('Test your currently active provider connection')
  )
  .addSubcommand(sub =>
    sub
      .setName('toggle')
      .setDescription('Enable or disable your personal BYOK key')
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
  const groqMasked = maskApiKey(cfg.groqKey);
  const openrouterMasked = maskApiKey(cfg.openrouterKey);
  const deepseekMasked = maskApiKey(cfg.deepseekKey);
  const mistralMasked = maskApiKey(cfg.mistralKey);
  const nanogptMasked = maskApiKey(cfg.nanogptKey);
  const customMasked = maskApiKey(cfg.customKey);
  const ollamaStatus = cfg.ollamaEndpoint ? `Custom (${cfg.ollamaEndpoint})` : 'Default (localhost:11434)';

  const activeModel =
    activeProvider === 'gemini' ? (cfg.geminiModel || DEFAULT_PROVIDER_MODELS.gemini) :
    activeProvider === 'groq' ? (cfg.groqModel || DEFAULT_PROVIDER_MODELS.groq) :
    activeProvider === 'openrouter' ? (cfg.openrouterModel || DEFAULT_PROVIDER_MODELS.openrouter) :
    activeProvider === 'deepseek' ? (cfg.deepseekModel || DEFAULT_PROVIDER_MODELS.deepseek) :
    activeProvider === 'mistral' ? (cfg.mistralModel || DEFAULT_PROVIDER_MODELS.mistral) :
    activeProvider === 'nanogpt' ? (cfg.nanogptModel || DEFAULT_PROVIDER_MODELS.nanogpt) :
    activeProvider === 'ollama' ? (cfg.ollamaModel || DEFAULT_PROVIDER_MODELS.ollama) :
    (cfg.customModel || 'default');

  const hasAnyKey = !!(
    cfg.geminiKey ||
    cfg.groqKey ||
    cfg.openrouterKey ||
    cfg.deepseekKey ||
    cfg.mistralKey ||
    cfg.nanogptKey ||
    cfg.customKey ||
    cfg.activeProvider === 'ollama'
  );

  const embed = new EmbedBuilder()
    .setTitle('🔑 AI Provider & Model Management Hub')
    .setDescription(
      `Master **${master.username}**, you have complete freedom to choose any AI provider and select any model (Flagship, Instant, Reasoning, Creative, or Local Offline) for **unlimited telepathic Servant dialogue**!\n\n` +
      `🛡️ *All API keys are strictly confidential, AES-256-GCM encrypted, and stored privately.*`
    )
    .addFields(
      {
        name: '⚙️ Active AI Configuration',
        value:
          `${isEnabled ? '🟢 **Active & Enabled** (Unlimited Chats)' : '⚪ **Disabled** (Using Standard Server Quota)'}\n` +
          `• **Current Provider:** \`${PROVIDER_DISPLAY_NAMES[activeProvider]}\`\n` +
          `• **Active Model:** \`${activeModel}\`\n` +
          `• **Provider Note:** *${PROVIDER_FREE_TIER_NOTES[activeProvider]}*`,
        inline: false
      },
      {
        name: '🤖 Configured Credentials & Status',
        value:
          `• **Google Gemini:** \`${geminiMasked}\` ${activeProvider === 'gemini' ? '◀ *(Active)*' : ''}\n` +
          `• **Groq Cloud:** \`${groqMasked}\` ${activeProvider === 'groq' ? '◀ *(Active)*' : ''}\n` +
          `• **OpenRouter.ai:** \`${openrouterMasked}\` ${activeProvider === 'openrouter' ? '◀ *(Active)*' : ''}\n` +
          `• **DeepSeek Direct:** \`${deepseekMasked}\` ${activeProvider === 'deepseek' ? '◀ *(Active)*' : ''}\n` +
          `• **Mistral AI:** \`${mistralMasked}\` ${activeProvider === 'mistral' ? '◀ *(Active)*' : ''}\n` +
          `• **Ollama Local AI:** \`${ollamaStatus}\` ${activeProvider === 'ollama' ? '◀ *(Active)*' : ''}\n` +
          `• **NanoGPT / Custom:** \`${nanogptMasked || customMasked}\` ${(activeProvider === 'nanogpt' || activeProvider === 'custom') ? '◀ *(Active)*' : ''}`,
        inline: false
      },
      {
        name: '🌟 Complete Freedom of Models',
        value:
          `Click **"📋 Browse All Models"** below to view and select every model available for ${PROVIDER_DISPLAY_NAMES[activeProvider]}, or click **"✏️ Custom Model ID"** to use any unlisted or newly released model!`,
        inline: false
      }
    )
    .setColor(isEnabled ? 0x10b981 : 0xd4af37)
    .setFooter({ text: 'Fate Vault Security Engine • Total Provider & Model Freedom' });

  if (cfg.lastTestedAt) {
    const statusText = cfg.lastTestStatus === 'success' ? '✅ Operational' : '❌ Test Failed';
    const dateStr = new Date(cfg.lastTestedAt).toLocaleTimeString();
    embed.addFields({
      name: '📡 Last Test Connection',
      value: `Status: **${statusText}** at \`${dateStr}\``,
      inline: false
    });
  }

  // Row 1: Model Explorer, Provider Switcher, Custom Model ID, Key Quick Config
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_models_menu')
      .setLabel('📋 Browse All Models')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🤖'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_switch_provider')
      .setLabel('Switch Provider')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_custom_model_modal')
      .setLabel('Custom Model ID')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(`btn_apikey_modal:${activeProvider}`)
      .setLabel(`Set ${PROVIDER_DISPLAY_NAMES[activeProvider].split(' ')[0]} Key`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔑')
  );

  // Row 2: Testing, Toggle, More Providers, Free Key Guide, Clear
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_test')
      .setLabel('Test Active Key')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasAnyKey)
      .setEmoji('🧪'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_toggle')
      .setLabel(isEnabled ? 'Disable BYOK' : 'Enable BYOK')
      .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setDisabled(!hasAnyKey)
      .setEmoji(isEnabled ? '⏸️' : '▶️'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_more_providers')
      .setLabel('All Providers')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_tutorial')
      .setLabel('Free Key Guide')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📖'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_clear')
      .setLabel('Clear Keys')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasAnyKey)
      .setEmoji('🗑️')
  );

  return { embed, components: [row1, row2] };
}

/**
 * Builds the interactive Provider Model Explorer.
 * Shows ALL models available for the selected provider with categories, descriptions,
 * dynamic select menus, live API refresh, and custom model ID support.
 */
export function buildProviderModelExplorer(
  master: any,
  targetProvider?: ApiProviderType,
  overrideModels?: ProviderModelSpec[],
  sourceType: 'live_api' | 'catalog' = 'catalog'
) {
  const cfg: UserCustomApiConfig = master.customApiConfig || {
    activeProvider: 'gemini',
    enabled: false
  };

  const provider = targetProvider || cfg.activeProvider || 'gemini';
  const models = overrideModels || getModelsForProvider(provider);

  const currentActiveModel =
    provider === 'gemini' ? (cfg.geminiModel || DEFAULT_PROVIDER_MODELS.gemini) :
    provider === 'groq' ? (cfg.groqModel || DEFAULT_PROVIDER_MODELS.groq) :
    provider === 'openrouter' ? (cfg.openrouterModel || DEFAULT_PROVIDER_MODELS.openrouter) :
    provider === 'deepseek' ? (cfg.deepseekModel || DEFAULT_PROVIDER_MODELS.deepseek) :
    provider === 'mistral' ? (cfg.mistralModel || DEFAULT_PROVIDER_MODELS.mistral) :
    provider === 'nanogpt' ? (cfg.nanogptModel || DEFAULT_PROVIDER_MODELS.nanogpt) :
    provider === 'ollama' ? (cfg.ollamaModel || DEFAULT_PROVIDER_MODELS.ollama) :
    (cfg.customModel || 'default');

  // Categorize models
  const flagships = models.filter(m => m.category === 'Flagship');
  const fast = models.filter(m => m.category === 'Fast & Instant');
  const reasoning = models.filter(m => m.category === 'Reasoning & CoT');
  const creative = models.filter(m => m.category === 'Creative & Lore' || m.category === 'Open Weights' || m.category === 'Local Offline');

  const embed = new EmbedBuilder()
    .setTitle(`🤖 ${PROVIDER_DISPLAY_NAMES[provider]} — Model Explorer`)
    .setDescription(
      `Master **${master.username}**, select any model from the list below to use with **${PROVIDER_DISPLAY_NAMES[provider]}**.\n\n` +
      `• **Active Selected Model:** \`${currentActiveModel}\`\n` +
      `• **Catalog Source:** ${sourceType === 'live_api' ? '⚡ **Live Provider Endpoint** (Real-time)' : '📦 **Comprehensive Provider Catalog**'}\n` +
      `• **Total Available:** \`${models.length} models listed\`\n\n` +
      `*Choose a model from the dropdown below or click "Type Custom Model ID" to enter any new unlisted model identifier.*`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Select a model from the menu below • Instant activation' });

  if (flagships.length > 0) {
    embed.addFields({
      name: '👑 Flagship Models',
      value: flagships.slice(0, 5).map(m => `• **\`${m.id}\`** — ${m.name}${m.isFreeTier ? ' *(Free)*' : ''}\n  *${m.description.slice(0, 90)}*`).join('\n'),
      inline: false
    });
  }

  if (fast.length > 0) {
    embed.addFields({
      name: '⚡ Fast & Low Latency',
      value: fast.slice(0, 4).map(m => `• **\`${m.id}\`** — ${m.name}${m.isFreeTier ? ' *(Free)*' : ''}\n  *${m.description.slice(0, 90)}*`).join('\n'),
      inline: false
    });
  }

  if (reasoning.length > 0) {
    embed.addFields({
      name: '🧠 Chain-of-Thought & Reasoning',
      value: reasoning.slice(0, 4).map(m => `• **\`${m.id}\`** — ${m.name}${m.isFreeTier ? ' *(Free)*' : ''}\n  *${m.description.slice(0, 90)}*`).join('\n'),
      inline: false
    });
  }

  if (creative.length > 0 && embed.data.fields && embed.data.fields.length < 5) {
    embed.addFields({
      name: '🎨 Creative & Lore / Open Weights',
      value: creative.slice(0, 4).map(m => `• **\`${m.id}\`** — ${m.name}${m.isFreeTier ? ' *(Free)*' : ''}`).join('\n'),
      inline: false
    });
  }

  // Build Select Menu (up to 25 items limit of Discord select menu)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_apikey_provider_model:${provider}`)
    .setPlaceholder(`👉 Select a model for ${PROVIDER_DISPLAY_NAMES[provider].split(' ')[0]}...`);

  const selectOptions = models.slice(0, 25).map(m => {
    let emoji = '🤖';
    if (m.category === 'Flagship') emoji = '👑';
    else if (m.category === 'Fast & Instant') emoji = '⚡';
    else if (m.category === 'Reasoning & CoT') emoji = '🧠';
    else if (m.category === 'Creative & Lore') emoji = '🎨';
    else if (m.category === 'Local Offline') emoji = '💻';
    else if (m.isFreeTier) emoji = '🎁';

    const label = (m.name.length > 90 ? m.name.slice(0, 87) + '...' : m.name);
    const desc = (m.id.length > 90 ? m.id.slice(0, 87) + '...' : m.id);

    return new StringSelectMenuOptionBuilder()
      .setValue(m.id)
      .setLabel(label)
      .setDescription(desc)
      .setEmoji(emoji)
      .setDefault(m.id === currentActiveModel);
  });

  selectMenu.addOptions(selectOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Button Row: Custom Model ID, Refresh Live, Switch Provider, Dashboard
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_apikey_custom_model_modal:${provider}`)
      .setLabel('Type Custom Model ID')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(`btn_apikey_refresh_models:${provider}`)
      .setLabel('Fetch Live Models')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_switch_provider')
      .setLabel('Other Providers')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [selectRow, btnRow] };
}

/**
 * Backwards compatibility helper for free models menu.
 */
export function buildFreeModelsMenu(master: any) {
  return buildProviderModelExplorer(master);
}

/**
 * Builds the provider switcher menu.
 */
export function buildProviderSwitchMenu(master: any) {
  const currentProvider = master.customApiConfig?.activeProvider || 'gemini';

  const embed = new EmbedBuilder()
    .setTitle('🔄 Switch AI Provider & Explore Models')
    .setDescription(
      `Master **${master.username}**, choose any AI provider below.\n\n` +
      `When you select a provider, you will immediately see **all models offered by that provider** with full freedom to customize!\n\n` +
      `• **Google Gemini:** AI Studio free tier, 1M+ context, deep visual novel roleplay\n` +
      `• **Groq Cloud:** 100% Free API, ultra-fast 300+ tok/s LPUs (Llama 3.3 70B, DeepSeek R1)\n` +
      `• **OpenRouter:** Over 200+ models (Claude 3.5/3.7, GPT-4o, DeepSeek R1, plus 20+ free models)\n` +
      `• **DeepSeek Direct:** Official direct deepseek.com API for V3 & R1\n` +
      `• **Mistral AI:** European frontier models (Mistral Large, Small, Codestral)\n` +
      `• **Ollama Local AI:** 100% Free offline execution on your own computer\n` +
      `• **Custom / NanoGPT:** Any OpenAI-compatible endpoint or micro-credit gateway`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Select an AI provider from the dropdown below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_apikey_provider')
    .setPlaceholder('Select an AI Provider to view its models...');

  const providers: { value: ApiProviderType; label: string; desc: string; emoji: string }[] = [
    { value: 'gemini', label: 'Google Gemini (AI Studio)', desc: 'Gemini 3.5 Flash, 3.5 Pro, 2.5 Flash, 1.5 Pro', emoji: '🔷' },
    { value: 'groq', label: 'Groq Cloud (Ultra-Fast LPUs)', desc: 'Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1 Distill', emoji: '⚡' },
    { value: 'openrouter', label: 'OpenRouter.ai', desc: 'Claude 3.5/3.7, GPT-4o, DeepSeek R1, 20+ Free Models', emoji: '🌐' },
    { value: 'deepseek', label: 'DeepSeek Direct API', desc: 'DeepSeek V3 (671B MoE) & DeepSeek R1 Reasoning', emoji: '🌟' },
    { value: 'mistral', label: 'Mistral AI (La Plateforme)', desc: 'Mistral Large, Mistral Small, Codestral, Pixtral', emoji: '🦊' },
    { value: 'ollama', label: 'Ollama / Local AI', desc: 'Llama 3.3, DeepSeek R1, Mistral, Qwen (100% Offline)', emoji: '💻' },
    { value: 'nanogpt', label: 'NanoGPT', desc: 'GPT-4o, Claude 3.5, DeepSeek paid with Nano micro-credits', emoji: '⚡' },
    { value: 'custom', label: 'Custom OpenAI Endpoint', desc: 'vLLM, LM Studio, Together, or any self-hosted LLM', emoji: '🛠️' }
  ];

  for (const p of providers) {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setValue(p.value)
        .setLabel(p.label)
        .setDescription(p.desc)
        .setEmoji(p.emoji)
        .setDefault(p.value === currentProvider)
    );
  }

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_models_menu')
      .setLabel('View Active Models')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [row1, row2] };
}

/**
 * Builds the secondary providers picker.
 */
export function buildMoreProvidersMenu() {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ All Supported AI Providers')
    .setDescription(
      `Configure credentials and models for any provider:\n\n` +
      `• **Google Gemini:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)\n` +
      `• **Groq Cloud:** [console.groq.com/keys](https://console.groq.com/keys)\n` +
      `• **OpenRouter:** [openrouter.ai/keys](https://openrouter.ai/keys)\n` +
      `• **DeepSeek:** [platform.deepseek.com](https://platform.deepseek.com)\n` +
      `• **Mistral AI:** [console.mistral.ai](https://console.mistral.ai)\n` +
      `• **Ollama:** [ollama.ai](https://ollama.ai) (Runs locally on localhost:11434 with 0 keys)\n` +
      `• **Custom Endpoint:** Any self-hosted vLLM, LM Studio, or OpenAI-compatible gateway.`
    )
    .setColor(0x8b5cf6)
    .setFooter({ text: 'Select a provider button below to configure' });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:gemini')
      .setLabel('Gemini')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔷'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:groq')
      .setLabel('Groq (Free)')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚡'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:openrouter')
      .setLabel('OpenRouter')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:deepseek')
      .setLabel('DeepSeek')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌟'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:mistral')
      .setLabel('Mistral')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🦊')
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:ollama')
      .setLabel('Ollama (Local Offline)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('💻'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:custom')
      .setLabel('Custom Endpoint')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛠️'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_models_menu')
      .setLabel('Browse Models')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [row1, row2] };
}

/**
 * Builds the interactive tutorial embed explaining how to get free keys.
 */
export function buildApiKeyTutorial() {
  const embed = new EmbedBuilder()
    .setTitle('📖 How to Get Free AI Keys in 1 Minute')
    .setDescription(
      `Master, you have multiple completely **100% FREE options** with no credit card required!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### ⚡ Option A: Groq Cloud (Ultra-Fast 300+ tok/s — 100% Free)\n` +
      `1️⃣ Open **[Groq Cloud Console](https://console.groq.com/keys)**.\n` +
      `2️⃣ Sign in with GitHub or Google.\n` +
      `3️⃣ Click **"Create API Key"**, copy your key (\`gsk_...\`), and connect it below!\n` +
      `*Benefits: 100% Free tier, 14,400 requests/day, blistering fast Llama 3.3 70B & DeepSeek R1 Distill!*\n\n` +
      `### 🔷 Option B: Google AI Studio (Gemini — Top VN Character Fidelity)\n` +
      `1️⃣ Open **[Google AI Studio](https://aistudio.google.com/apikey)**.\n` +
      `2️⃣ Sign in with any Google account.\n` +
      `3️⃣ Click **"Create API key"**, copy your key (\`AIzaSy...\`), and connect below.\n` +
      `*Benefits: Free forever tier (15 requests/minute, 1M context), superb visual novel dialogue!*\n\n` +
      `### 🌐 Option C: OpenRouter.ai (Access 200+ Models)\n` +
      `1️⃣ Open **[OpenRouter Keys](https://openrouter.ai/keys)**.\n` +
      `2️⃣ Sign up and click **"Create Key"**.\n` +
      `3️⃣ Choose models ending in \`:free\` for $0.00 unlimited chat or use any paid model of your choice!\n\n` +
      `### 💻 Option D: Ollama / Local AI (100% Free & Offline)\n` +
      `1️⃣ Install [Ollama](https://ollama.ai) on your computer and run \`ollama run llama3.2\`.\n` +
      `2️⃣ Connect via Ollama in the dashboard (Zero keys, runs 100% private on your hardware).`
    )
    .setColor(0xd4af37)
    .setFooter({ text: 'Fate RPG • Free AI Providers & Models Guide' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:groq')
      .setLabel('Connect Groq (Free)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚡'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:gemini')
      .setLabel('Connect Gemini (Free)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔷'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:openrouter')
      .setLabel('Connect OpenRouter')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_models_menu')
      .setLabel('Browse All Models')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [row] };
}

/**
 * Creates a modal for typing any custom model identifier.
 * Ensures the app NEVER gets outdated when new models are released!
 */
export function createCustomModelModal(provider: ApiProviderType, currentModel?: string) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_set_custom_model:${provider}`)
    .setTitle(`Set Custom Model for ${PROVIDER_DISPLAY_NAMES[provider].split(' ')[0]}`);

  const placeholder =
    provider === 'openrouter' ? 'e.g. meta-llama/llama-3.3-70b-instruct, anthropic/claude-3.7-sonnet' :
    provider === 'groq' ? 'e.g. llama-3.3-70b-versatile, deepseek-r1-distill-llama-70b' :
    provider === 'gemini' ? 'e.g. gemini-3.5-flash, gemini-3.5-pro' :
    provider === 'deepseek' ? 'e.g. deepseek-chat, deepseek-reasoner' :
    provider === 'mistral' ? 'e.g. mistral-large-latest, mistral-small-latest' :
    provider === 'ollama' ? 'e.g. llama3.3, deepseek-r1:14b, mistral' :
    'Enter exact model identifier string';

  const modelInput = new TextInputBuilder()
    .setCustomId('custom_model_id_input')
    .setLabel('Exact Model Identifier')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder)
    .setValue(currentModel || '')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput));
  return modal;
}

/**
 * Creates the modal for setting a key.
 */
export function createApiKeyModal(provider: ApiProviderType) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_set_api_key:${provider}`)
    .setTitle(`Configure ${PROVIDER_DISPLAY_NAMES[provider]}`);

  const keyPlaceholder =
    provider === 'gemini' ? 'AIzaSy... (Free on Google AI Studio)' :
    provider === 'groq' ? 'gsk_... (Free on console.groq.com)' :
    provider === 'openrouter' ? 'sk-or-v1-... (openrouter.ai)' :
    provider === 'deepseek' ? 'sk-... (platform.deepseek.com)' :
    provider === 'mistral' ? 'Your Mistral API Key' :
    provider === 'ollama' ? 'Optional Authorization token if using reverse proxy' :
    'Your private API key';

  const keyInput = new TextInputBuilder()
    .setCustomId('api_key_input')
    .setLabel(provider === 'ollama' ? 'Auth Token (Optional for Ollama)' : 'Private API Key (AES-256-GCM Encrypted)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(keyPlaceholder)
    .setRequired(provider !== 'ollama');

  const modelInput = new TextInputBuilder()
    .setCustomId('model_name_input')
    .setLabel('Model Name (Optional - blank for default)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Default: ${DEFAULT_PROVIDER_MODELS[provider]}`)
    .setRequired(false);

  const endpointInput = new TextInputBuilder()
    .setCustomId('endpoint_input')
    .setLabel('Custom Endpoint URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(
      provider === 'ollama'
        ? 'http://localhost:11434/v1/chat/completions'
        : 'https://api.example.com/v1/chat/completions'
    )
    .setRequired(false);

  const rows = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(modelInput)
  ];

  if (provider === 'ollama' || provider === 'custom') {
    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(endpointInput));
  }

  modal.addComponents(...rows);
  return modal;
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

  if (subcommand === 'models' || subcommand === 'freemodels') {
    const providerChoice = interaction.options.getString('provider') as ApiProviderType | null;
    const targetProvider = providerChoice || master.customApiConfig?.activeProvider || 'gemini';
    const { embed, components } = buildProviderModelExplorer(master, targetProvider);
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'provider') {
    const providerName = interaction.options.getString('name', true) as ApiProviderType;
    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: providerName,
        enabled: true
      };
    } else {
      master.customApiConfig.activeProvider = providerName;
      master.customApiConfig.enabled = true;
    }
    await saveMaster(master);

    // Immediately open the model explorer for that provider so the user can choose from all its models!
    const { embed, components } = buildProviderModelExplorer(master, providerName);
    await interaction.reply({
      content: `🔄 **Active provider switched to ${PROVIDER_DISPLAY_NAMES[providerName]}!**\nExplore and choose from all models offered by ${PROVIDER_DISPLAY_NAMES[providerName]} below:`,
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'model') {
    const presetChoice = interaction.options.getString('name');
    const customModelId = interaction.options.getString('custom_model_id');
    const targetModel = (customModelId || presetChoice)?.trim();

    if (!targetModel) {
      // Open full Model Explorer for active provider
      const activeProvider = master.customApiConfig?.activeProvider || 'gemini';
      const { embed, components } = buildProviderModelExplorer(master, activeProvider);
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: 'gemini',
        enabled: true
      };
    }

    const provider = master.customApiConfig.activeProvider || 'gemini';
    if (provider === 'gemini') master.customApiConfig.geminiModel = targetModel;
    else if (provider === 'groq') master.customApiConfig.groqModel = targetModel;
    else if (provider === 'openrouter') master.customApiConfig.openrouterModel = targetModel;
    else if (provider === 'deepseek') master.customApiConfig.deepseekModel = targetModel;
    else if (provider === 'mistral') master.customApiConfig.mistralModel = targetModel;
    else if (provider === 'nanogpt') master.customApiConfig.nanogptModel = targetModel;
    else if (provider === 'ollama') master.customApiConfig.ollamaModel = targetModel;
    else if (provider === 'custom') master.customApiConfig.customModel = targetModel;

    master.customApiConfig.enabled = true;
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: `✅ **Model updated to \`${targetModel}\` for ${PROVIDER_DISPLAY_NAMES[provider]}!**`,
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (subcommand === 'set') {
    const provider = interaction.options.getString('provider', true) as ApiProviderType;
    const rawKeyInput = interaction.options.getString('key')?.trim();
    const model = interaction.options.getString('model')?.trim();
    const endpoint = interaction.options.getString('endpoint')?.trim();

    if (!rawKeyInput && provider !== 'ollama') {
      const modal = createApiKeyModal(provider);
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const testResult = await testProviderConnection(provider, rawKeyInput || '', model, endpoint);
    const encryptedKey = rawKeyInput ? encryptSecret(rawKeyInput) : undefined;

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
      if (encryptedKey) master.customApiConfig.geminiKey = encryptedKey;
      if (model) master.customApiConfig.geminiModel = model;
    } else if (provider === 'groq') {
      if (encryptedKey) master.customApiConfig.groqKey = encryptedKey;
      if (model) master.customApiConfig.groqModel = model;
    } else if (provider === 'openrouter') {
      if (encryptedKey) master.customApiConfig.openrouterKey = encryptedKey;
      if (model) master.customApiConfig.openrouterModel = model;
    } else if (provider === 'deepseek') {
      if (encryptedKey) master.customApiConfig.deepseekKey = encryptedKey;
      if (model) master.customApiConfig.deepseekModel = model;
    } else if (provider === 'mistral') {
      if (encryptedKey) master.customApiConfig.mistralKey = encryptedKey;
      if (model) master.customApiConfig.mistralModel = model;
    } else if (provider === 'ollama') {
      if (model) master.customApiConfig.ollamaModel = model;
      if (endpoint) master.customApiConfig.ollamaEndpoint = endpoint;
      if (encryptedKey) master.customApiConfig.customKey = encryptedKey;
    } else if (provider === 'nanogpt') {
      if (encryptedKey) master.customApiConfig.nanogptKey = encryptedKey;
      if (model) master.customApiConfig.nanogptModel = model;
    } else if (provider === 'custom') {
      if (encryptedKey) master.customApiConfig.customKey = encryptedKey;
      if (model) master.customApiConfig.customModel = model;
      if (endpoint) master.customApiConfig.customEndpoint = endpoint;
    }

    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    const safeMessage = redactSensitiveKeysFromText(testResult.message, rawKeyInput ? [rawKeyInput] : []);
    const statusMsg = testResult.success
      ? `✅ **${PROVIDER_DISPLAY_NAMES[provider]} verified and configured successfully!**\n• ${safeMessage}\n• Unlimited Servant chats are now **Active**.`
      : `⚠️ **Config saved, but connection test failed:**\n• *${safeMessage}*\n• Please verify your key, model, or endpoint.`;

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
        content: '❌ No custom AI configuration found. Use `/apikey set` or `/apikey dashboard`.'
      });
      return;
    }

    const provider = cfg.activeProvider || 'gemini';
    const key =
      provider === 'gemini' ? cfg.geminiKey :
      provider === 'groq' ? cfg.groqKey :
      provider === 'openrouter' ? cfg.openrouterKey :
      provider === 'deepseek' ? cfg.deepseekKey :
      provider === 'mistral' ? cfg.mistralKey :
      provider === 'nanogpt' ? cfg.nanogptKey :
      cfg.customKey;

    if (!key && provider !== 'ollama') {
      await interaction.editReply({
        content: `❌ No API key found for the active provider (${PROVIDER_DISPLAY_NAMES[provider]}).`
      });
      return;
    }

    const model =
      provider === 'gemini' ? cfg.geminiModel :
      provider === 'groq' ? cfg.groqModel :
      provider === 'openrouter' ? cfg.openrouterModel :
      provider === 'deepseek' ? cfg.deepseekModel :
      provider === 'mistral' ? cfg.mistralModel :
      provider === 'nanogpt' ? cfg.nanogptModel :
      provider === 'ollama' ? cfg.ollamaModel :
      cfg.customModel;

    const endpoint = provider === 'ollama' ? cfg.ollamaEndpoint : cfg.customEndpoint;
    const testRes = await testProviderConnection(provider, key || '', model, endpoint);
    cfg.lastTestedAt = Date.now();
    cfg.lastTestStatus = testRes.success ? 'success' : 'failed';
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    const safeMessage = redactSensitiveKeysFromText(testRes.message);
    const feedback = testRes.success
      ? `✅ **Connection Test Passed!**\n• ${safeMessage}\n• Model: \`${testRes.modelUsed}\`\n• Status: Ready for unlimited telepathic dialogue.`
      : `❌ **Connection Test Failed:**\n• *${safeMessage}*\n• Please verify your key permissions or API balance.`;

    await interaction.editReply({
      content: feedback,
      embeds: [embed],
      components
    });
    return;
  }

  if (subcommand === 'toggle') {
    if (!master.customApiConfig) {
      await interaction.reply({
        content: '❌ No AI provider configured yet. Use `/apikey set` or `/apikey models` first.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    master.customApiConfig.enabled = !master.customApiConfig.enabled;
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: master.customApiConfig.enabled
        ? '🟢 **BYOK Enabled.** Unlimited Servant chats activated.'
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
      content: '🗑️ **Custom AI keys removed.** Returned to standard daily server quota.',
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handles modal submit for saving an API key or setting custom model ID.
 */
export async function handleApiKeyModalSubmit(interaction: ModalSubmitInteraction, modalId: string) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

  // 1. Custom Model ID Modal Submit
  if (modalId.startsWith('modal_set_custom_model:')) {
    const provider = modalId.split(':')[1] as ApiProviderType;
    const customModel = interaction.fields.getTextInputValue('custom_model_id_input')?.trim();

    if (!customModel) {
      await interaction.reply({ content: '❌ Model identifier cannot be empty.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: provider,
        enabled: true
      };
    }

    master.customApiConfig.activeProvider = provider;
    if (provider === 'gemini') master.customApiConfig.geminiModel = customModel;
    else if (provider === 'groq') master.customApiConfig.groqModel = customModel;
    else if (provider === 'openrouter') master.customApiConfig.openrouterModel = customModel;
    else if (provider === 'deepseek') master.customApiConfig.deepseekModel = customModel;
    else if (provider === 'mistral') master.customApiConfig.mistralModel = customModel;
    else if (provider === 'nanogpt') master.customApiConfig.nanogptModel = customModel;
    else if (provider === 'ollama') master.customApiConfig.ollamaModel = customModel;
    else if (provider === 'custom') master.customApiConfig.customModel = customModel;

    master.customApiConfig.enabled = true;
    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: `✅ **Model successfully set to \`${customModel}\` for ${PROVIDER_DISPLAY_NAMES[provider]}!**`,
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // 2. API Key Credential Modal Submit
  if (modalId.startsWith('modal_set_api_key:')) {
    const provider = modalId.split(':')[1] as ApiProviderType;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawKey = interaction.fields.getTextInputValue('api_key_input')?.trim();
    const model = interaction.fields.getTextInputValue('model_name_input')?.trim();
    let endpoint: string | undefined;

    try {
      endpoint = interaction.fields.getTextInputValue('endpoint_input')?.trim();
    } catch {
      // field not in modal
    }

    if (!rawKey && provider !== 'ollama') {
      await interaction.editReply({ content: '❌ API Key cannot be empty.' });
      return;
    }

    const testRes = await testProviderConnection(provider, rawKey || '', model, endpoint);
    const encryptedKey = rawKey ? encryptSecret(rawKey) : undefined;

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
      if (encryptedKey) master.customApiConfig.geminiKey = encryptedKey;
      if (model) master.customApiConfig.geminiModel = model;
    } else if (provider === 'groq') {
      if (encryptedKey) master.customApiConfig.groqKey = encryptedKey;
      if (model) master.customApiConfig.groqModel = model;
    } else if (provider === 'openrouter') {
      if (encryptedKey) master.customApiConfig.openrouterKey = encryptedKey;
      if (model) master.customApiConfig.openrouterModel = model;
    } else if (provider === 'deepseek') {
      if (encryptedKey) master.customApiConfig.deepseekKey = encryptedKey;
      if (model) master.customApiConfig.deepseekModel = model;
    } else if (provider === 'mistral') {
      if (encryptedKey) master.customApiConfig.mistralKey = encryptedKey;
      if (model) master.customApiConfig.mistralModel = model;
    } else if (provider === 'ollama') {
      if (model) master.customApiConfig.ollamaModel = model;
      if (endpoint) master.customApiConfig.ollamaEndpoint = endpoint;
      if (encryptedKey) master.customApiConfig.customKey = encryptedKey;
    } else if (provider === 'nanogpt') {
      if (encryptedKey) master.customApiConfig.nanogptKey = encryptedKey;
      if (model) master.customApiConfig.nanogptModel = model;
    } else if (provider === 'custom') {
      if (encryptedKey) master.customApiConfig.customKey = encryptedKey;
      if (model) master.customApiConfig.customModel = model;
      if (endpoint) master.customApiConfig.customEndpoint = endpoint;
    }

    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    const safeMessage = redactSensitiveKeysFromText(testRes.message, rawKey ? [rawKey] : []);
    const statusMsg = testRes.success
      ? `✅ **${PROVIDER_DISPLAY_NAMES[provider]} connected and AES-256-GCM encrypted successfully!**\n• ${safeMessage}\n• Unlimited Servant chats are now **Active**.`
      : `⚠️ **Saved, but connection test failed:**\n• *${safeMessage}*\n• You can edit your settings or re-test anytime from the dashboard.`;

    await interaction.editReply({
      content: statusMsg,
      embeds: [embed],
      components
    });
  }
}

/**
 * Handles dropdown select menus (Model selector & provider switcher).
 */
export async function handleApiKeySelectInteraction(interaction: StringSelectMenuInteraction) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const selectedValue = interaction.values[0];

  // 1. Provider-Specific Model Selector Menu: "select_apikey_provider_model:<provider>"
  if (interaction.customId.startsWith('select_apikey_provider_model:')) {
    const provider = interaction.customId.split(':')[1] as ApiProviderType;
    const modelId = selectedValue;

    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: provider,
        enabled: true
      };
    } else {
      master.customApiConfig.activeProvider = provider;
      master.customApiConfig.enabled = true;
    }

    if (provider === 'gemini') master.customApiConfig.geminiModel = modelId;
    else if (provider === 'groq') master.customApiConfig.groqModel = modelId;
    else if (provider === 'openrouter') master.customApiConfig.openrouterModel = modelId;
    else if (provider === 'deepseek') master.customApiConfig.deepseekModel = modelId;
    else if (provider === 'mistral') master.customApiConfig.mistralModel = modelId;
    else if (provider === 'nanogpt') master.customApiConfig.nanogptModel = modelId;
    else if (provider === 'ollama') master.customApiConfig.ollamaModel = modelId;
    else if (provider === 'custom') master.customApiConfig.customModel = modelId;

    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.update({
      embeds: [embed],
      components
    });
    return;
  }

  // 2. Legacy Free Model Selector Menu: "select_apikey_freemodel"
  if (interaction.customId === 'select_apikey_freemodel') {
    const [providerStr, ...modelParts] = selectedValue.split(':');
    const provider = providerStr as ApiProviderType;
    const modelId = modelParts.join(':');

    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: provider,
        enabled: true
      };
    } else {
      master.customApiConfig.activeProvider = provider;
      master.customApiConfig.enabled = true;
    }

    if (provider === 'gemini') master.customApiConfig.geminiModel = modelId;
    else if (provider === 'groq') master.customApiConfig.groqModel = modelId;
    else if (provider === 'openrouter') master.customApiConfig.openrouterModel = modelId;
    else if (provider === 'mistral') master.customApiConfig.mistralModel = modelId;
    else if (provider === 'ollama') master.customApiConfig.ollamaModel = modelId;

    await saveMaster(master);

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.update({
      embeds: [embed],
      components
    });
    return;
  }

  // 3. Provider Switcher Menu: "select_apikey_provider"
  if (interaction.customId === 'select_apikey_provider') {
    const provider = selectedValue as ApiProviderType;
    if (!master.customApiConfig) {
      master.customApiConfig = {
        activeProvider: provider,
        enabled: true
      };
    } else {
      master.customApiConfig.activeProvider = provider;
      master.customApiConfig.enabled = true;
    }
    await saveMaster(master);

    // Immediately open the Model Explorer for the selected provider!
    const { embed, components } = buildProviderModelExplorer(master, provider);
    await interaction.update({
      embeds: [embed],
      components
    });
  }
}

/**
 * Handles button interactions for the API Key dashboard and Model Explorer.
 */
export async function handleApiKeyButtonInteraction(interaction: ButtonInteraction, btnId: string) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const isParentEphemeral = interaction.message.flags?.has(MessageFlags.Ephemeral);

  if (btnId.startsWith('btn_apikey_modal:')) {
    const provider = btnId.split(':')[1] as ApiProviderType;
    const modal = createApiKeyModal(provider);
    await interaction.showModal(modal);
    return;
  }

  if (btnId.startsWith('btn_apikey_custom_model_modal')) {
    const providerPart = btnId.split(':')[1] as ApiProviderType | undefined;
    const provider = providerPart || master.customApiConfig?.activeProvider || 'gemini';
    const currentModel =
      provider === 'gemini' ? master.customApiConfig?.geminiModel :
      provider === 'groq' ? master.customApiConfig?.groqModel :
      provider === 'openrouter' ? master.customApiConfig?.openrouterModel :
      provider === 'deepseek' ? master.customApiConfig?.deepseekModel :
      provider === 'mistral' ? master.customApiConfig?.mistralModel :
      provider === 'ollama' ? master.customApiConfig?.ollamaModel :
      master.customApiConfig?.customModel;

    const modal = createCustomModelModal(provider, currentModel);
    await interaction.showModal(modal);
    return;
  }

  if (btnId.startsWith('btn_apikey_refresh_models:')) {
    const provider = btnId.split(':')[1] as ApiProviderType;
    await interaction.deferUpdate();

    const cfg = master.customApiConfig;
    const key =
      provider === 'gemini' ? cfg?.geminiKey :
      provider === 'groq' ? cfg?.groqKey :
      provider === 'openrouter' ? cfg?.openrouterKey :
      provider === 'mistral' ? cfg?.mistralKey :
      cfg?.customKey;

    const endpoint = provider === 'ollama' ? cfg?.ollamaEndpoint : cfg?.customEndpoint;
    const liveResult = await fetchLiveProviderModels(provider, key, endpoint);

    const { embed, components } = buildProviderModelExplorer(master, provider, liveResult.models, liveResult.source);
    await interaction.editReply({
      embeds: [embed],
      components
    });
    return;
  }

  if (btnId === 'btn_apikey_models_menu' || btnId === 'btn_apikey_freepresets') {
    const activeProvider = master.customApiConfig?.activeProvider || 'gemini';
    const { embed, components } = buildProviderModelExplorer(master, activeProvider);
    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_switch_provider') {
    const { embed, components } = buildProviderSwitchMenu(master);
    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_more_providers') {
    const { embed, components } = buildMoreProvidersMenu();
    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_test') {
    await interaction.deferUpdate();
    const cfg = master.customApiConfig;
    if (!cfg) {
      await interaction.followUp({ content: '❌ No AI configuration found.', flags: MessageFlags.Ephemeral });
      return;
    }
    const provider = cfg.activeProvider || 'gemini';
    const key =
      provider === 'gemini' ? cfg.geminiKey :
      provider === 'groq' ? cfg.groqKey :
      provider === 'openrouter' ? cfg.openrouterKey :
      provider === 'deepseek' ? cfg.deepseekKey :
      provider === 'mistral' ? cfg.mistralKey :
      provider === 'nanogpt' ? cfg.nanogptKey :
      cfg.customKey;

    if (!key && provider !== 'ollama') {
      await interaction.followUp({ content: `❌ No key found for ${PROVIDER_DISPLAY_NAMES[provider]}.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const model =
      provider === 'gemini' ? cfg.geminiModel :
      provider === 'groq' ? cfg.groqModel :
      provider === 'openrouter' ? cfg.openrouterModel :
      provider === 'deepseek' ? cfg.deepseekModel :
      provider === 'mistral' ? cfg.mistralModel :
      provider === 'nanogpt' ? cfg.nanogptModel :
      provider === 'ollama' ? cfg.ollamaModel :
      cfg.customModel;

    const endpoint = provider === 'ollama' ? cfg.ollamaEndpoint : cfg.customEndpoint;

    const testRes = await testProviderConnection(provider, key || '', model, endpoint);
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

    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_clear') {
    master.customApiConfig = undefined;
    await saveMaster(master);
    const { embed, components } = buildApiKeyDashboard(master);

    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_tutorial') {
    const { embed, components } = buildApiKeyTutorial();
    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (btnId === 'btn_apikey_dashboard') {
    const { embed, components } = buildApiKeyDashboard(master);
    if (isParentEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }
  }
}
