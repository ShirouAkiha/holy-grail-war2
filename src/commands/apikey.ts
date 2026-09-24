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
  FREE_MODELS_CATALOG,
  testProviderConnection
} from '../engine/byokService';
import { encryptSecret, redactSensitiveKeysFromText } from '../utils/cryptoSecurity';

export const data = new SlashCommandBuilder()
  .setName('apikey')
  .setDescription('Manage AI providers and free models (Gemini, Groq, OpenRouter, DeepSeek, Ollama) for unlimited chats')
  .addSubcommand(sub =>
    sub
      .setName('dashboard')
      .setDescription('Open your private AI provider & model management dashboard')
  )
  .addSubcommand(sub =>
    sub
      .setName('freemodels')
      .setDescription('Browse and choose 100% free AI models (Groq Llama 3.3 70B, Gemini Flash, OpenRouter :free)')
  )
  .addSubcommand(sub =>
    sub
      .setName('provider')
      .setDescription('Switch your active AI provider')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Select the AI provider to activate')
          .setRequired(true)
          .addChoices(
            { name: 'Google Gemini (AI Studio - Free)', value: 'gemini' },
            { name: 'Groq Cloud (Free Ultra-Fast LPUs)', value: 'groq' },
            { name: 'OpenRouter.ai (100% Free Models Available)', value: 'openrouter' },
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
      .setDescription('Set or customize the AI model name for your active provider')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Model ID or preset (e.g. llama-3.3-70b-versatile, gemini-3.5-flash, or leave empty for menu)')
          .setRequired(false)
          .addChoices(
            { name: 'Groq: Llama 3.3 70B Versatile (100% Free & Fast)', value: 'llama-3.3-70b-versatile' },
            { name: 'Groq: Llama 3.1 8B Instant (Sub-150ms)', value: 'llama-3.1-8b-instant' },
            { name: 'Gemini: 3.5 Flash (Free Tier)', value: 'gemini-3.5-flash' },
            { name: 'Gemini: 3.5 Flash-Lite (Fastest Free)', value: 'gemini-3.5-flash-lite' },
            { name: 'OpenRouter: meta-llama/llama-3.3-70b-instruct:free', value: 'meta-llama/llama-3.3-70b-instruct:free' },
            { name: 'OpenRouter: google/gemini-2.0-flash-exp:free', value: 'google/gemini-2.0-flash-exp:free' },
            { name: 'OpenRouter: deepseek/deepseek-r1:free', value: 'deepseek/deepseek-r1:free' },
            { name: 'Ollama: llama3.2 (Local Offline)', value: 'llama3.2' },
            { name: 'DeepSeek: deepseek-chat (V3)', value: 'deepseek-chat' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('custom_model_id')
          .setDescription('Type any exact custom model identifier from OpenRouter, Groq, Ollama, etc.')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Securely connect or update your personal AI key (Opens private popup dialog if key omitted)')
      .addStringOption(opt =>
        opt
          .setName('provider')
          .setDescription('Select the AI provider')
          .setRequired(true)
          .addChoices(
            { name: 'Google Gemini (AI Studio - Free)', value: 'gemini' },
            { name: 'Groq Cloud (Free Ultra-Fast LPUs)', value: 'groq' },
            { name: 'OpenRouter.ai (Free Models Available)', value: 'openrouter' },
            { name: 'DeepSeek Direct API', value: 'deepseek' },
            { name: 'Mistral AI (La Plateforme)', value: 'mistral' },
            { name: 'Ollama / Local AI (Offline Free)', value: 'ollama' },
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
      .setDescription('Beginner-friendly step-by-step guide on how to get 100% free API keys in 1 minute')
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

  const isFreeModel =
    activeModel.includes(':free') ||
    activeProvider === 'groq' ||
    activeProvider === 'ollama' ||
    activeProvider === 'gemini';

  const embed = new EmbedBuilder()
    .setTitle('🔑 Personal AI Provider & Free Models Hub')
    .setDescription(
      `Master **${master.username}**, connect your personal API key or choose from **100% Free AI Models** (Groq Ultra-Fast, Google AI Studio, OpenRouter :free, or Local Ollama) to unlock **unlimited telepathic dialogue** with your Servants!\n\n` +
      `🛡️ *All API keys are strictly confidential, AES-256-GCM encrypted, and accessible only to your account.*`
    )
    .addFields(
      {
        name: '⚙️ Active AI Configuration',
        value:
          `${isEnabled ? '🟢 **Active & Enabled** (Unlimited Chats)' : '⚪ **Disabled** (Using Standard Server Quota)'}\n` +
          `• **Current Provider:** \`${PROVIDER_DISPLAY_NAMES[activeProvider]}\`\n` +
          `• **Selected Model:** \`${activeModel}\` ${isFreeModel ? '🎁 *(100% Free Tier)*' : ''}\n` +
          `• **Provider Note:** *${PROVIDER_FREE_TIER_NOTES[activeProvider]}*`,
        inline: false
      },
      {
        name: '🤖 Configured Credentials & Status',
        value:
          `• **Google Gemini:** \`${geminiMasked}\` ${activeProvider === 'gemini' ? '◀ *(Active)*' : ''}\n` +
          `• **Groq Cloud (Free):** \`${groqMasked}\` ${activeProvider === 'groq' ? '◀ *(Active)*' : ''}\n` +
          `• **OpenRouter.ai:** \`${openrouterMasked}\` ${activeProvider === 'openrouter' ? '◀ *(Active)*' : ''}\n` +
          `• **DeepSeek Direct:** \`${deepseekMasked}\` ${activeProvider === 'deepseek' ? '◀ *(Active)*' : ''}\n` +
          `• **Mistral AI:** \`${mistralMasked}\` ${activeProvider === 'mistral' ? '◀ *(Active)*' : ''}\n` +
          `• **Ollama Local AI:** \`${ollamaStatus}\` ${activeProvider === 'ollama' ? '◀ *(Active)*' : ''}\n` +
          `• **NanoGPT / Custom:** \`${nanogptMasked || customMasked}\` ${(activeProvider === 'nanogpt' || activeProvider === 'custom') ? '◀ *(Active)*' : ''}`,
        inline: false
      },
      {
        name: '💡 Free Models Available',
        value:
          `• **Groq Cloud:** \`llama-3.3-70b-versatile\` (100% Free, 300+ tok/s, 128k context)\n` +
          `• **Google Gemini:** \`gemini-3.5-flash\` & \`gemini-3.5-flash-lite\` (Free on AI Studio)\n` +
          `• **OpenRouter:** \`meta-llama/llama-3.3-70b-instruct:free\`, \`gemini-2.0-flash-exp:free\`, \`deepseek-r1:free\`\n` +
          `• **Ollama:** \`llama3.2\`, \`mistral\`, \`deepseek-r1\` (100% Local Free Offline)`,
        inline: false
      }
    )
    .setColor(isEnabled ? 0x10b981 : 0xd4af37)
    .setFooter({ text: 'Fate Vault Security Engine • Freedom of Choice & Zero Cost' });

  if (cfg.lastTestedAt) {
    const statusText = cfg.lastTestStatus === 'success' ? '✅ Operational' : '❌ Test Failed';
    const dateStr = new Date(cfg.lastTestedAt).toLocaleTimeString();
    embed.addFields({
      name: '📡 Last Test Connection',
      value: `Status: **${statusText}** at \`${dateStr}\``,
      inline: false
    });
  }

  // Row 1: Fast Free Model presets & Provider Switch
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_freepresets')
      .setLabel('🌟 Free Models Menu')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎁'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_switch_provider')
      .setLabel('Switch Provider')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:gemini')
      .setLabel('Gemini Key')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔷'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:groq')
      .setLabel('Groq Key (Free)')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚡'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:openrouter')
      .setLabel('OpenRouter')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌐')
  );

  // Row 2: Secondary providers, Testing, Toggle, Clear, Guide
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_more_providers')
      .setLabel('More Providers')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️'),
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
 * Builds the interactive 1-click Free Models selector menu.
 */
export function buildFreeModelsMenu(master: any) {
  const cfg: UserCustomApiConfig = master.customApiConfig || {
    activeProvider: 'gemini',
    enabled: false
  };

  const embed = new EmbedBuilder()
    .setTitle('🌟 100% Free AI Model Selector')
    .setDescription(
      `Master **${master.username}**, choose any curated **100% Free Model** below to apply it instantly to your account with zero cost!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### ⚡ Featured Free Models:\n` +
      `• **Groq Llama 3.3 70B Versatile:** Flagship 70B open model running at 300+ tok/s on Groq LPUs. Completely free!\n` +
      `• **Google Gemini 3.5 Flash:** High personality, lore consistency, generous free tier on Google AI Studio.\n` +
      `• **OpenRouter :free Models:** Meta Llama 3.3 70B, Gemini 2.0 Flash Exp, and DeepSeek R1 reasoning at $0.00.\n` +
      `• **Ollama Local AI:** 100% Free offline execution directly on your personal computer.\n\n` +
      `*Select a model from the dropdown below to activate it immediately:*`
    )
    .setColor(0x10b981)
    .setFooter({ text: 'Select a free model from the menu below • Instant 1-click activation' });

  // Curated top 12 free models for the dropdown
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_apikey_freemodel')
    .setPlaceholder('👉 Choose a 100% Free Model to activate...');

  const topFreeModels: { value: string; label: string; description: string; emoji: string }[] = [
    {
      value: 'groq:llama-3.3-70b-versatile',
      label: 'Groq: Llama 3.3 70B Versatile (Free & Fast)',
      description: 'Flagship 70B model at 300+ tok/s • 100% Free tier on Groq',
      emoji: '⚡'
    },
    {
      value: 'groq:llama-3.1-8b-instant',
      label: 'Groq: Llama 3.1 8B Instant (Sub-150ms)',
      description: 'Blazing sub-150ms response latency • Free on Groq',
      emoji: '🚀'
    },
    {
      value: 'groq:deepseek-r1-distill-llama-70b',
      label: 'Groq: DeepSeek R1 Distill 70B (Free Reasoning)',
      description: 'Strategic chain-of-thought battle reasoning • Free on Groq',
      emoji: '🧠'
    },
    {
      value: 'gemini:gemini-3.5-flash',
      label: 'Gemini: 3.5 Flash (Recommended Free)',
      description: 'Superb Fate VN roleplay nuance • Free tier on Google AI Studio',
      emoji: '🔷'
    },
    {
      value: 'gemini:gemini-3.5-flash-lite',
      label: 'Gemini: 3.5 Flash-Lite (Fastest Free)',
      description: 'Ultra-fast lightweight dialogue • Free on Google AI Studio',
      emoji: '⚡'
    },
    {
      value: 'gemini:gemini-3.5-pro',
      label: 'Gemini: 3.5 Pro (Deep Lore Free Tier)',
      description: 'Elite lore reasoning & emotional depth • Free on AI Studio',
      emoji: '🌟'
    },
    {
      value: 'openrouter:meta-llama/llama-3.3-70b-instruct:free',
      label: 'OpenRouter: Llama 3.3 70B (:free)',
      description: 'Meta 70B instruct model • 100% Free on OpenRouter',
      emoji: '🌐'
    },
    {
      value: 'openrouter:google/gemini-2.0-flash-exp:free',
      label: 'OpenRouter: Gemini 2.0 Flash Exp (:free)',
      description: 'Google experimental Flash • 100% Free on OpenRouter',
      emoji: '🔥'
    },
    {
      value: 'openrouter:deepseek/deepseek-r1:free',
      label: 'OpenRouter: DeepSeek R1 (:free)',
      description: 'DeepSeek R1 full reasoning model • 100% Free on OpenRouter',
      emoji: '🧠'
    },
    {
      value: 'openrouter:deepseek/deepseek-chat:free',
      label: 'OpenRouter: DeepSeek V3 Chat (:free)',
      description: 'DeepSeek V3 conversational model • 100% Free on OpenRouter',
      emoji: '💬'
    },
    {
      value: 'openrouter:qwen/qwen-2.5-72b-instruct:free',
      label: 'OpenRouter: Qwen 2.5 72B (:free)',
      description: 'Alibaba 72B open weights • 100% Free on OpenRouter',
      emoji: '📜'
    },
    {
      value: 'mistral:mistral-small-latest',
      label: 'Mistral: Mistral Small (Free Tier)',
      description: 'Concise, witty character dialogue • Free on console.mistral.ai',
      emoji: '🦊'
    },
    {
      value: 'ollama:llama3.2',
      label: 'Ollama: Llama 3.2 (100% Local Free Offline)',
      description: 'Runs offline on your machine (localhost:11434) • Zero cost',
      emoji: '💻'
    }
  ];

  for (const item of topFreeModels) {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setValue(item.value)
        .setLabel(item.label)
        .setDescription(item.description)
        .setEmoji(item.emoji)
    );
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_tutorial')
      .setLabel('Free Key Guide')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📖'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_switch_provider')
      .setLabel('Switch Provider')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [selectRow, btnRow] };
}

