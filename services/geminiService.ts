import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Entity, Feature, AIConfig } from "../types";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * ============================================================================
 * IMAGE FETCHING SYSTEM - Multi-source approach for maximum reliability
 * ============================================================================
 * Priority order:
 * 1. iNaturalist API (best for biodiversity - has curated species photos)
 * 2. Wikipedia/Wikimedia Commons (good general coverage)
 * 3. Picsum placeholder (fallback with consistent seeded images)
 */

/**
 * Fetch image from iNaturalist API - Best source for species/biodiversity
 * Uses the taxa search endpoint which returns photos from research-grade observations
 */
async function fetchINaturalistImage(searchTerm: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: searchTerm,
      per_page: '1',
      locale: 'pt-BR'
    });
    
    const response = await fetch(`https://api.inaturalist.org/v1/taxa?${params}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const taxon = data.results[0];
      
      // iNaturalist provides multiple photo sizes - use medium (500px max)
      if (taxon.default_photo?.medium_url) {
        return taxon.default_photo.medium_url;
      }
      // Fallback to square if medium not available
      if (taxon.default_photo?.square_url) {
        // Convert square to medium size
        return taxon.default_photo.square_url.replace('/square.', '/medium.');
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`iNaturalist fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Biodiversity4All (Portuguese iNaturalist network)
 * Great for Iberian/Portuguese biodiversity - uses iNaturalist API with place filter
 * https://www.biodiversity4all.org/
 */
async function fetchBiodiversity4AllImage(searchTerm: string): Promise<string | null> {
  try {
    // Biodiversity4All uses the same iNaturalist API but we can filter by place
    // Place ID 7122 = Portugal, 6854 = Iberian Peninsula
    const params = new URLSearchParams({
      q: searchTerm,
      per_page: '3', // Get a few results to find best match
      locale: 'pt',
      preferred_place_id: '7122' // Portugal
    });
    
    const response = await fetch(`https://api.inaturalist.org/v1/taxa?${params}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Try to find an exact or close match
      for (const taxon of data.results) {
        if (taxon.default_photo?.medium_url) {
          return taxon.default_photo.medium_url;
        }
        if (taxon.default_photo?.square_url) {
          return taxon.default_photo.square_url.replace('/square.', '/medium.');
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Biodiversity4All fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Wikipedia using the pageimages API
 * Good for well-known species and general topics
 */
async function fetchWikipediaImage(entityName: string, language: string = 'pt'): Promise<string | null> {
  try {
    const wikis = language === 'pt' ? ['pt', 'en'] : ['en', 'pt'];
    
    for (const lang of wikis) {
      const wikiUrl = `https://${lang}.wikipedia.org/w/api.php`;
      
      const searchParams = new URLSearchParams({
        action: 'query',
        titles: entityName,
        prop: 'pageimages',
        pithumbsize: '400',
        format: 'json',
        origin: '*',
        redirects: '1'
      });
      
      const response = await fetch(`${wikiUrl}?${searchParams}`);
      if (!response.ok) continue;
      
      const data = await response.json();
      const pages = data.query?.pages;
      
      if (pages) {
        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];
        
        if (page && !page.missing && page.thumbnail?.source) {
          let imageUrl = page.thumbnail.source;
          // Try to get larger version
          imageUrl = imageUrl.replace(/\/\d+px-/, '/400px-');
          return imageUrl;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Wikipedia fetch failed for "${entityName}":`, error);
    return null;
  }
}

/**
 * Fetch image from Wikimedia Commons - good for scientific/biological content
 */
async function fetchWikimediaCommonsImage(searchTerm: string): Promise<string | null> {
  try {
    const commonsUrl = 'https://commons.wikimedia.org/w/api.php';
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${searchTerm}`,
      gsrnamespace: '6', // File namespace
      gsrlimit: '3',
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: '400',
      format: 'json',
      origin: '*'
    });
    
    const response = await fetch(`${commonsUrl}?${params}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (pages) {
      // Find first valid image (prefer jpg/png)
      for (const page of Object.values(pages) as any[]) {
        const info = page?.imageinfo?.[0];
        if (info?.thumburl && info?.mime?.startsWith('image/')) {
          return info.thumburl;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Wikimedia Commons fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Main function: Fetch a valid image URL using multi-source fallback strategy
 * Tries sources in order of reliability for biological/species content
 * Order: Biodiversity4All → iNaturalist → Wikipedia → Wikimedia Commons
 */
async function fetchEntityImage(
  entityName: string, 
  scientificName?: string,
  language: string = 'pt'
): Promise<string | null> {
  // Build search terms - scientific name first (more precise), then common name
  const searchTerms = [scientificName, entityName].filter(Boolean) as string[];
  
  for (const term of searchTerms) {
    // 1. Try Biodiversity4All first (Portuguese/Iberian biodiversity - https://www.biodiversity4all.org/)
    const b4aImage = await fetchBiodiversity4AllImage(term);
    if (b4aImage) return b4aImage;
    
    // 2. Try iNaturalist global (best for worldwide biodiversity)
    const iNatImage = await fetchINaturalistImage(term);
    if (iNatImage) return iNatImage;
    
    // 3. Try Wikipedia
    const wikiImage = await fetchWikipediaImage(term, language);
    if (wikiImage) return wikiImage;
    
    // 4. Try Wikimedia Commons
    const commonsImage = await fetchWikimediaCommonsImage(term);
    if (commonsImage) return commonsImage;
  }
  
  return null;
}

/**
 * Batch fetch images for multiple entities with progress callback
 * Uses parallel requests with rate limiting to avoid API throttling
 */
export async function fetchImagesForEntities(
  entities: Array<{ name: string; scientificName?: string }>,
  language: string = 'pt',
  onProgress?: (current: number, total: number, entityName: string) => void
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const batchSize = 3; // Conservative to respect API limits
  
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    
    const promises = batch.map(async (entity) => {
      const imageUrl = await fetchEntityImage(entity.name, entity.scientificName, language);
      return { name: entity.name, url: imageUrl };
    });
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      if (result.url) {
        imageMap.set(result.name, result.url);
      }
    });
    
    if (onProgress) {
      const current = Math.min(i + batchSize, entities.length);
      const lastEntity = batch[batch.length - 1]?.name || '';
      onProgress(current, entities.length, lastEntity);
    }
    
    // Delay between batches (100ms to stay under 60 req/min for iNaturalist)
    if (i + batchSize < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  
  return imageMap;
}

/**
 * Generate a consistent placeholder URL based on entity name
 * Uses Picsum with a seeded hash for reproducible results
 */
function getPlaceholderImage(entityName: string): string {
  // Use a hash of the name as seed for consistent placeholder
  const seed = encodeURIComponent(entityName.toLowerCase().replace(/\s+/g, '-'));
  return `https://picsum.photos/seed/${seed}/400/300`;
}

/**
 * Try to extract scientific name from entity name
 * Handles common patterns like "Entity (Scientific Name)" or "Scientific Name"
 */
function extractScientificName(entityName: string): string | null {
  // Check for pattern: "Common Name (Scientific Name)"
  const parenMatch = entityName.match(/\(([A-Z][a-z]+ [a-z]+[^)]*)\)/);
  if (parenMatch) return parenMatch[1];
  
  // Check if the name itself looks like a scientific name (Genus species)
  const binomialPattern = /^([A-Z][a-z]+)\s+([a-z]+)(\s+.*)?$/;
  if (binomialPattern.test(entityName)) return entityName.split(/\s+-\s+/)[0].trim();
  
  return null;
}

// Helper to attempt to repair truncated JSON
const repairTruncatedJson = (jsonStr: string): any => {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("JSON truncated. Attempting repair...");

    // 1. Remove trailing comma if present
    let repaired = jsonStr.trim().replace(/,$/, '');

    // 2. Check for unterminated string
    // Count quotes. If odd, add a closing quote.
    const quoteCount = (repaired.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }

    // 3. Close open brackets/braces
    // This is a naive stack approach
    const stack = [];
    for (const char of repaired) {
      if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}' || char === ']') {
        // If we match the top, pop. If not, we might be in a string (already handled above roughly) 
        // or structure is complex. This is heuristic.
        const last = stack[stack.length - 1];
        if (last === char) stack.pop();
      }
    }

    // Append missing closures in reverse order
    repaired += stack.reverse().join('');

    try {
      return JSON.parse(repaired);
    } catch (e2) {
      console.error("Repair failed", e2);
      throw e; // Original error
    }
  }
};

