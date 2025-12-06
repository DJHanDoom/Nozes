/**
 * Comprehensive Test Suite for Nozes.IA Refine Operations
 * Tests all edge cases for REFINE, EXPAND, CLEAN, and fillGaps operations
 * 
 * Run with: npx tsx tests/refine.test.ts
 */

// Inline type definitions (mirrors types.ts)
interface FeatureState {
  id: string;
  label: string;
  imageUrl?: string;
}

interface Feature {
  id: string;
  name: string;
  imageUrl?: string;
  states: FeatureState[];
}

interface EntityLink {
  id: string;
  label: string;
  url: string;
}

interface Entity {
  id: string;
  name: string;
  scientificName?: string;
  family?: string;
  description?: string;
  imageUrl?: string;
  links: EntityLink[];
  traits: Record<string, string[]>;
}

interface Project {
  id: string;
  name: string;
  description: string;
  features: Feature[];
  entities: Entity[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

const createTestProject = (entityCount: number = 5, featureCount: number = 3): Project => {
  const features: Feature[] = [];
  for (let i = 0; i < featureCount; i++) {
    features.push({
      id: `feature_${i}`,
      name: `Feature ${i}`,
      imageUrl: '',
      states: [
        { id: `feature_${i}_state_0`, label: `State 0 of Feature ${i}` },
        { id: `feature_${i}_state_1`, label: `State 1 of Feature ${i}` },
        { id: `feature_${i}_state_2`, label: `State 2 of Feature ${i}` },
      ]
    });
  }

  const entities: Entity[] = [];
  for (let i = 0; i < entityCount; i++) {
    const traits: Record<string, string[]> = {};
    // Assign some traits (not all - to simulate gaps)
    features.forEach((f, fIdx) => {
      if ((i + fIdx) % 2 === 0) { // Some entities have gaps
        traits[f.id] = [f.states[i % f.states.length].id];
      }
    });
    
    entities.push({
      id: `entity_${i}`,
      name: `Entity ${i}`,
      scientificName: `Genus species${i}`,
      family: 'Testaceae',
      description: `Description of entity ${i}`,
      imageUrl: `https://example.com/entity_${i}.jpg`,
      links: [{ id: 'link1', label: 'Wikipedia', url: 'https://wikipedia.org' }],
      traits
    });
  }

  return {
    id: 'test_project',
    name: 'Test Project',
    description: 'A test project for validation',
    features,
    entities
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK AI RESPONSES - Simulates various AI response formats
// ═══════════════════════════════════════════════════════════════════════════════

interface MockAIResponse {
  name: string;
  description: string;
  response: any;
  expectedBehavior: string;
}

const mockResponses: MockAIResponse[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // fillGaps responses
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'fillGaps_correct_format',
    description: 'Correct fillGaps response with filledEntities array',
    response: {
      filledEntities: [
        { entityId: 'entity_0', filledTraits: '{"feature_1": ["feature_1_state_0"]}' },
        { entityId: 'entity_1', filledTraits: '{"feature_0": ["feature_0_state_1"]}' },
      ],
      stats: { entitiesWithGaps: 2, traitsAdded: 2 }
    },
    expectedBehavior: 'Should merge new traits into existing entities without losing any data'
  },
  {
    name: 'fillGaps_empty_response',
    description: 'AI returns empty filledEntities',
    response: {
      filledEntities: [],
      stats: { entitiesWithGaps: 0, traitsAdded: 0 }
    },
    expectedBehavior: 'Should return original project unchanged'
  },
  {
    name: 'fillGaps_null_response',
    description: 'AI returns null/undefined',
    response: null,
    expectedBehavior: 'Should return original project unchanged'
  },
  {
    name: 'fillGaps_wrong_format_entities_array',
    description: 'AI returns entities array instead of filledEntities',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0', traitsMap: '{"feature_1": ["feature_1_state_0"]}' },
      ]
    },
    expectedBehavior: 'Should handle fallback format and merge traits'
  },
  {
    name: 'fillGaps_invalid_feature_ids',
    description: 'AI returns traits with invalid feature IDs',
    response: {
      filledEntities: [
        { entityId: 'entity_0', filledTraits: '{"invalid_feature": ["invalid_state"]}' },
      ]
    },
    expectedBehavior: 'Should ignore invalid IDs and preserve existing data'
  },
  {
    name: 'fillGaps_invalid_state_ids',
    description: 'AI returns traits with valid feature but invalid state IDs',
    response: {
      filledEntities: [
        { entityId: 'entity_0', filledTraits: '{"feature_0": ["invalid_state_id"]}' },
      ]
    },
    expectedBehavior: 'Should ignore invalid state IDs and preserve existing data'
  },
  {
    name: 'fillGaps_invalid_entity_ids',
    description: 'AI returns traits for non-existent entity IDs',
    response: {
      filledEntities: [
        { entityId: 'nonexistent_entity', filledTraits: '{"feature_0": ["feature_0_state_0"]}' },
      ]
    },
    expectedBehavior: 'Should ignore non-existent entities and preserve all existing'
  },
  {
    name: 'fillGaps_malformed_json_traits',
    description: 'AI returns malformed JSON in filledTraits',
    response: {
      filledEntities: [
        { entityId: 'entity_0', filledTraits: '{broken json' },
      ]
    },
    expectedBehavior: 'Should handle parse error gracefully and preserve existing data'
  },
  {
    name: 'fillGaps_object_traits_not_string',
    description: 'AI returns traits as object instead of JSON string',
    response: {
      filledEntities: [
        { entityId: 'entity_0', filledTraits: { feature_1: ['feature_1_state_0'] } },
      ]
    },
    expectedBehavior: 'Should handle object format and merge correctly'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // refine responses
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'refine_correct_format',
    description: 'Correct refine response with all entities',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0 Improved', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
        { id: 'entity_1', name: 'Entity 1 Improved', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
        { id: 'entity_2', name: 'Entity 2 Improved', traitsMap: '{"feature_0": ["feature_0_state_2"]}' },
        { id: 'entity_3', name: 'Entity 3 Improved', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
        { id: 'entity_4', name: 'Entity 4 Improved', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
      ]
    },
    expectedBehavior: 'Should update entities while preserving images and links'
  },
  {
    name: 'refine_missing_entities',
    description: 'AI returns fewer entities than original (data loss)',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
      ]
    },
    expectedBehavior: 'Should detect data loss and return original project'
  },
  {
    name: 'refine_empty_entities',
    description: 'AI returns empty entities array',
    response: {
      entities: []
    },
    expectedBehavior: 'Should return original project unchanged'
  },
  {
    name: 'refine_no_entities_key',
    description: 'AI returns response without entities key',
    response: {
      projectName: 'Test',
      features: []
    },
    expectedBehavior: 'Should return original project unchanged'
  },
  {
    name: 'refine_duplicate_entity_ids',
    description: 'AI returns duplicate entity IDs',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0 v1', traitsMap: '{}' },
        { id: 'entity_0', name: 'Entity 0 v2', traitsMap: '{}' },
        { id: 'entity_1', name: 'Entity 1', traitsMap: '{}' },
      ]
    },
    expectedBehavior: 'Should deduplicate and keep first occurrence'
  },
  {
    name: 'refine_missing_ids',
    description: 'AI returns entities without IDs',
    response: {
      entities: [
        { name: 'New Entity 1', traitsMap: '{}' },
        { name: 'New Entity 2', traitsMap: '{}' },
      ]
    },
    expectedBehavior: 'Should generate new IDs for entities without IDs'
  },
  {
    name: 'refine_empty_traitsmap',
    description: 'AI returns entities with empty traitsMap',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0', traitsMap: '{}' },
        { id: 'entity_1', name: 'Entity 1', traitsMap: '{}' },
        { id: 'entity_2', name: 'Entity 2', traitsMap: '{}' },
        { id: 'entity_3', name: 'Entity 3', traitsMap: '{}' },
        { id: 'entity_4', name: 'Entity 4', traitsMap: '{}' },
      ]
    },
    expectedBehavior: 'Should preserve existing traits when AI returns empty'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // expand responses
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'expand_adds_new_entities',
    description: 'AI adds new entities while preserving existing',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
        { id: 'new_entity_1', name: 'New Species 1', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
        { id: 'new_entity_2', name: 'New Species 2', traitsMap: '{"feature_0": ["feature_0_state_2"]}' },
      ]
    },
    expectedBehavior: 'Should include new entities AND all existing entities not in response'
  },
  {
    name: 'expand_only_new_entities',
    description: 'AI returns only new entities without existing ones',
    response: {
      entities: [
        { id: 'new_entity_1', name: 'New Species 1', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
        { id: 'new_entity_2', name: 'New Species 2', traitsMap: '{"feature_0": ["feature_0_state_2"]}' },
      ]
    },
    expectedBehavior: 'Should merge new entities with ALL existing entities'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // clean responses
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'clean_removes_redundant_features',
    description: 'Clean operation that preserves all entities',
    response: {
      entities: [
        { id: 'entity_0', name: 'Entity 0', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
        { id: 'entity_1', name: 'Entity 1', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
        { id: 'entity_2', name: 'Entity 2', traitsMap: '{"feature_0": ["feature_0_state_2"]}' },
        { id: 'entity_3', name: 'Entity 3', traitsMap: '{"feature_0": ["feature_0_state_0"]}' },
        { id: 'entity_4', name: 'Entity 4', traitsMap: '{"feature_0": ["feature_0_state_1"]}' },
      ]
    },
    expectedBehavior: 'Should update traits while preserving all entities'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge cases for JSON parsing
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'truncated_json',
    description: 'AI response is truncated mid-JSON',
    response: '{"entities": [{"id": "entity_0", "name": "Entity 0", "traitsMap": "{}"},{"id": "entity_1", "name": "E',
    expectedBehavior: 'Should attempt JSON repair or return original project'
  },
  {
    name: 'extra_text_around_json',
    description: 'AI returns JSON with extra text',
    response: 'Here is the result:\n```json\n{"entities": []}\n```\nDone!',
    expectedBehavior: 'Should extract JSON and handle empty entities by returning original'
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: string;
}

// Simulates the refineExistingProject logic for testing
function simulateRefine(
  existingProject: Project,
  aiResponse: any,
  mode: 'fillGaps' | 'refine' | 'expand' | 'clean'
): { result: Project; error?: string } {
  try {
    // Handle null/undefined response
    if (!aiResponse) {
      return { result: existingProject };
    }

    // Parse if string (simulating repairTruncatedJson)
    let data = aiResponse;
    if (typeof aiResponse === 'string') {
      try {
        // Simple JSON extraction
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          return { result: existingProject, error: 'Could not extract JSON' };
        }
      } catch (e) {
        return { result: existingProject, error: 'JSON parse error' };
      }
    }

    // Build lookup maps
    const featureById = new Map(existingProject.features.map(f => [f.id, f]));
    const entityById = new Map(existingProject.entities.map(e => [e.id, e]));

    if (mode === 'fillGaps') {
      // fillGaps mode: merge only new traits
      const filledEntities = data.filledEntities || data.entities || [];
      
      if (filledEntities.length === 0) {
        return { result: existingProject }; // Nothing to fill
      }

      // Create map of filled traits
      const filledTraitsMap = new Map<string, Record<string, string[]>>();
      for (const item of filledEntities) {
        try {
          const entityId = item.entityId || item.id;
          const traitsData = item.filledTraits || item.traitsMap || item.traits;
          
          if (!entityId) continue;
          
          const traits = typeof traitsData === 'string' 
            ? JSON.parse(traitsData) 
            : (traitsData || {});
            
          filledTraitsMap.set(entityId, traits);
        } catch (e) {
          // Skip malformed entries
        }
      }

      // Merge traits into existing entities
      const mergedEntities = existingProject.entities.map(entity => {
        const newTraits = filledTraitsMap.get(entity.id);
        if (!newTraits) return entity;

        const validatedTraits = { ...entity.traits };
        for (const [featureId, stateIds] of Object.entries(newTraits)) {
          const feature = featureById.get(featureId);
          if (!feature) continue;

          const validStateIds = new Set(feature.states.map(s => s.id));
          const validNewStates = (stateIds as string[]).filter(sid => validStateIds.has(sid));
          
          if (validNewStates.length > 0) {
            const existing = validatedTraits[featureId] || [];
            validatedTraits[featureId] = [...new Set([...existing, ...validNewStates])];
          }
        }

        return { ...entity, traits: validatedTraits };
      });

      return { result: { ...existingProject, entities: mergedEntities } };
    } else {
      // refine/expand/clean mode
      const responseEntities = data.entities || [];
      
      if (responseEntities.length === 0) {
        return { result: existingProject }; // Preserve original
      }

      const processedEntities: Entity[] = [];
      const seenIds = new Set<string>();

      for (const item of responseEntities) {
        const existingEntity = entityById.get(item.id);
        
        // Parse traitsMap
        let traits: Record<string, string[]> = {};
        try {
          const traitsData = item.traitsMap || item.traits;
          traits = typeof traitsData === 'string' 
            ? JSON.parse(traitsData) 
            : (traitsData || {});
        } catch (e) {
          traits = existingEntity?.traits || {};
        }

        // Validate trait IDs
        const validatedTraits: Record<string, string[]> = {};
        for (const [featureId, stateIds] of Object.entries(traits)) {
          const feature = featureById.get(featureId);
          if (!feature) continue;

          const validStateIds = new Set(feature.states.map(s => s.id));
          const validStates = (stateIds as string[]).filter(sid => validStateIds.has(sid));
          
          if (validStates.length > 0) {
            validatedTraits[featureId] = validStates;
          }
        }

        // Generate ID if missing
        const entityId = item.id || existingEntity?.id || `generated_${Math.random().toString(36).substr(2, 9)}`;
        if (seenIds.has(entityId)) continue; // Skip duplicates
        seenIds.add(entityId);

        processedEntities.push({
          id: entityId,
          name: item.name || existingEntity?.name || 'Unknown',
          scientificName: item.scientificName || existingEntity?.scientificName,
          family: item.family || existingEntity?.family,
          description: item.description || existingEntity?.description || '',
          imageUrl: existingEntity?.imageUrl || '', // ALWAYS preserve existing image
          links: existingEntity?.links || [],
          traits: Object.keys(validatedTraits).length > 0 ? validatedTraits : (existingEntity?.traits || {})
        });
      }

      // For EXPAND mode, include existing entities not in response
      if (mode === 'expand') {
        for (const entity of existingProject.entities) {
          if (!seenIds.has(entity.id)) {
            processedEntities.push(entity);
            seenIds.add(entity.id);
          }
        }
      }

      // Safety check: if we lost too many entities, return original
      if (mode !== 'expand' && processedEntities.length < existingProject.entities.length * 0.5) {
        return { result: existingProject, error: 'Data loss protection triggered' };
      }

      return { 
        result: { 
          ...existingProject, 
          entities: processedEntities,
          features: existingProject.features // Always preserve features
        } 
      };
    }
  } catch (e: any) {
    return { result: existingProject, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function runAllTests(): TestResult[] {
  const results: TestResult[] = [];
  const testProject = createTestProject(5, 3);
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('NOZES.IA REFINE OPERATIONS TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Test Project: ${testProject.entities.length} entities, ${testProject.features.length} features`);
  console.log('');

  // Test 1: Original project should never be modified
  const originalEntityCount = testProject.entities.length;
  const originalFeatureCount = testProject.features.length;
  const originalEntityIds = testProject.entities.map(e => e.id);
  const originalImageUrls = testProject.entities.map(e => e.imageUrl);

  for (const mock of mockResponses) {
    // Determine mode from test name
    let mode: 'fillGaps' | 'refine' | 'expand' | 'clean' = 'refine';
    if (mock.name.startsWith('fillGaps')) mode = 'fillGaps';
    else if (mock.name.startsWith('expand')) mode = 'expand';
    else if (mock.name.startsWith('clean')) mode = 'clean';

    const { result, error } = simulateRefine(testProject, mock.response, mode);
    
    // Validate results
    const issues: string[] = [];

    // Check 1: Never lose all entities
    if (result.entities.length === 0 && testProject.entities.length > 0) {
      issues.push(`CRITICAL: All entities were deleted! (had ${testProject.entities.length})`);
    }

    // Check 2: Features should always be preserved
    if (result.features.length !== originalFeatureCount) {
      issues.push(`Features changed: ${originalFeatureCount} -> ${result.features.length}`);
    }

    // Check 3: For non-expand modes, entity count should not decrease significantly
    if (mode !== 'expand' && result.entities.length < originalEntityCount * 0.5) {
      // This should trigger data loss protection, so result should equal original
      if (result !== testProject && result.entities.length !== originalEntityCount) {
        issues.push(`Data loss not prevented: ${originalEntityCount} -> ${result.entities.length}`);
      }
    }

    // Check 4: Existing images should be preserved
    for (const origEntity of testProject.entities) {
      const resultEntity = result.entities.find(e => e.id === origEntity.id);
      if (resultEntity && origEntity.imageUrl && resultEntity.imageUrl !== origEntity.imageUrl) {
        issues.push(`Image lost for ${origEntity.id}: "${origEntity.imageUrl}" -> "${resultEntity.imageUrl}"`);
      }
    }

    // Check 5: Existing links should be preserved
    for (const origEntity of testProject.entities) {
      const resultEntity = result.entities.find(e => e.id === origEntity.id);
      if (resultEntity && origEntity.links.length > 0 && resultEntity.links.length === 0) {
        issues.push(`Links lost for ${origEntity.id}`);
      }
    }

    // Check 6: For fillGaps, existing traits should not be removed
    if (mode === 'fillGaps') {
      for (const origEntity of testProject.entities) {
        const resultEntity = result.entities.find(e => e.id === origEntity.id);
        if (resultEntity) {
          for (const [featureId, stateIds] of Object.entries(origEntity.traits)) {
            const resultTraits = resultEntity.traits[featureId] || [];
            for (const stateId of stateIds) {
              if (!resultTraits.includes(stateId)) {
                issues.push(`Trait lost in fillGaps for ${origEntity.id}: ${featureId}/${stateId}`);
              }
            }
          }
        }
      }
    }

    // Check 7: For expand, all original entities must be present
    if (mode === 'expand') {
      for (const origId of originalEntityIds) {
        if (!result.entities.find(e => e.id === origId)) {
          issues.push(`Expand lost original entity: ${origId}`);
        }
      }
    }

    const passed = issues.length === 0;
    results.push({
      testName: mock.name,
      passed,
      error: error,
      details: passed ? mock.expectedBehavior : issues.join('; ')
    });

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${mock.name}`);
    if (!passed) {
      console.log(`       Mode: ${mode}`);
      console.log(`       Issues: ${issues.join('; ')}`);
      if (error) console.log(`       Error: ${error}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed out of ${results.length} tests`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  return results;
}

// Export for use
export { createTestProject, mockResponses, simulateRefine, runAllTests };
export type { TestResult };

// Run tests if executed directly
if (typeof window === 'undefined') {
  runAllTests();
}
