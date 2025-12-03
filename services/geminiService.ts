import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Entity, Feature, AIConfig } from "../types";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

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
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          imageUrl: { type: Type.STRING, description: "URL for species image." },
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
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          imageUrl: { type: Type.STRING, description: "URL if found, else empty." },
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

  // Shared Instructions
  let speciesImageInstruction = config.includeSpeciesImages
    ? "For each entity, provide a valid, DIRECT public URL to an image file (must end in .jpg, .jpeg, or .png) representing the species. The URL must point directly to the image binary, not a landing page."
    : "Leave `imageUrl` empty for entities.";

  let featureImageInstruction = config.includeFeatureImages
    ? "For each feature, provide a valid, DIRECT public URL to an image file (must end in .jpg, .jpeg, or .png) illustrating the trait. The URL must point directly to the image binary, not a landing page."
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
      4. **MEDIA**: 
         - Species Images: ${speciesImageInstruction}
         - Feature Images: ${featureImageInstruction}
         - External Links: ${linkInstruction}
      5. ${langInstruction}
      
      **Format**: Return valid JSON.
      **IMPORTANT**: Do not include markdown code fences (\`\`\`json ... \`\`\`). Return raw JSON only. Ensure all keys and string values are properly escaped.
    `;

    const importPrompt = `
      Analyze the attached file. Extract a comprehensive biological identification key.
      
      - Project Name: Derive from document title.
      - Description: Summary of content.
      - Entities: Extract ALL entities found.
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
    8.  **Media**: 
        - Species Images: ${speciesImageInstruction}
        - Feature Images: ${featureImageInstruction}
        - External Links: ${linkInstruction}

    Output Requirements:
    1.  List of distinctive features. Each feature must have 2+ states.
    2.  List of entities.
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
  onPromptGenerated?: (fullPrompt: string) => void
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

  return await callGemini(ai, config.model, contents, systemInstruction, schema);
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

      // Simple URL validation
      const rawUrl = e.imageUrl ? e.imageUrl.trim() : "";
      const isValidUrl = rawUrl.startsWith("http");

      const rawLinks = Array.isArray(e.links) ? e.links : [];

      return {
        id: generateId(),
        name: e.name,
        description: e.description,
        imageUrl: isValidUrl ? rawUrl : `https://picsum.photos/seed/${encodeURIComponent(e.name)}/400/300`,
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