// Common Schema Definitions
const baseFeatureSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the feature (e.g., 'Wing Color')" },
    imageUrl: { type: Type.STRING, description: "URL for feature illustration" },
    states: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: "A state description (e.g., 'Blue')" }
    }
  },
  required: ["name", "states"]
};

const linkSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Title of the link (e.g., 'Wikipedia', 'GBIF')" },
    url: { type: Type.STRING, description: "Full URL" }
  },
  required: ["label", "url"]
};

// Standard Schema (Verbose/Strict for Generation)
const generationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    projectDescription: { type: Type.STRING },
    features: {
      type: Type.ARRAY,
      items: baseFeatureSchema
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Entity name (can be common name or scientific name)" },
          scientificName: { type: Type.STRING, description: "Scientific binomial name (e.g., 'Panthera leo'). REQUIRED for biological species." },
          family: { type: Type.STRING, description: "Taxonomic family name (e.g., 'Felidae', 'Fabaceae'). REQUIRED for biological species." },
          description: { type: Type.STRING },
          links: { type: Type.ARRAY, items: linkSchema, description: "External resources" },
          traits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                featureName: { type: Type.STRING, description: "Must match one of the feature names exactly" },
                stateValue: { type: Type.STRING, description: "Must match one of the state values for that feature exactly" }
              },
              required: ["featureName", "stateValue"]
            }
          }
        },
        required: ["name", "description", "traits"]
      }
    }
  },
  required: ["projectName", "projectDescription", "features", "entities"]
};

