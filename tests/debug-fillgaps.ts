/**
 * Debug script to test fillGaps functionality with real AI call simulation
 * Run with: npx tsx tests/debug-fillgaps.ts
 */

// Mock project similar to what user would have
const mockExistingProject = {
  id: "proj_test",
  name: "Test Key",
  description: "Test identification key",
  features: [
    {
      id: "f1",
      name: "Leaf Shape",
      imageUrl: "",
      states: [
        { id: "s1a", label: "Oval" },
        { id: "s1b", label: "Lanceolate" },
        { id: "s1c", label: "Round" }
      ]
    },
    {
      id: "f2", 
      name: "Flower Color",
      imageUrl: "",
      states: [
        { id: "s2a", label: "White" },
        { id: "s2b", label: "Yellow" },
        { id: "s2c", label: "Red" }
      ]
    },
    {
      id: "f3",
      name: "Bark Texture",
      imageUrl: "",
      states: [
        { id: "s3a", label: "Smooth" },
        { id: "s3b", label: "Rough" }
      ]
    }
  ],
  entities: [
    {
      id: "e1",
      name: "Species A",
      scientificName: "Genus speciesA",
      family: "Fabaceae",
      description: "A common tree species",
      imageUrl: "",
      links: [],
      traits: {
        "f1": ["s1a"], // Has Leaf Shape
        // Missing f2 (Flower Color) and f3 (Bark Texture)
      }
    },
    {
      id: "e2",
      name: "Species B",
      scientificName: "Genus speciesB",
      family: "Fabaceae",
      description: "Another tree species",
      imageUrl: "",
      links: [],
      traits: {
        "f1": ["s1b"],
        "f2": ["s2a"],
        // Missing f3 (Bark Texture)
      }
    },
    {
      id: "e3",
      name: "Species C",
      scientificName: "Genus speciesC",
      family: "Fabaceae",
      description: "Third tree species",
      imageUrl: "",
      links: [],
      traits: {
        // Missing all traits!
      }
    }
  ]
};

// Simulate various AI response formats
const aiResponses = {
  // Format 1: Correct fillGapsSchema format
  correct: {
    filledEntities: [
      { entityId: "e1", filledTraits: '{"f2": ["s2b"], "f3": ["s3a"]}' },
      { entityId: "e2", filledTraits: '{"f3": ["s3b"]}' },
      { entityId: "e3", filledTraits: '{"f1": ["s1c"], "f2": ["s2c"], "f3": ["s3a"]}' }
    ],
    stats: { entitiesWithGaps: 3, traitsAdded: 6 }
  },

  // Format 2: AI uses entities instead of filledEntities (common mistake)
  entitiesInsteadOfFilledEntities: {
    entities: [
      { entityId: "e1", filledTraits: '{"f2": ["s2b"], "f3": ["s3a"]}' },
      { entityId: "e2", filledTraits: '{"f3": ["s3b"]}' }
    ]
  },

  // Format 3: AI uses id instead of entityId
  idInsteadOfEntityId: {
    filledEntities: [
      { id: "e1", filledTraits: '{"f2": ["s2b"]}' },
      { id: "e2", traitsMap: '{"f3": ["s3b"]}' }
    ]
  },

  // Format 4: AI returns traits as object instead of string
  traitsAsObject: {
    filledEntities: [
      { entityId: "e1", filledTraits: { f2: ["s2b"] } },
      { entityId: "e2", filledTraits: { f3: ["s3b"] } }
    ]
  },

  // Format 5: Empty response (BUG CASE!)
  empty: {},

  // Format 6: Empty filledEntities array
  emptyArray: {
    filledEntities: []
  },

  // Format 7: Null response
  nullResponse: null,

  // Format 8: AI returns full entities instead of partial (overwrites)
  fullEntitiesReplace: {
    entities: [
      { id: "e1", name: "Species A", traits: { f2: ["s2b"] } } // MISSING f1 trait!
    ]
  }
};

