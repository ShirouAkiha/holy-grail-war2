path = '/app/applet/src/canvas/raidRenderer.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_snippet = """  // Boss Class Tag below Diamond
  ctx.fillStyle = state.boss.servantClass === 'Beast' ? '#f43f5e' : '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boss.servantClass.toUpperCase(), bossHudX + avatarSize / 2, bossHudY + avatarSize + 18);"""

new_snippet = """  // Boss Class Tag below Diamond
  const bossClassStr = String(state.boss?.servantClass || (state.boss as any)?.class || 'Beast');
  ctx.fillStyle = bossClassStr === 'Beast' ? '#f43f5e' : '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bossClassStr.toUpperCase(), bossHudX + avatarSize / 2, bossHudY + avatarSize + 18);"""

old_hp_snippet = """  drawProgressBar(ctx, bossHpX, bossHpY, bossHpW, bossHpH, state.bossCurrentHp, state.bossMaxHp, bossHpGrad, 'rgba(15, 23, 42, 0.95)', '#94a3b8');

  // HP Numbers on Boss HP Bar
  ctx.fillStyle = '#ffffff';
  ctx.font = isTiamat ? 'bold 13px sans-serif' : 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()}`,
    bossHpX + bossHpW - 8,
    bossHpY + bossHpH / 2 + 1
  );"""

new_hp_snippet = """  const curHp = state.bossCurrentHp !== undefined ? state.bossCurrentHp : (state.boss?.currentHp || 0);
  const maxHp = state.bossMaxHp !== undefined ? state.bossMaxHp : (state.boss?.maxHp || state.boss?.baseHp || 1);

  drawProgressBar(ctx, bossHpX, bossHpY, bossHpW, bossHpH, curHp, maxHp, bossHpGrad, 'rgba(15, 23, 42, 0.95)', '#94a3b8');

  // HP Numbers on Boss HP Bar
  ctx.fillStyle = '#ffffff';
  ctx.font = isTiamat ? 'bold 13px sans-serif' : 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${Math.round(curHp).toLocaleString()} / ${Math.round(maxHp).toLocaleString()}`,
    bossHpX + bossHpW - 8,
    bossHpY + bossHpH / 2 + 1
  );"""

assert old_snippet in content, "old_snippet not found!"
assert old_hp_snippet in content, "old_hp_snippet not found!"

content = content.replace(old_snippet, new_snippet, 1)
content = content.replace(old_hp_snippet, new_hp_snippet, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("HUD HP and Class updated successfully!")