// Optimized Schema for Import (Uses string array for traits to save tokens on large lists)
const importSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    projectDescription: { type: Type.STRING },
    features: {
      type: Type.ARRAY,
      items: baseFeatureSchema
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Entity name as found in document" },
          scientificName: { type: Type.STRING, description: "Scientific binomial name if available (e.g., 'Panthera leo')" },
          family: { type: Type.STRING, description: "Taxonomic family name if available (e.g., 'Felidae', 'Fabaceae')" },
          description: { type: Type.STRING },
          links: { type: Type.ARRAY, items: linkSchema, description: "External resources" },
          traits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                featureName: { type: Type.STRING, description: "Must match one of the feature names exactly" },
                stateValue: { type: Type.STRING, description: "Must match one of the state values for that feature exactly" }
              },
              required: ["featureName", "stateValue"]
            }
          }
        },
        required: ["name", "description", "traits"]
      }
    }
  },
  required: ["projectName", "projectDescription", "features", "entities"]
};

interface PromptData {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  parts?: any[];
}

/**
 * Builds the prompt data without executing the API call.
 * Useful for "Copy Prompt" functionality or preparing the request.
 */
export const buildPromptData = (config: AIConfig): PromptData => {
  const langInstruction = config.language === 'pt'
    ? "All content (Project Name, Description, Features, States, Entities, Descriptions) MUST be in Portuguese (Brazil)."
    : "All content must be in English.";

  // NOTE: Images are now fetched via APIs (iNaturalist, Wikipedia), so we don't ask the AI for URLs
  const scientificNameInstruction = "For biological entities, ALWAYS provide: 1) the scientific binomial name (e.g., 'Panthera leo', 'Quercus robur'), and 2) the taxonomic family (e.g., 'Felidae', 'Fabaceae'). Both are REQUIRED for accurate classification.";

  let featureImageInstruction = config.includeFeatureImages
    ? "For each feature, provide a valid, DIRECT public URL to an image file illustrating the trait if available."
    : "Leave `imageUrl` empty for features.";

  let linkInstruction = config.includeLinks
    ? "For each entity, provide 1-2 reputable external links (e.g., Wikipedia, IUCN, GBIF, Flora e Funga do Brasil) in the 'links' array."
    : "Leave the 'links' array empty.";

  // 1. IMPORT MODE LOGIC
  if (config.importedFile) {

    // Feature Focus Logic for Import
    let filterInstruction = "Extract ALL distinctive features found in the text.";
    if (config.featureFocus === 'vegetative') {
      filterInstruction = "STRICTLY EXTRACT ONLY VEGETATIVE features (leaves, bark, stem, roots, growth habit). IGNORE reproductive features (flowers, fruits, seeds).";
    } else if (config.featureFocus === 'reproductive') {
      filterInstruction = "STRICTLY EXTRACT ONLY REPRODUCTIVE features (flowers, fruits, seeds, inflorescence). IGNORE vegetative features.";
    }

    // Detail Level Logic for Import
    let detailInstruction = "Maintain the descriptions as close to the original text as possible (Balanced).";
    if (config.detailLevel === 1) {
      detailInstruction = "SIMPLIFY the descriptions. Use shorter, easier sentences. Remove excessive jargon.";
    } else if (config.detailLevel === 3) {
      detailInstruction = "MAXIMIZE DETAIL. Keep all scientific terms, measurements, and nuances found in the text.";
    }

    const importSystemInstruction = `
      You are an expert biologist and data analyst.
      Your task is to analyze the provided document (PDF, Text, or Image) and extract a structured Matrix Identification Key.
      
      **Goal**: Extract entities and features to build a matrix.
      
      **CRITICAL INSTRUCTIONS**: 
      1. You must extract **EVERY SINGLE** species/entity found in the text. DO NOT truncate the list.
      2. **FILTER**: ${filterInstruction}
      3. **DETAIL**: ${detailInstruction}
      4. **SCIENTIFIC NAMES**: ${scientificNameInstruction}
      5. **MEDIA**: 
         - Feature Images: ${featureImageInstruction}
         - External Links: ${linkInstruction}
      6. ${langInstruction}
      
      **Format**: Return valid JSON.
      **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
    `;

    const importPrompt = `
      Analyze the attached file. Extract a comprehensive biological identification key.
      
      - Project Name: Derive from document title.
      - Description: Summary of content.
      - Entities: Extract ALL entities found. Include scientific names for accurate image lookup.
      - Features: Extract distinctive traits based on the focus setting.
      - Matrix: Map traits to entities.
      
      If analyzing a Dichotomous Key, flatten the logic: assign all traits accumulated along the path to the species.
    `;

    const parts = [
      {
        inlineData: {
          mimeType: config.importedFile.mimeType,
          data: config.importedFile.data
        }
      },
      { text: importPrompt }
    ];

    return {
      systemInstruction: importSystemInstruction,
      prompt: importPrompt,
      parts: parts,
      schema: importSchema
    };
  }

  // 2. GENERATION MODE LOGIC (Standard)
  let focusInstruction = "";
  if (config.featureFocus === 'reproductive') {
    focusInstruction = "Focus primarily on reproductive features (e.g., flowers, fruits, seeds, cones, spores, inflorescence).";
  } else if (config.featureFocus === 'vegetative') {
    focusInstruction = "Focus primarily on vegetative features (e.g., leaves, bark, stem, roots, growth habit, phyllo taxis).";
  } else {
    focusInstruction = "Use a balanced mix of vegetative and reproductive features.";
  }

  // Detail Level Logic
  let detailInstruction = "";
  if (config.detailLevel === 1) {
    detailInstruction = "AUDIENCE: Children or General Public. Use simple, common language. Short descriptions. Avoid complex jargon.";
  } else if (config.detailLevel === 3) {
    detailInstruction = "AUDIENCE: Experts/Scientists. Use precise botanical/zoological terminology. Comprehensive descriptions. High detail.";
  } else {
    detailInstruction = "AUDIENCE: Students/Enthusiasts. Balanced use of scientific terms with clear explanations.";
  }

  const systemInstruction = `
    You are an expert taxonomist and biologist. 
    Your task is to create an interactive identification key (matrix key) based strictly on the user's constraints.
    
    Constraints:
    1.  **Language**: ${langInstruction}
    2.  **Topic**: The general subject.
    3.  **Geography**: Restrict entities to this region/biome.
    4.  **Taxonomy**: Restrict to this Family/Genus/Order if specified.
    5.  **Quantity**: Generate exactly or close to the requested number of entities and features.
    6.  **Focus**: ${focusInstruction}
    7.  **Detail Level**: ${detailInstruction}
    8.  **SCIENTIFIC NAMES**: ${scientificNameInstruction}
    9.  **MEDIA**: 
        - Feature Images: ${featureImageInstruction}
        - External Links: ${linkInstruction}

    Output Requirements:
    1.  List of distinctive features. Each feature must have 2+ states.
    2.  List of entities with their scientific binomial names.
    3.  Matrix: Assign correct states.
    4.  **Scientific Accuracy**: Ensure traits are factual.

    The response must be a structured JSON object.
    **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
  `;

  const prompt = `
    Create an identification key for: "${config.topic}".
    
    Constraints:
    - Language: ${config.language === 'pt' ? 'Portuguese' : 'English'}
    - Geographic Scope: ${config.geography || "Global"}
    - Taxonomic Context: ${config.taxonomy || "General"}
    - Target Number of Entities: ${config.count}
    - Target Number of Features: ${config.featureCount}
    - Feature Focus: ${config.featureFocus}
    - Complexity Level: ${config.detailLevel}/3
    
    IMPORTANT: For each entity, you MUST provide the scientificName field with the correct binomial nomenclature (e.g., "Panthera leo" for Lion).

    Ensure the features allow for effective separation of these entities.
  `;

  return {
    systemInstruction,
    prompt,
    schema: generationSchema,
    parts: undefined // Standard generation uses prompt string as content
  };
};

