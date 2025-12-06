export type Language = 'en' | 'pt';

export type FeatureFocus = 'general' | 'reproductive' | 'vegetative';

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

export interface Project {
  id: string;
  name: string;
  description: string;
  features: Feature[];
  entities: Entity[];
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