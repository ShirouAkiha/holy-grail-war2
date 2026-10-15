import { SERVANT_DATABASE } from '../src/data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../src/data/craftEssences';
import { buildServantHub } from '../src/commands/servant';

async function testValidation() {
  const archetype = SERVANT_DATABASE.find(s => s.id === 'archetype_earth')!;
  
  // 25 servants exactly like in the user's screenshot
  const servants: any[] = [];
  for (let i = 0; i < 25; i++) {
    const s = SERVANT_DATABASE[i % SERVANT_DATABASE.length];
    servants.push({
      id: `servant_instance_${i}`,
      templateId: s.id,
      name: s.name,
      nickname: i === 0 ? 'Archetype: Earth' : s.name,
      template: s,
      level: 50,
      bondLevel: 5,
      availableStatPoints: 10,
      allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
      equippedCeId: 'ce_verdant_sound',
      equippedCe: CRAFT_ESSENCE_DATABASE.find(c => c.id === 'ce_verdant_sound') || CRAFT_ESSENCE_DATABASE[0]
    });
  }

  const master: any = {
    discordId: '123456789',
    username: 'TestMaster',
    activeServantId: servants[0].id,
    servants: servants,
    craftEssences: [
      CRAFT_ESSENCE_DATABASE.find(c => c.id === 'ce_verdant_sound') || CRAFT_ESSENCE_DATABASE[0],
      ...CRAFT_ESSENCE_DATABASE.slice(0, 15)
    ].map((ce, idx) => ({
      ...ce,
      instanceId: `ce_${idx}`,
      locked: false
    }))
  };

  for (const cat of ['equip_ce', 'feed_ce', 'dialogue'] as const) {
    console.log(`\nValidating category: ${cat}`);
    const hub = await buildServantHub(master, servants[0], cat, servants[0].id, undefined, 1, true, 1);
    
    // Check embeds payload
    const embedJsons = hub.embeds.map(e => e.toJSON());
    console.log(`Embeds count: ${embedJsons.length}`);
    for (const [eIdx, e] of embedJsons.entries()) {
      console.log(`  Embed ${eIdx}: title="${e.title}", descLen=${e.description?.length}`);
    }

    // Check components payload
    const compJsons = hub.components.map(c => c.toJSON());
    console.log(`Components count: ${compJsons.length}`);
    for (const [rIdx, row] of compJsons.entries()) {
      console.log(`  Row ${rIdx + 1}: type=${row.type}, count=${row.components?.length}`);
      for (const comp of row.components) {
        if (comp.type === 2) {
          // Button
          console.log(`    Button: id="${comp.custom_id}", label="${comp.label}"`);
        } else if (comp.type === 3) {
          // StringSelectMenu
          console.log(`    Select: id="${comp.custom_id}", options=${comp.options?.length}`);
          const defaultCount = comp.options.filter((o: any) => o.default).length;
          console.log(`      Default options count: ${defaultCount}`);
          if (defaultCount > 1) {
            console.error(`      ERROR! MORE THAN 1 DEFAULT OPTION IN SINGLE SELECT!`);
          }
          const values = comp.options.map((o: any) => o.value);
          const uniqueValues = new Set(values);
          if (uniqueValues.size !== values.length) {
            console.error(`      ERROR! DUPLICATE VALUES IN SELECT OPTIONS!`);
          }
        }
      }
    }
  }
}

testValidation();