/**
 * Builds the provider switcher menu.
 */
export function buildProviderSwitchMenu(master: any) {
  const currentProvider = master.customApiConfig?.activeProvider || 'gemini';

  const embed = new EmbedBuilder()
    .setTitle('🔄 Switch AI Provider')
    .setDescription(
      `Master **${master.username}**, select which AI provider you wish to activate for telepathic dialogue.\n\n` +
      `Each provider retains its own configured credentials and selected models so you can switch anytime!`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Select an AI provider from the dropdown below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_apikey_provider')
    .setPlaceholder('Select an AI Provider...');

  const providers: { value: ApiProviderType; label: string; desc: string; emoji: string }[] = [
    { value: 'gemini', label: 'Google Gemini (AI Studio)', desc: '100% Free forever tier • Rich visual novel roleplay', emoji: '🔷' },
    { value: 'groq', label: 'Groq Cloud (Free Ultra-Fast)', desc: '100% Free keys at console.groq.com • 300+ tok/s', emoji: '⚡' },
    { value: 'openrouter', label: 'OpenRouter.ai', desc: 'Over 20+ completely free (:free) models available', emoji: '🌐' },
    { value: 'deepseek', label: 'DeepSeek Direct API', desc: 'Direct api.deepseek.com access for DeepSeek V3 / R1', emoji: '🌟' },
    { value: 'mistral', label: 'Mistral AI (La Plateforme)', desc: 'Witty character dialogue on Mistral free tier', emoji: '🦊' },
    { value: 'ollama', label: 'Ollama / Local AI', desc: '100% Free offline execution on localhost:11434', emoji: '💻' },
    { value: 'nanogpt', label: 'NanoGPT', desc: 'Pay-per-prompt or Nano cryptocurrency faucet', emoji: '⚡' },
    { value: 'custom', label: 'Custom OpenAI Endpoint', desc: 'Connect any OpenAI-compatible API or self-hosted server', emoji: '🛠️' }
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
      .setCustomId('btn_apikey_freepresets')
      .setLabel('Free Models')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎁'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
  );

  return { embed, components: [row1, row2] };
}

/**
 * Builds the secondary providers picker (DeepSeek, Mistral, Ollama, NanoGPT, Custom).
 */
export function buildMoreProvidersMenu() {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Additional AI Providers & Local AI')
    .setDescription(
      `Configure additional AI providers for specialized capabilities:\n\n` +
      `• **DeepSeek Direct API:** Connect your key from [platform.deepseek.com](https://platform.deepseek.com).\n` +
      `• **Mistral AI:** Connect your key from [console.mistral.ai](https://console.mistral.ai).\n` +
      `• **Ollama Local AI:** Connect a local offline Ollama instance (\`http://localhost:11434\`) with 100% privacy and zero cost!\n` +
      `• **Custom OpenAI Endpoint:** Connect any endpoint (vLLM, LM Studio, Together, etc.).`
    )
    .setColor(0x8b5cf6)
    .setFooter({ text: 'Select a provider button below to configure credentials' });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:deepseek')
      .setLabel('Set DeepSeek')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌟'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:mistral')
      .setLabel('Set Mistral')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🦊'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:ollama')
      .setLabel('Configure Ollama (Local)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('💻'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:nanogpt')
      .setLabel('Set NanoGPT')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚡'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_modal:custom')
      .setLabel('Custom Endpoint')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🛠️')
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_apikey_freepresets')
      .setLabel('Free Models Menu')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎁'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
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
    .setTitle('📖 How to Get 100% Free AI Keys in 1 Minute')
    .setDescription(
      `Master, you have multiple completely **100% FREE options** with no credit card required!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `### ⚡ Option A: Groq Cloud (Recommended — Ultra-Fast 300+ tok/s)\n` +
      `1️⃣ Open **[Groq Cloud Console (Click Here)](https://console.groq.com/keys)**.\n` +
      `2️⃣ Sign in with GitHub or Google.\n` +
      `3️⃣ Click **"Create API Key"**, copy your key (\`gsk_...\`), and connect it with the button below!\n` +
      `*Benefits: 100% Free tier, 14,400 requests/day, blistering fast Llama 3.3 70B!*\n\n` +
      `### 🔷 Option B: Google AI Studio (Gemini — Top VN Character Fidelity)\n` +
      `1️⃣ Open **[Google AI Studio (Click Here)](https://aistudio.google.com/apikey)**.\n` +
      `2️⃣ Sign in with any Google account.\n` +
      `3️⃣ Click **"Create API key"**, copy your key (\`AIzaSy...\`), and click Connect below.\n` +
      `*Benefits: Free forever tier (15 requests/minute), superb visual novel dialogue!*\n\n` +
      `### 🌐 Option C: OpenRouter.ai (Access 20+ Free Models)\n` +
      `1️⃣ Open **[OpenRouter Keys (Click Here)](https://openrouter.ai/keys)**.\n` +
      `2️⃣ Sign up and click **"Create Key"**.\n` +
      `3️⃣ Choose models ending in \`:free\` (such as \`meta-llama/llama-3.3-70b-instruct:free\`) for $0.00 unlimited chat!\n\n` +
      `### 💻 Option D: Ollama / Local AI (100% Free & Offline)\n` +
      `1️⃣ Install [Ollama](https://ollama.ai) on your computer and run \`ollama run llama3.2\`.\n` +
      `2️⃣ Click **Configure Ollama** below. Point it to your Ollama endpoint (default: \`http://localhost:11434/v1/chat/completions\`).\n` +
      `*Benefits: Zero cost, zero keys, 100% private on your own hardware!*`
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
      .setCustomId('btn_apikey_freepresets')
      .setLabel('Browse Free Models')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎁'),
    new ButtonBuilder()
      .setCustomId('btn_apikey_dashboard')
      .setLabel('Back to Dashboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️')
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

  if (subcommand === 'freemodels') {
    const { embed, components } = buildFreeModelsMenu(master);
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

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.reply({
      content: `🔄 **Active provider switched to ${PROVIDER_DISPLAY_NAMES[providerName]}!**`,
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
      // Open interactive Free Models menu if no model was specified
      const { embed, components } = buildFreeModelsMenu(master);
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

    // ZERO-LEAK MODAL FLOW: If no key was typed in the slash command chat box,
    // open the private Discord Modal dialog so the user never types secrets in public chat.
    if (!rawKeyInput && provider !== 'ollama') {
      const modal = createApiKeyModal(provider);
      await interaction.showModal(modal);
      return;
    }

    // Defer ephemerally
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Test connection
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
        content: '❌ No AI provider configured yet. Use `/apikey set` or `/apikey freemodels` first.',
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
 * Creates the modal for setting a key via interactive button or parameterless /apikey set.
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

/**
 * Handles modal submit for saving an API key.
 */
export async function handleApiKeyModalSubmit(interaction: ModalSubmitInteraction, provider: ApiProviderType) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rawKey = interaction.fields.getTextInputValue('api_key_input')?.trim();
  const model = interaction.fields.getTextInputValue('model_name_input')?.trim();
  let endpoint: string | undefined;

  try {
    endpoint = interaction.fields.getTextInputValue('endpoint_input')?.trim();
  } catch {
    // field not present in modal
  }

  if (!rawKey && provider !== 'ollama') {
    await interaction.editReply({ content: '❌ API Key cannot be empty.' });
    return;
  }

  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
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

/**
 * Handles dropdown select menus (free model picker & provider switcher).
 */
export async function handleApiKeySelectInteraction(interaction: StringSelectMenuInteraction) {
  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const selectedValue = interaction.values[0];

  // 1. Free Model Selector Menu
  if (interaction.customId === 'select_apikey_freemodel') {
    // format: "<provider>:<modelId>"
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

  // 2. Provider Switcher Menu
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

    const { embed, components } = buildApiKeyDashboard(master);
    await interaction.update({
      embeds: [embed],
      components
    });
  }
}

/**
 * Handles button interactions for the API Key dashboard.
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

  if (btnId === 'btn_apikey_freepresets') {
    const { embed, components } = buildFreeModelsMenu(master);
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
