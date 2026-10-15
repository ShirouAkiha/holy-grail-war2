import { SERVANT_DATABASE } from '../src/data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../src/data/craftEssences';
import { buildServantHub, handleGlobalServantInteraction } from '../src/commands/servant';

async function test() {
  try {
    console.log('Testing buildServantHub with Archetype Earth...');
    const archetype = SERVANT_DATABASE.find(s => s.id === 'archetype_earth')!;
    
    // Create 25 servants so totalServants > 20 (exactly like user's screenshot showing page 1/2)
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
        equippedCeId: CRAFT_ESSENCE_DATABASE[0]?.id,
        equippedCe: CRAFT_ESSENCE_DATABASE[0]
      });
    }

    const master: any = {
      discordId: '123456789',
      username: 'TestMaster',
      activeServantId: servants[0].id,
      servants: servants,
      craftEssences: CRAFT_ESSENCE_DATABASE.slice(0, 10).map((ce, idx) => ({
        ...ce,
        instanceId: `ce_${idx}`,
        locked: false
      }))
    };

    console.log(`Master initialized with ${master.servants.length} servants and ${master.craftEssences.length} CEs.`);

    for (const cat of ['profile', 'stats', 'ascension', 'equip_ce', 'feed_ce', 'np', 'dialogue', 'roster'] as const) {
      console.log(`\n=== Testing Category: ${cat} ===`);
      const hub = await buildServantHub(master, master.servants[0], cat, master.servants[0]?.id, undefined, 1, true, 1);
      console.log(`Category ${cat} OK. Embeds: ${hub.embeds.length}, Components: ${hub.components.length}`);
      
      // Validate discord.js JSON serialization
      for (let i = 0; i < hub.components.length; i++) {
        const row = hub.components[i];
        const json = row.toJSON();
        console.log(`  Row ${i + 1}: type=${json.type}, components=${json.components?.length}`);
      }
    }

    console.log('\n--- Testing handleGlobalServantInteraction for CE Vault & Lore Studio ---');
    // Mock interaction for servant_tab_equip_ce
    const mockInteractionCe: any = {
      customId: 'servant_tab_equip_ce',
      user: { id: '123456789', username: 'TestMaster' },
      replied: false,
      deferred: false,
      update: async (data: any) => {
        console.log('mockInteractionCe update() called! Embeds:', data.embeds?.length, 'Components:', data.components?.length);
      },
      reply: async (data: any) => {
        console.log('mockInteractionCe reply() called:', data);
      }
    };
    await handleGlobalServantInteraction(mockInteractionCe);

    // Mock interaction for servant_tab_dialogue
    const mockInteractionDialogue: any = {
      customId: 'servant_tab_dialogue',
      user: { id: '123456789', username: 'TestMaster' },
      replied: false,
      deferred: false,
      update: async (data: any) => {
        console.log('mockInteractionDialogue update() called! Embeds:', data.embeds?.length, 'Components:', data.components?.length);
      },
      reply: async (data: any) => {
        console.log('mockInteractionDialogue reply() called:', data);
      }
    };
    await handleGlobalServantInteraction(mockInteractionDialogue);

    console.log('\nALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('TEST FAILED WITH ERROR:', err);
  }
}

test();