// Simulate refineExistingProject fillGaps logic
function simulateFillGapsLogic(existingProject: any, aiResponse: any): any {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('SIMULATING FILLGAPS LOGIC');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Step 1: Parse response
  let data = aiResponse;
  if (typeof aiResponse === 'string') {
    try {
      data = JSON.parse(aiResponse);
    } catch (e) {
      console.error('[FAIL] Could not parse JSON string');
      console.log('[ACTION] Returning original project INTACT');
      return existingProject;
    }
  }

  console.log('[DEBUG] Parsed data:', JSON.stringify(data, null, 2));
  console.log('[DEBUG] data type:', typeof data);
  console.log('[DEBUG] data keys:', data ? Object.keys(data) : 'null');

  // Step 2: Extract filledEntities
  const filledEntities = data?.filledEntities || data?.entities || [];
  console.log('[DEBUG] filledEntities found:', filledEntities.length);

  // Step 3: Validate
  if (!Array.isArray(filledEntities) || filledEntities.length === 0) {
    console.log('[SAFE] No valid filled entities found');
    console.log('[ACTION] Returning original project with', existingProject.entities.length, 'entities INTACT');
    return existingProject;
  }

  // Step 4: Build map
  const featureById = new Map(existingProject.features.map((f: any) => [f.id, f]));
  const filledTraitsMap = new Map<string, Record<string, string[]>>();

  for (const item of filledEntities) {
    try {
      const entityId = item.entityId || item.id;
      const traitsData = item.filledTraits || item.traitsMap || item.traits;
      
      console.log(`[DEBUG] Processing item: entityId=${entityId}, traitsData type=${typeof traitsData}`);
      
      const traits = typeof traitsData === 'string' 
        ? JSON.parse(traitsData) 
        : traitsData;
      
      if (entityId && traits) {
        filledTraitsMap.set(entityId, traits);
        console.log(`[OK] Mapped entity ${entityId} -> traits:`, traits);
      } else {
        console.log(`[WARN] Invalid item - entityId: ${entityId}, traits: ${traits}`);
      }
    } catch (e) {
      console.warn(`[WARN] Failed to parse traits for entity`, item);
    }
  }

  console.log('\n[DEBUG] Filled traits map size:', filledTraitsMap.size);

  // Step 5: Merge
  const mergedEntities = existingProject.entities.map((entity: any) => {
    const newTraits = filledTraitsMap.get(entity.id);
    if (!newTraits) {
      console.log(`[PRESERVE] Entity ${entity.id} (${entity.name}) - no changes`);
      return entity;
    }

    const validatedTraits = { ...entity.traits };
    for (const [featureId, stateIds] of Object.entries(newTraits)) {
      const feature = featureById.get(featureId);
      if (!feature) {
        console.log(`[SKIP] Invalid feature ID: ${featureId}`);
        continue;
      }

      const validStateIds = (feature as any).states.map((s: any) => s.id);
      const validNewStates = (stateIds as string[]).filter(sid => validStateIds.includes(sid));
      
      if (validNewStates.length > 0) {
        const existing = validatedTraits[featureId] || [];
        const combined = [...new Set([...existing, ...validNewStates])];
        validatedTraits[featureId] = combined;
        console.log(`[MERGE] Entity ${entity.id}: ${featureId} = ${JSON.stringify(combined)}`);
      }
    }

    return { ...entity, traits: validatedTraits };
  });

  // Step 6: Safety check
  if (mergedEntities.length !== existingProject.entities.length) {
    console.error(`[CRITICAL ERROR] Entity count mismatch! Original: ${existingProject.entities.length}, Merged: ${mergedEntities.length}`);
    console.log('[ACTION] Returning original project to prevent data loss');
    return existingProject;
  }

  console.log(`\n[SUCCESS] fillGaps complete: ${filledTraitsMap.size} entities updated, ${mergedEntities.length} total entities preserved`);
  
  return { ...existingProject, entities: mergedEntities };
}

// Run tests
console.log('\n' + '='.repeat(80));
console.log('FILLGAPS DEBUG TESTS');
console.log('='.repeat(80));

const testCases = [
  { name: 'Correct Format', response: aiResponses.correct },
  { name: 'Entities Instead of FilledEntities', response: aiResponses.entitiesInsteadOfFilledEntities },
  { name: 'ID Instead of EntityID', response: aiResponses.idInsteadOfEntityId },
  { name: 'Traits as Object', response: aiResponses.traitsAsObject },
  { name: 'Empty Response (BUG CASE)', response: aiResponses.empty },
  { name: 'Empty Array', response: aiResponses.emptyArray },
  { name: 'Null Response', response: aiResponses.nullResponse },
  { name: 'Full Entities Replace (DANGER)', response: aiResponses.fullEntitiesReplace },
];

for (const test of testCases) {
  console.log('\n' + '─'.repeat(80));
  console.log(`TEST: ${test.name}`);
  console.log('─'.repeat(80));
  
  const originalCount = mockExistingProject.entities.length;
  const result = simulateFillGapsLogic(mockExistingProject, test.response);
  const resultCount = result.entities.length;
  
  console.log('\n[RESULT]');
  console.log(`  Original entities: ${originalCount}`);
  console.log(`  Result entities: ${resultCount}`);
  console.log(`  Data preserved: ${resultCount === originalCount ? '✅ YES' : '❌ NO - DATA LOSS!'}`);
  
  if (resultCount === originalCount) {
    // Check if traits were merged correctly
    const e1Traits = result.entities.find((e: any) => e.id === 'e1')?.traits;
    const e2Traits = result.entities.find((e: any) => e.id === 'e2')?.traits;
    const e3Traits = result.entities.find((e: any) => e.id === 'e3')?.traits;
    
    console.log(`  Entity e1 traits: ${JSON.stringify(e1Traits)}`);
    console.log(`  Entity e2 traits: ${JSON.stringify(e2Traits)}`);
    console.log(`  Entity e3 traits: ${JSON.stringify(e3Traits)}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('DEBUG TESTS COMPLETE');
console.log('='.repeat(80) + '\n');
