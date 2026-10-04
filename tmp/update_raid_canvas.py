path = '/app/applet/src/commands/raid.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update renderAndPostTurn to define buildRaidEmbed and include embeds: [raidEmbed]
old_render_block = """  let currentCanvasFileName = '';
  const renderAndPostTurn = async () => {
    const { buffer, fileName } = await renderRaidBattlefield(battleState, false);
    const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    currentCanvasFileName = uniqueFileName;
    const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
    const components = buildBattleButtons();
    const active = currentActiveParticipant;

    const channelToSend = interaction.channel || battleMsg?.channel;
    let newBattleMsg: any = null;
    if (channelToSend && typeof channelToSend.send === 'function') {
      try {
        newBattleMsg = await channelToSend.send({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
          files: [attachment],
          components
        });
      } catch (sendErr: any) {
        console.warn('[raid] channel.send fresh turn failed, falling back to in-place edit:', sendErr?.message || sendErr);
      }
    }

    if (newBattleMsg) {
      const prevMsg = battleMsg;
      battleMsg = newBattleMsg;
      if (prevMsg && typeof prevMsg.delete === 'function') {
        await prevMsg.delete().catch(() => {});
      }
      if (interaction && typeof interaction.deleteReply === 'function') {
        await interaction.deleteReply().catch(() => {});
      }
    } else if (battleMsg && typeof battleMsg.edit === 'function') {
      await battleMsg.edit({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        files: [attachment],
        components
      }).catch(() => {});
    }
  };"""

new_render_block = """  let currentCanvasFileName = '';
  const buildRaidEmbed = (attachmentName?: string) => {
    const embed = new EmbedBuilder()
      .setColor(isTiamat ? 0xd946ef : 0xef4444);
    const target = attachmentName || currentCanvasFileName;
    if (target) {
      embed.setImage(`attachment://${target}`);
    }
    return embed;
  };

  const renderAndPostTurn = async () => {
    const { buffer, fileName } = await renderRaidBattlefield(battleState, false);
    const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    currentCanvasFileName = uniqueFileName;
    const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
    const components = buildBattleButtons();
    const active = currentActiveParticipant;
    const raidEmbed = buildRaidEmbed(uniqueFileName);

    const channelToSend = interaction.channel || battleMsg?.channel;
    let newBattleMsg: any = null;
    if (channelToSend && typeof channelToSend.send === 'function') {
      try {
        newBattleMsg = await channelToSend.send({
          content: buildTurnContent(active, pendingCards),
          embeds: [raidEmbed],
          files: [attachment],
          components
        });
      } catch (sendErr: any) {
        console.warn('[raid] channel.send fresh turn failed, falling back to followUp/edit:', sendErr?.message || sendErr);
      }
    }

    if (!newBattleMsg && interaction && typeof interaction.followUp === 'function') {
      try {
        newBattleMsg = await interaction.followUp({
          content: buildTurnContent(active, pendingCards),
          embeds: [raidEmbed],
          files: [attachment],
          components
        });
      } catch (followErr) {
        console.warn('[raid] interaction.followUp fallback failed:', followErr);
      }
    }

    if (newBattleMsg) {
      const prevMsg = battleMsg;
      battleMsg = newBattleMsg;
      if (prevMsg && typeof prevMsg.delete === 'function') {
        await prevMsg.delete().catch(() => {});
      }
      if (interaction && typeof interaction.deleteReply === 'function') {
        await interaction.deleteReply().catch(() => {});
      }
    } else if (battleMsg && typeof battleMsg.edit === 'function') {
      await battleMsg.edit({
        content: buildTurnContent(active, pendingCards),
        embeds: [raidEmbed],
        files: [attachment],
        components
      }).catch(() => {});
    }
  };"""

assert old_render_block in content, "old_render_block not found!"
content = content.replace(old_render_block, new_render_block, 1)

# 2. Update reset cards
old_reset = """    } else if (i.customId === 'raid_reset_cards') {
      pendingCards = [];
      pendingIndices = [];
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons()
      });
      return;"""

new_reset = """    } else if (i.customId === 'raid_reset_cards') {
      pendingCards = [];
      pendingIndices = [];
      const raidEmbed = buildRaidEmbed(currentCanvasFileName);
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [raidEmbed],
        components: buildBattleButtons()
      });
      return;"""

assert old_reset in content, "old_reset not found!"
content = content.replace(old_reset, new_reset, 1)

# 3. Update skill activation canvas safeUpdate
old_skill_update = """        // Render updated canvas reflecting the new HP, NP, or buffs from the skill!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
          files: [attachment],
          components: buildBattleButtons()
        });"""

new_skill_update = """        // Render updated canvas reflecting the new HP, NP, or buffs from the skill!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
        const raidEmbed = buildRaidEmbed(uniqueFileName);

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
          embeds: [raidEmbed],
          files: [attachment],
          components: buildBattleButtons()
        });"""

assert old_skill_update in content, "old_skill_update not found!"
content = content.replace(old_skill_update, new_skill_update, 1)

# 4. Update command seal canvas safeUpdate
old_seal_update = """        // Render updated canvas reflecting the restored HP and 100% NP!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
          files: [attachment],
          components: buildBattleButtons()
        });"""

new_seal_update = """        // Render updated canvas reflecting the restored HP and 100% NP!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
        const raidEmbed = buildRaidEmbed(uniqueFileName);

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
          embeds: [raidEmbed],
          files: [attachment],
          components: buildBattleButtons()
        });"""

assert old_seal_update in content, "old_seal_update not found!"
content = content.replace(old_seal_update, new_seal_update, 1)

# 5. Update card selection (pendingCards < 3 and = 3)
old_card_sel = """    // If fewer than 3 cards selected, update buttons and message in-place with ZERO lag!
    if (pendingCards.length < 3) {
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons()
      });
      return;
    }

    // 3 Cards selected -> Immediately update the message so the user sees Card 3 registered and all buttons disabled!
    isProcessingTurn = true;
    try {
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons(true)
      });"""

new_card_sel = """    // If fewer than 3 cards selected, update buttons and message in-place with ZERO lag!
    if (pendingCards.length < 3) {
      const raidEmbed = buildRaidEmbed(currentCanvasFileName);
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [raidEmbed],
        components: buildBattleButtons()
      });
      return;
    }

    // 3 Cards selected -> Immediately update the message so the user sees Card 3 registered and all buttons disabled!
    isProcessingTurn = true;
    try {
      const raidEmbed = buildRaidEmbed(currentCanvasFileName);
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [raidEmbed],
        components: buildBattleButtons(true)
      });"""

assert old_card_sel in content, "old_card_sel not found!"
content = content.replace(old_card_sel, new_card_sel, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Raid canvas UI embeds successfully updated!")