export const generateKeyFromTopic = async (
  config: AIConfig,
  apiKey: string,
  onPromptGenerated?: (fullPrompt: string) => void,
  onImageProgress?: (current: number, total: number, entityName: string) => void
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Build the prompt using the extracted logic
  const { systemInstruction, prompt, parts, schema } = buildPromptData(config);

  // Notify callback for clipboard (reconstructing the full context)
  if (onPromptGenerated) {
    onPromptGenerated(`SYSTEM:\n${systemInstruction}\n\nUSER PROMPT:\n${prompt}`);
  }

  // Determine content payload (Simple text or Parts array for files)
  const contents = parts ? parts : prompt;

  // Generate the key structure (without reliable images yet)
  const project = await callGemini(ai, config.model, contents, systemInstruction, schema);

  // Now fetch real images from iNaturalist/Wikipedia APIs
  if (config.includeSpeciesImages && project.entities.length > 0) {
    const entitiesToFetch = project.entities.map(e => ({
      name: e.name,
      // Use scientificName from AI response (stored in entity), or try to extract from name
      scientificName: (e as any).scientificName || extractScientificName(e.name) || e.name
    }));
    
    const imageMap = await fetchImagesForEntities(
      entitiesToFetch,
      config.language,
      onImageProgress
    );
    
    // Update entities with fetched images, remove temporary scientificName field
    project.entities = project.entities.map(entity => {
      const { scientificName, ...cleanEntity } = entity as any;
      return {
        ...cleanEntity,
        imageUrl: imageMap.get(entity.name) || getPlaceholderImage(entity.name)
      };
    });
  }

  return project;
};

