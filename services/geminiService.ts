import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Entity, Feature, AIConfig } from "../types";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Timeout wrapper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

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
    
    const response = await fetchWithTimeout(`https://api.inaturalist.org/v1/taxa?${params}`, {}, 5000);
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
 * Fetch image from Flickr using public search API
 * Good for a wide variety of biological images
 * https://www.flickr.com/
 */
async function fetchFlickrImage(searchTerm: string): Promise<string | null> {
  try {
    // Flickr public search (no API key needed for basic search)
    // We use the public feed API which returns recent photos matching the tag
    const encodedTerm = encodeURIComponent(searchTerm);
    
    // Try Flickr's public API with JSON callback
    const response = await fetchWithTimeout(
      `https://www.flickr.com/services/feeds/photos_public.gne?tags=${encodedTerm}&tagmode=all&format=json&nojsoncallback=1`,
      {},
      5000
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Get the first image with a valid media URL
      for (const item of data.items) {
        if (item.media?.m) {
          // Convert from small to medium size (_m -> _z for 640px)
          return item.media.m.replace('_m.jpg', '_z.jpg');
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Flickr fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from Flora Digital UFSC
 * Excellent source for Brazilian flora
 * https://floradigital.ufsc.br/
 */
async function fetchFloraDigitalImage(searchTerm: string): Promise<string | null> {
  try {
    // Flora Digital doesn't have a public API, but we can try to construct
    // a search URL and note it as a reference source
    // For now, we return null as it requires scraping
    // The site will be added as a reference link instead
    return null;
  } catch (error) {
    console.warn(`Flora Digital UFSC fetch failed for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Fetch image from SIDOL (Sistema de Identificação Dendrológica Online)
 * Excellent source for Brazilian tree species
 * https://www.sidol.com.br/
 */
async function fetchSIDOLImage(searchTerm: string): Promise<string | null> {
  try {
    // SIDOL doesn't have a public API
    // The site will be added as a reference link for manual search
    return null;
  } catch (error) {
    console.warn(`SIDOL fetch failed for "${searchTerm}":`, error);
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
    
    const response = await fetchWithTimeout(`https://api.inaturalist.org/v1/taxa?${params}`, {}, 5000);
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
      
      const response = await fetchWithTimeout(`${wikiUrl}?${searchParams}`, {}, 5000);
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
    
    const response = await fetchWithTimeout(`${commonsUrl}?${params}`, {}, 5000);
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
 * Extract genus and species epithet from a scientific name (removes author citation)
 * Examples:
 *   "Inga vera Willd." → "Inga vera"
 *   "Swartzia simplex (Sw.) Spreng." → "Swartzia simplex"
 *   "Andira fraxinifolia Benth." → "Andira fraxinifolia"
 */
export function extractBinomial(name: string): string {
  if (!name) return '';
  
  // Remove any text in parentheses at the end (author abbreviations like "(Sw.)")
  let cleaned = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  
  // Split by spaces and take only the first two words (genus + epithet)
  const parts = cleaned.split(/\s+/);
  
  // If we have at least 2 parts, return genus + epithet
  if (parts.length >= 2) {
    // Check if second part looks like a species epithet (lowercase, no punctuation)
    const genus = parts[0];
    const epithet = parts[1];
    
    // Return only if epithet looks valid (starts lowercase, no author-like patterns)
    if (/^[a-z]/.test(epithet) && !epithet.includes('.')) {
      return `${genus} ${epithet}`;
    }
  }
  
  // Fallback: return original if we can't parse it
  return name;
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
  // Build search terms - clean scientific name first (genus + epithet only), then common name
  const cleanScientificName = scientificName ? extractBinomial(scientificName) : null;
  const cleanEntityName = extractBinomial(entityName);
  
  // Prioritize clean binomial, then try original names as fallback
  const searchTerms = [
    cleanScientificName,
    cleanEntityName,
    // Fallback to original names if cleaning changed them significantly
    scientificName !== cleanScientificName ? scientificName : null,
    entityName !== cleanEntityName ? entityName : null
  ].filter(Boolean) as string[];
  
  // Remove duplicates
  const uniqueTerms = [...new Set(searchTerms)];
  
  for (const term of uniqueTerms) {
    // 1. Try Biodiversity4All first (Portuguese/Iberian biodiversity - https://www.biodiversity4all.org/)
    const b4aImage = await fetchBiodiversity4AllImage(term);
    if (b4aImage) return b4aImage;
    
    // 2. Try iNaturalist global (best for worldwide biodiversity)
    const iNatImage = await fetchINaturalistImage(term);
    if (iNatImage) return iNatImage;
    
    // 3. Try Flickr (large public photo database - https://www.flickr.com/)
    const flickrImage = await fetchFlickrImage(term);
    if (flickrImage) return flickrImage;
    
    // 4. Try Wikipedia
    const wikiImage = await fetchWikipediaImage(term, language);
    if (wikiImage) return wikiImage;
    
    // 5. Try Wikimedia Commons
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
 * Generate reliable reference links for a biological entity
 * Uses known URL patterns from reputable databases
 */
function generateEntityLinks(scientificName: string, family: string, language: string): Array<{id: string; label: string; url: string}> {
  const links: Array<{id: string; label: string; url: string}> = [];
  
  if (!scientificName || scientificName.length < 3) return links;
  
  // Clean and encode the scientific name
  const cleanName = scientificName.trim();
  const encodedName = encodeURIComponent(cleanName);
  const underscoreName = cleanName.replace(/\s+/g, '_');
  
  // 1. Wikipedia - always works as a search
  const wikiLang = language === 'pt' ? 'pt' : 'en';
  links.push({
    id: generateId(),
    label: 'Wikipedia',
    url: `https://${wikiLang}.wikipedia.org/wiki/Special:Search?search=${encodedName}&go=Go`
  });
  
  // 2. GBIF (Global Biodiversity Information Facility) - best for occurrence data
  links.push({
    id: generateId(),
    label: 'GBIF',
    url: `https://www.gbif.org/species/search?q=${encodedName}`
  });
  
  // 3. iNaturalist - best for photos and observations
  links.push({
    id: generateId(),
    label: 'iNaturalist',
    url: `https://www.inaturalist.org/search?q=${encodedName}`
  });
  
  // 4. Add Flora e Funga do Brasil for Portuguese/Brazilian species
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'Flora e Funga do Brasil',
      url: `https://floradobrasil.jbrj.gov.br/consulta/busca.html?q=${encodedName}`
    });
  }
  
  // 5. Biodiversity4All for Portuguese content
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'Biodiversity4All',
      url: `https://www.biodiversity4all.org/search?q=${encodedName}`
    });
  }
  
  // 6. SIDOL (Sistema de Identificação Dendrológica Online) - for Brazilian trees
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'SIDOL',
      url: `https://www.sidol.com.br/busca?q=${encodedName}`
    });
  }
  
  // 7. Flora Digital UFSC - for Brazilian flora
  if (language === 'pt') {
    links.push({
      id: generateId(),
      label: 'Flora Digital UFSC',
      url: `https://floradigital.ufsc.br/busca.php?q=${encodedName}`
    });
  }
  
  // 8. Flickr - large public photo database
  links.push({
    id: generateId(),
    label: 'Flickr',
    url: `https://www.flickr.com/search/?text=${encodedName}`
  });
  
  // 9. POWO (Plants of the World Online) - for plants
  links.push({
    id: generateId(),
    label: 'POWO',
    url: `https://powo.science.kew.org/results?q=${encodedName}`
  });
  
  // Limit to 5 most relevant links (increased from 4)
  return links.slice(0, 5);
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

  // NOTE: Links are now generated programmatically from scientific names, so we tell the AI to leave them empty
  const linkInstruction = "Leave the 'links' array empty (links will be generated automatically from scientific names).";

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

    // Required features instruction for import mode
    const requiredFeaturesImport = config.requiredFeatures && config.requiredFeatures.length > 0
      ? `7. **REQUIRED FEATURES**: Prioritize extracting the following features if present in the document: ${config.requiredFeatures.join(', ')}. If the document doesn't mention them explicitly, still try to infer reasonable states for these features based on context.`
      : '';

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
      ${requiredFeaturesImport}
      
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
    ${config.requiredFeatures && config.requiredFeatures.length > 0 ? `10. **REQUIRED FEATURES**: You MUST include ALL of the following features in the key: ${config.requiredFeatures.join(', ')}. These are mandatory and must be among the features generated.` : ''}
    ${config.requiredSpecies && config.requiredSpecies.length > 0 ? `11. **REQUIRED SPECIES**: You MUST include ALL of the following species in the key: ${config.requiredSpecies.slice(0, 10).join(', ')}${config.requiredSpecies.length > 10 ? ` (and ${config.requiredSpecies.length - 10} more)` : ''}. These species are MANDATORY. For species with incomplete data, include them anyway and fill what you can.` : ''}

    Output Requirements:
    1.  List of distinctive features. Each feature must have 2+ states.
    2.  List of entities with their scientific binomial names.
    3.  Matrix: Assign correct states.
    4.  **Scientific Accuracy**: Ensure traits are factual.

    The response must be a structured JSON object.
    **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
  `;

  // Build required features instruction for prompt
  const requiredFeaturesPrompt = config.requiredFeatures && config.requiredFeatures.length > 0
    ? `\n    MANDATORY FEATURES: The following features MUST be included in the key:\n    ${config.requiredFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n    ')}\n`
    : '';

  // Build required species instruction for prompt
  const requiredSpeciesPrompt = config.requiredSpecies && config.requiredSpecies.length > 0
    ? `\n    MANDATORY SPECIES: The following species MUST be included in the key. Include them even if feature data is incomplete - fill in what you can:\n    ${config.requiredSpecies.map((s, i) => `${i + 1}. ${s}`).join('\n    ')}\n`
    : '';

  // Build geographic context from new fields
  const buildGeographicContext = () => {
    const parts: string[] = [];
    if (config.scope === 'global') {
      parts.push('Global scope');
    } else if (config.scope === 'national') {
      parts.push('Brazil (national)');
    } else if (config.scope === 'regional') {
      parts.push('Regional focus');
    }
    if (config.biome) parts.push(`Biome: ${config.biome}`);
    if (config.stateUF) parts.push(`State/UF: ${config.stateUF}`);
    if (config.geography) parts.push(`Region: ${config.geography}`);
    return parts.length > 0 ? parts.join(', ') : 'Global';
  };

  // Build taxonomic context from new fields
  const buildTaxonomicContext = () => {
    const parts: string[] = [];
    if (config.taxonomyFamily) parts.push(`Family: ${config.taxonomyFamily}`);
    if (config.taxonomyGenus) parts.push(`Genus: ${config.taxonomyGenus}`);
    if (config.taxonomy) parts.push(config.taxonomy); // Legacy field for compatibility
    return parts.length > 0 ? parts.join(', ') : 'General';
  };

  const prompt = `
    Create an identification key for: "${config.topic}".
    
    Constraints:
    - Language: ${config.language === 'pt' ? 'Portuguese' : 'English'}
    - Geographic Scope: ${buildGeographicContext()}
    - Taxonomic Context: ${buildTaxonomicContext()}
    - Target Number of Entities: ${config.count}${config.requiredSpecies && config.requiredSpecies.length > 0 ? ` (minimum - must include all required species plus additional if needed)` : ''}
    - Target Number of Features: ${config.featureCount}
    - Feature Focus: ${config.featureFocus}
    - Complexity Level: ${config.detailLevel}/3
    ${requiredFeaturesPrompt}${requiredSpeciesPrompt}
    IMPORTANT: For each entity, you MUST provide the scientificName field with the correct binomial nomenclature (e.g., "Panthera leo" for Lion).
    ${config.taxonomyFamily ? `All entities MUST belong to the family ${config.taxonomyFamily}.` : ''}
    ${config.taxonomyGenus ? `All entities MUST belong to the genus ${config.taxonomyGenus}.` : ''}
    ${config.biome ? `All entities MUST occur in the ${config.biome} biome.` : ''}
    ${config.stateUF ? `All entities MUST occur in ${config.stateUF}, Brazil.` : ''}
    ${config.scope === 'national' ? 'All entities MUST occur in Brazil. Use Flora do Brasil 2020 as reference for valid names.' : ''}
    ${config.requiredSpecies && config.requiredSpecies.length > 0 ? `\nCRITICAL: You MUST include ALL species from the MANDATORY SPECIES list above. For any species where you lack complete information, still include them and fill in what characteristics you can determine. These species are non-negotiable.` : ''}

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
  const project = await callGemini(ai, config.model, contents, systemInstruction, schema, config.language, config.includeLinks);

  // CRITICAL: Ensure ALL required species are included in the project
  // Even if the AI didn't include them, we add them with empty traits
  if (config.requiredSpecies && config.requiredSpecies.length > 0) {
    const existingNames = new Set(
      project.entities.map(e => e.name.toLowerCase().trim())
    );
    
    // Also check by scientific name similarity
    const existingScientificNames = new Set(
      project.entities.map(e => {
        const sciName = (e as any).scientificName || extractScientificName(e.name) || '';
        return sciName.toLowerCase().trim();
      })
    );
    
    for (const requiredSpecies of config.requiredSpecies) {
      const speciesLower = requiredSpecies.toLowerCase().trim();
      const speciesBinomial = extractBinomial(requiredSpecies).toLowerCase().trim();
      
      // Check if species already exists (by name or scientific name)
      const alreadyExists = existingNames.has(speciesLower) || 
                           existingNames.has(speciesBinomial) ||
                           existingScientificNames.has(speciesLower) ||
                           existingScientificNames.has(speciesBinomial) ||
                           // Also check partial matches for cases like "Inga edulis Mart." vs "Inga edulis"
                           Array.from(existingNames).some(n => n.includes(speciesBinomial) || speciesBinomial.includes(n)) ||
                           Array.from(existingScientificNames).some(n => n.includes(speciesBinomial) || speciesBinomial.includes(n));
      
      if (!alreadyExists) {
        // Add missing required species with placeholder data
        const cleanName = extractBinomial(requiredSpecies) || requiredSpecies;
        const newEntity: Entity = {
          id: generateId(),
          name: cleanName,
          description: config.language === 'pt' 
            ? `Espécie incluída da lista obrigatória. Dados a serem preenchidos.`
            : `Species included from required list. Data to be filled.`,
          imageUrl: getPlaceholderImage(cleanName),
          links: config.includeLinks ? generateEntityLinks(cleanName, '', config.language) : [],
          traits: {} // Empty traits - user can fill in later
        };
        
        // Add scientificName for image fetching
        (newEntity as any).scientificName = cleanName;
        
        project.entities.push(newEntity);
        
        // Update existing sets
        existingNames.add(cleanName.toLowerCase().trim());
        existingScientificNames.add(cleanName.toLowerCase().trim());
      }
    }
  }

  // Now fetch real images from iNaturalist/Wikipedia APIs
  // Limit to first 100 entities to avoid very long wait times
  const MAX_IMAGE_FETCH = 100;
  if (config.includeSpeciesImages && project.entities.length > 0) {
    const entitiesToFetch = project.entities.slice(0, MAX_IMAGE_FETCH).map(e => ({
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
    project.entities = project.entities.map((entity, index) => {
      const { scientificName, ...cleanEntity } = entity as any;
      // Only update image for entities we fetched (first MAX_IMAGE_FETCH)
      const imageUrl = index < MAX_IMAGE_FETCH 
        ? (imageMap.get(entity.name) || getPlaceholderImage(entity.name))
        : getPlaceholderImage(entity.name);
      return {
        ...cleanEntity,
        imageUrl
      };
    });
  }

  return project;
};

export const generateKeyFromCustomPrompt = async (
  customPrompt: string,
  apiKey: string,
  model: string = "gemini-2.5-flash",
  language: string = 'pt'
): Promise<Project> => {
  if (!apiKey) throw new Error("API Key is missing");
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Use minimal system instruction as the user provides the full context
  const systemInstruction = `You are an expert biologist. Return ONLY valid JSON matching the schema. Do not include markdown code fences.`;

  return await callGemini(ai, model, customPrompt, systemInstruction, generationSchema, language, true);
};

// Unified Gemini Call function with Schema support
async function callGemini(
  ai: GoogleGenAI,
  modelName: string,
  contents: any,
  systemInstruction: string,
  responseSchema: Schema,
  language: string = 'en',
  includeLinks: boolean = true
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

      // Generate reliable links programmatically instead of using AI-generated URLs
      const entityLinks = includeLinks 
        ? generateEntityLinks(scientificName, family, language)
        : [];

      return {
        id: generateId(),
        name: e.name,
        scientificName: scientificName, // Store for image fetching and taxonomy
        family: family, // Taxonomic family
        description: e.description,
        imageUrl: placeholderUrl, // Will be replaced with real image
        links: entityLinks,
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