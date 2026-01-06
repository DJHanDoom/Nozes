export type Language = 'en' | 'pt';

// AI Provider types for multi-provider model selection
export type AIProvider = 'gemini' | 'openai' | 'claude' | 'huggingface';

export interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description?: string;
  contextWindow?: number;
  isRecommended?: boolean;
}

export interface ProviderConfig {
  name: string;
  apiKeyUrl: string;
  icon: string;
}

export type FeatureFocus = 'general' | 'reproductive' | 'vegetative' | string;

export interface FeatureState {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface Feature {
  id: string;
  name: string;
  imageUrl?: string;
  states: FeatureState[];
}

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
}

export interface Entity {
  id: string;
  name: string;
  scientificName?: string;
  family?: string;
  description: string;
  imageUrl?: string;
  links: ExternalLink[];
  // Map featureId to an array of valid stateIds for this entity
  traits: Record<string, string[]>;
}

export interface SubKeyReference {
  id: string;
  name: string; // e.g., "Chave A", "Chave B"
  description: string; // e.g., "Principais famílias de ervas e bambús terrícolas"
  projectId?: string; // ID of the linked sub-project if loaded
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category?: 'FLORA' | 'FAUNA' | 'OTHER';
  features: Feature[];
  entities: Entity[];
  // For hierarchical/linked keys
  subKeys?: SubKeyReference[]; // References to other keys this one links to
  parentKeyId?: string; // If this is a sub-key, reference to parent key
  isSubKey?: boolean; // Flag to indicate this is part of a larger key system
}

export interface ProjectCollection {
  id: string;
  name: string; // e.g., "Chave Dendrológica POLISEL"
  description: string;
  mainKey: Project; // The main/general key (hub)
  subKeys: Project[]; // All linked sub-keys
  metadata?: {
    source?: string; // e.g., "POLISEL 2024"
    author?: string;
    region?: string;
  };
}

export interface ImportedFile {
  data: string; // Base64 string
  mimeType: string;
}

export interface AIConfig {
  topic: string;
  category: 'FLORA' | 'FAUNA' | 'OTHER';
  count: number;
  featureCount: number;
  geography: string;
  taxonomy: string;
  // New taxonomy filters
  taxonomyFamily: string;
  taxonomyGenus: string;
  // New geography filters
  biome: string;
  stateUF: string;
  scope: 'global' | 'national' | 'regional';
  language: Language;
  featureFocus: FeatureFocus;
  includeSpeciesImages: boolean;
  includeFeatureImages: boolean;
  includeLinks: boolean; // New field
  model: string;
  detailLevel: number; // 1 = Simple, 2 = Balanced, 3 = Expert
  requiredFeatures?: string[]; // Features the AI must include
  requiredSpecies?: string[]; // Species that MUST be included in the key
  importedFile?: ImportedFile;
}

export type ViewMode = 'HOME' | 'BUILDER' | 'PLAYER';

export interface GenerationRequest {
  topic: string;
  context?: string;
}