path = '/app/applet/src/commands/raid.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace renderAndPostTurn and buildRaidEmbed
old_block_marker = "  let currentCanvasFileName = '';"
idx = content.find(old_block_marker)
assert idx != -1, "old_block_marker not found"

end_marker = "  await renderAndPostTurn();"
end_idx = content.find(end_marker, idx)
assert end_idx != -1, "end_marker not found"

new_render_and_post = """  const renderAndPostTurn = async () => {
    const { buffer } = await renderRaidBattlefield(battleState, false);
    const attachment = new AttachmentBuilder(buffer, { name: 'raid_battlefield.png' });
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
        console.warn('[raid] channel.send fresh turn failed, falling back to followUp/edit:', sendErr?.message || sendErr);
      }
    }

    if (!newBattleMsg && interaction && typeof interaction.followUp === 'function') {
      try {
        newBattleMsg = await interaction.followUp({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
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
        embeds: [],
        files: [attachment],
        components
      }).catch(() => {});
    }
  };\n\n"""

content = content[:idx] + new_render_and_post + content[end_idx:]

# 2. Update safeUpdate to use deferUpdate + editReply like duel.ts
old_safe_update = """    const safeUpdate = async (options: any) => {
      try {
        if (!i.replied && !i.deferred) {
          await i.update(options);
        } else {
          await i.editReply(options);
        }
      } catch (err: any) {
        try {
          if (battleMsg && typeof battleMsg.edit === 'function') {
            await battleMsg.edit(options);
          }
        } catch (fallbackErr) {
          console.warn('[raid] safeUpdate fallback warning:', fallbackErr);
        }
      }
    };"""

new_safe_update = """    const safeUpdate = async (options: any) => {
      try {
        if (!i.deferred && !i.replied) {
          await i.deferUpdate().catch(() => {});
        }
        await i.editReply(options);
      } catch (err: any) {
        try {
          if (battleMsg && typeof battleMsg.edit === 'function') {
            await battleMsg.edit(options);
          }
        } catch (fallbackErr) {
          console.warn('[raid] safeUpdate fallback warning:', fallbackErr);
        }
      }
    };"""

assert old_safe_update in content, "old_safe_update not found"
content = content.replace(old_safe_update, new_safe_update, 1)

# 3. Replace all remaining buildRaidEmbed calls with embeds: []
content = content.replace("embeds: [buildRaidEmbed(currentCanvasFileName)],", "embeds: [],")
content = content.replace("const raidEmbed = buildRaidEmbed(uniqueFileName);\n", "")
content = content.replace("const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;", "const uniqueFileName = 'raid_battlefield.png';")
content = content.replace("currentCanvasFileName = uniqueFileName;\n", "")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied fix_raid_display.py cleanly!")