export const generateKeyFromCustomPrompt = async (
  customPrompt: string,
  apiKey: string,
  model: string = "gemini-2.5-flash"
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Use minimal system instruction as the user provides the full context
  const systemInstruction = `You are an expert biologist. Return ONLY valid JSON matching the schema. Do not include markdown code fences.`;

  return await callGemini(ai, model, customPrompt, systemInstruction, generationSchema);
};

// Unified Gemini Call function with Schema support
async function callGemini(
  ai: GoogleGenAI,
  modelName: string,
  contents: any,
  systemInstruction: string,
  responseSchema: Schema
): Promise<Project> {

  const generateContentWithFallback = async (currentModel: string): Promise<any> => {
    try {
      return await ai.models.generateContent({
        model: currentModel.trim(),
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          // CRITICAL FIX: Increase max output tokens to allow large JSON responses (e.g. 133 species)
          maxOutputTokens: 65536,
        }
      });
    } catch (error: any) {
      if (error.message?.includes("404") || error.message?.includes("NOT_FOUND")) {
        const fallbackModel = "gemini-2.5-flash";
        if (currentModel !== fallbackModel) {
          console.warn(`Model ${currentModel} not found, falling back to ${fallbackModel}`);
          return await generateContentWithFallback(fallbackModel);
        }
      }
      throw error;
    }
  };

  try {
    const modelToUse = modelName || "gemini-2.5-flash";
    const response = await generateContentWithFallback(modelToUse);
    // Use repair function instead of straight JSON.parse
    const data = repairTruncatedJson(response.text || "{}");

    if (!data.projectName) throw new Error("Invalid AI response");

    // Transform AI response to internal data model with IDs
    const features: Feature[] = data.features.map((f: any) => ({
      id: generateId(),
      name: f.name,
      imageUrl: f.imageUrl || "",
      states: f.states.map((s: string) => ({ id: generateId(), label: s }))
    }));

    const entities: Entity[] = data.entities.map((e: any) => {
      const entityTraits: Record<string, string[]> = {};

      e.traits.forEach((t: any) => {
        let fName: string = "";
        let sValue: string = "";

        // Hybrid Parsing: Support both Object {featureName, stateValue} and String "Feature:State"
        if (typeof t === 'string') {
          const splitIndex = t.indexOf(':');
          if (splitIndex > -1) {
            fName = t.substring(0, splitIndex).trim();
            sValue = t.substring(splitIndex + 1).trim();
          }
        } else if (typeof t === 'object' && t !== null) {
          fName = t.featureName;
          sValue = t.stateValue;
        }

        if (fName && sValue) {
          // Fuzzy match feature name to be robust against minor AI hallucinations (case/trim)
          const feature = features.find(f => f.name.toLowerCase() === fName.toLowerCase());
          if (feature) {
            // Fuzzy match state
            const state = feature.states.find(s => s.label.toLowerCase() === sValue.toLowerCase());
            if (state) {
              if (!entityTraits[feature.id]) entityTraits[feature.id] = [];
              entityTraits[feature.id].push(state.id);
            }
          }
        }
      });

      // scientificName and family for taxonomy/image fetching
      const scientificName = e.scientificName || extractScientificName(e.name) || e.name;
      const family = e.family || '';

      // Placeholder URL - will be replaced by real API fetched images in generateKeyFromTopic
      const placeholderUrl = getPlaceholderImage(e.name);

      const rawLinks = Array.isArray(e.links) ? e.links : [];

      return {
        id: generateId(),
        name: e.name,
        scientificName: scientificName, // Store for image fetching and taxonomy
        family: family, // Taxonomic family
        description: e.description,
        imageUrl: placeholderUrl, // Will be replaced with real image
        links: rawLinks.map((l: any) => ({
          id: generateId(),
          label: l.label || "Link",
          url: l.url || "#"
        })),
        traits: entityTraits
      };
    });

    return {
      id: generateId(),
      name: data.projectName,
      description: data.projectDescription,
      features,
      entities
    };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}