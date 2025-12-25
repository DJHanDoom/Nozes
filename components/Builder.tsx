import React, { useState, useEffect } from 'react';
import { Project, Entity, Feature, AIConfig, Language, FeatureFocus, ImportedFile } from '../types';
import { generateKeyFromTopic, buildPromptData, generateKeyFromCustomPrompt, refineExistingProject, validateTaxonomy, fetchImagesForEntities, extractBinomial, convertDichotomousKey } from '../services/geminiService';
import { Wand2, Plus, Trash2, Save, Grid, LayoutList, Box, Loader2, CheckSquare, X, Download, Upload, Image as ImageIcon, FolderOpen, Settings2, Brain, Microscope, Baby, GraduationCap, FileText, FileSearch, Copy, Link as LinkIcon, Edit3, ExternalLink, Menu, Play, FileSpreadsheet, Edit, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Sparkles, ListPlus, Eraser, Target, Layers, Combine, Camera, KeyRound, FileCode, Check, Globe, Leaf, ShieldCheck, List, Search } from 'lucide-react';
import { utils, writeFile, read } from 'xlsx';

// Generate standalone HTML file with embedded player
const generateStandaloneHTML = (project: Project, lang: Language): string => {
  const projectJSON = JSON.stringify(project);
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - NOZESia Key</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  </style>
</head>
<body class="bg-slate-100 font-sans">
  <div id="app"></div>
  <script>
    const project = ${projectJSON};
    const lang = "${lang}";
    const t = {
      en: {
        features: "Features", selected: "selected", matches: "Matches", discarded: "Discarded",
        restart: "Restart", noMatches: "No matches found.", tryUnselecting: "Try unselecting some features.",
        potential: "potential matches", identified: "1 Entity identified", close: "Close",
        speciesDetails: "Species Details", morphology: "Morphology & Traits", resources: "Resources",
        createdWith: "Created with NOZESia", viewResults: "View Results", excluded: "Excluded by selection",
        scientificName: "Scientific Name", family: "Family", taxonomy: "Taxonomy"
      },
      pt: {
        features: "Características", selected: "selecionado(s)", matches: "Compatíveis", discarded: "Descartados",
        restart: "Reiniciar", noMatches: "Nenhum resultado.", tryUnselecting: "Tente remover seleções.",
        potential: "matches potenciais", identified: "1 Entidade identificada", close: "Fechar",
        speciesDetails: "Detalhes da Espécie", morphology: "Morfologia & Características", resources: "Recursos Adicionais",
        createdWith: "Criado com NOZESia", viewResults: "Ver Resultados", excluded: "Excluído pela seleção",
        scientificName: "Nome Científico", family: "Família", taxonomy: "Taxonomia"
      }
    };
    const strings = t[lang];
    
    let selections = {};
    let showDiscarded = false;
    let viewingEntity = null;
    let viewingStateImage = null; // {url, label, featureName}
    let mobileTab = 'FILTERS';
    
    function toggleSelection(featureId, stateId) {
      if (!selections[featureId]) selections[featureId] = [];
      const idx = selections[featureId].indexOf(stateId);
      if (idx >= 0) {
        selections[featureId].splice(idx, 1);
        if (selections[featureId].length === 0) delete selections[featureId];
      } else {
        selections[featureId].push(stateId);
      }
      render();
    }
    
    function resetKey() { selections = {}; render(); }
    function setMobileTab(tab) { mobileTab = tab; render(); }
    function toggleDiscarded() { showDiscarded = !showDiscarded; render(); }
    function viewEntity(entity) { viewingEntity = entity; render(); }
    function viewStateImage(url, label, featureName) { viewingStateImage = {url, label, featureName}; render(); }
    function closeStateImage() { viewingStateImage = null; render(); }
    function closeEntity() { viewingEntity = null; render(); }
    
    function getFilteredEntities() {
      const remaining = [], discarded = [];
      project.entities.forEach(entity => {
        let isMatch = true;
        for (const [fid, sids] of Object.entries(selections)) {
          const entityStates = entity.traits[fid] || [];
          if (!sids.some(id => entityStates.includes(id))) { isMatch = false; break; }
        }
        if (isMatch) remaining.push(entity); else discarded.push(entity);
      });
      return { remaining, discarded };
    }
    
    function getTotalSelections() {
      return Object.values(selections).reduce((a, c) => a + c.length, 0);
    }
    
    function render() {
      const { remaining, discarded } = getFilteredEntities();
      const totalSel = getTotalSelections();
      
      let entityModalHTML = '';
      if (viewingEntity) {
        const e = viewingEntity;
        const traitsHTML = project.features.map(f => {
          const stateIds = e.traits[f.id] || [];
          const stateLabels = stateIds.map(sid => f.states.find(s => s.id === sid)?.label).filter(Boolean).join(', ');
          return stateLabels ? \`<div class="flex justify-between py-2 border-b border-slate-100"><span class="text-slate-500">\${f.name}</span><span class="font-medium text-slate-800">\${stateLabels}</span></div>\` : '';
        }).join('');
        const linksHTML = e.links && e.links.length > 0 ? \`<div class="mt-6"><h4 class="font-semibold text-slate-700 mb-3">\${strings.resources}</h4><div class="space-y-2">\${e.links.map(l => \`<a href="\${l.url}" target="_blank" class="flex items-center gap-2 text-emerald-600 hover:underline text-sm"><span>🔗</span>\${l.label}</a>\`).join('')}</div></div>\` : '';
        const taxonomyHTML = (e.scientificName || e.family) ? \`
          <div class="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <h4 class="font-semibold text-emerald-800 mb-2 text-sm flex items-center gap-1">🧬 \${strings.taxonomy}</h4>
            \${e.scientificName ? \`<div class="flex justify-between py-1"><span class="text-emerald-600 text-sm">\${strings.scientificName}</span><span class="font-medium text-emerald-800 italic">\${e.scientificName}</span></div>\` : ''}
            \${e.family ? \`<div class="flex justify-between py-1"><span class="text-emerald-600 text-sm">\${strings.family}</span><span class="font-medium text-emerald-800">\${e.family}</span></div>\` : ''}
          </div>
        \` : '';
        entityModalHTML = \`
          <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeEntity()">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div class="relative h-48 sm:h-64 bg-slate-200 shrink-0">
                \${e.imageUrl ? \`<img src="\${e.imageUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">\` : '<div class="w-full h-full flex items-center justify-center text-slate-400 text-6xl">🌿</div>'}
                <button onclick="closeEntity()" class="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-2">✕</button>
              </div>
              <div class="p-6 overflow-y-auto custom-scrollbar">
                <h2 class="text-2xl font-bold text-slate-800 mb-1">\${e.name}</h2>
                \${e.scientificName && e.scientificName !== e.name ? \`<p class="text-slate-500 italic mb-2">\${e.scientificName}</p>\` : ''}
                \${e.family ? \`<span class="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full mb-3">\${e.family}</span>\` : ''}
                \${e.description ? \`<p class="text-slate-600 mb-4">\${e.description}</p>\` : ''}
                \${taxonomyHTML}
                <div class="mt-4"><h4 class="font-semibold text-slate-700 mb-2">\${strings.morphology}</h4><div class="text-sm">\${traitsHTML}</div></div>
                \${linksHTML}
              </div>
            </div>
          </div>
        \`;
      }
      
      // State Image Modal
      let stateImageModalHTML = '';
      if (viewingStateImage) {
        stateImageModalHTML = \`
          <div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onclick="if(event.target===this)closeStateImage()">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden" onclick="event.stopPropagation()">
              <div class="relative">
                <img src="\${viewingStateImage.url}" alt="\${viewingStateImage.label}" class="w-full max-h-[60vh] object-contain bg-slate-100">
                <button onclick="closeStateImage()" class="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors">✕</button>
              </div>
              <div class="p-4 bg-white">
                <h4 class="font-semibold text-slate-800">\${viewingStateImage.label}</h4>
                <p class="text-sm text-slate-500">\${viewingStateImage.featureName}</p>
              </div>
            </div>
          </div>
        \`;
      }
      
      // Filter features and states based on hideEmptyFeatures
      const featuresHTML = project.features
        .map(f => {
          // Get all state IDs that are present in remaining entities
          const usedStateIds = new Set();
          if (hideEmptyFeatures) {
            remaining.forEach(entity => {
              const entityStates = entity.traits[f.id] || [];
              entityStates.forEach(stateId => usedStateIds.add(stateId));
            });

            // If no states are used, skip this feature
            if (usedStateIds.size === 0) return '';
          }

          // Filter states to only show those that are used (when hideEmptyFeatures is true)
          const visibleStates = hideEmptyFeatures
            ? f.states.filter(s => usedStateIds.has(s.id))
            : f.states;

          const selStates = selections[f.id] || [];
          return \`
            <div class="bg-slate-50 rounded-xl p-4">
              <h4 class="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                \${f.imageUrl ? \`<img src="\${f.imageUrl}" class="w-6 h-6 rounded object-cover">\` : ''}
                \${f.name}
                \${selStates.length > 0 ? \`<span class="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">\${selStates.length}</span>\` : ''}
              </h4>
              <div class="flex flex-wrap gap-2">
                \${visibleStates.map(s => {
                  const isSel = selStates.includes(s.id);
                  const hasImg = s.imageUrl ? true : false;
                  return \`<div class="flex items-center gap-1">
                    \${hasImg ? \`<button onclick="viewStateImage('\${s.imageUrl}', '\${s.label.replace(/'/g, "\\\\'")}', '\${f.name.replace(/'/g, "\\\\'")}')" class="w-6 h-6 rounded overflow-hidden border border-slate-200 hover:border-emerald-400 transition-colors shrink-0" title="Ver imagem"><img src="\${s.imageUrl}" class="w-full h-full object-cover"></button>\` : ''}
                    <button onclick="toggleSelection('\${f.id}','\${s.id}')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all \${isSel ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">\${s.label}</button>
                  </div>\`;
                }).join('')}
              </div>
            </div>
          \`;
        })
        .filter(html => html !== '')
        .join('');
      
      const entityCard = (e, isDiscarded = false) => \`
        <div onclick="viewEntity(project.entities.find(x=>x.id==='\${e.id}'))" class="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden border \${isDiscarded ? 'border-red-200 opacity-60' : 'border-slate-200 hover:border-emerald-300'}">
          <div class="h-32 bg-slate-100 relative">
            \${e.imageUrl ? \`<img src="\${e.imageUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\\\'w-full h-full flex items-center justify-center text-slate-300 text-4xl\\\\'>🌿</div>'">\` : '<div class="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🌿</div>'}
            \${isDiscarded ? '<div class="absolute inset-0 bg-red-500/20 flex items-center justify-center"><span class="bg-red-500 text-white text-xs px-2 py-1 rounded">✕</span></div>' : ''}
            \${e.family ? \`<span class="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] px-1.5 py-0.5 rounded">\${e.family}</span>\` : ''}
          </div>
          <div class="p-3">
            <h4 class="font-semibold text-slate-800 text-sm truncate">\${e.name}</h4>
            \${e.scientificName && e.scientificName !== e.name ? \`<p class="text-xs text-slate-400 italic truncate">\${e.scientificName}</p>\` : ''}
            \${e.description ? \`<p class="text-xs text-slate-500 mt-1 line-clamp-2">\${e.description}</p>\` : ''}
          </div>
        </div>
      \`;
      
      const remainingHTML = remaining.length > 0 
        ? remaining.map(e => entityCard(e)).join('')
        : \`<div class="col-span-full text-center py-12 text-slate-500"><div class="text-4xl mb-3">🔍</div><p class="font-medium">\${strings.noMatches}</p><p class="text-sm">\${strings.tryUnselecting}</p></div>\`;
      
      const discardedHTML = discarded.length > 0 && showDiscarded
        ? \`<div class="mt-6 pt-6 border-t"><h4 class="font-semibold text-slate-500 mb-4 flex items-center gap-2">❌ \${strings.discarded} (\${discarded.length})</h4><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">\${discarded.map(e => entityCard(e, true)).join('')}</div></div>\`
        : '';
      
      document.getElementById('app').innerHTML = \`
        <div class="min-h-screen flex flex-col">
          <header class="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3">
              <span class="bg-emerald-600 text-white text-xs px-2 py-1 rounded font-bold">KEY</span>
              <h1 class="text-lg font-bold text-slate-800 truncate">\${project.name}</h1>
            </div>
            <button onclick="resetKey()" class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">🔄 \${strings.restart}</button>
          </header>
          
          <div class="md:hidden flex border-b bg-white">
            <button onclick="setMobileTab('FILTERS')" class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 \${mobileTab==='FILTERS'?'text-emerald-600 border-b-2 border-emerald-600':'text-slate-500 bg-slate-50'}">
              🔍 \${strings.features} \${totalSel>0?\`<span class="bg-emerald-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">\${totalSel}</span>\`:''}
            </button>
            <button onclick="setMobileTab('RESULTS')" class="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 \${mobileTab==='RESULTS'?'text-emerald-600 border-b-2 border-emerald-600':'text-slate-500 bg-slate-50'}">
              📋 \${strings.matches} <span class="bg-slate-200 text-slate-700 text-xs px-1.5 py-0.5 rounded-full">\${remaining.length}</span>
            </button>
          </div>
          
          <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div class="w-full md:w-1/3 lg:w-1/4 bg-white md:border-r flex-col h-full \${mobileTab==='FILTERS'?'flex':'hidden md:flex'}">
              <div class="hidden md:block p-4 border-b bg-slate-50">
                <h3 class="font-semibold text-slate-700 flex items-center gap-2">🔍 \${strings.features}</h3>
              </div>
              <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">\${featuresHTML}</div>
            </div>
            
            <div class="flex-1 flex flex-col h-full \${mobileTab==='RESULTS'?'flex':'hidden md:flex'}">
              <div class="p-4 border-b bg-slate-50 flex justify-between items-center">
                <div>
                  <span class="font-semibold text-slate-700">\${remaining.length === 1 ? strings.identified : remaining.length + ' ' + strings.potential}</span>
                </div>
                \${discarded.length > 0 ? \`<button onclick="toggleDiscarded()" class="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">\${showDiscarded?'🔼':'🔽'} \${strings.discarded} (\${discarded.length})</button>\` : ''}
              </div>
              <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">\${remainingHTML}</div>
                \${discardedHTML}
              </div>
            </div>
          </div>
          
          <footer class="bg-white border-t px-4 py-2 text-center text-xs text-slate-400">
            \${strings.createdWith} • <a href="https://djhandoom.github.io/nozes/" target="_blank" class="text-emerald-600 hover:underline">djhandoom.github.io/nozes</a>
          </footer>
        </div>
        \${entityModalHTML}
        \${stateImageModalHTML}
      \`;
    }
    
    render();
  <\/script>
</body>
</html>`;
};

interface BuilderProps {
  initialProject: Project | null;
  onSave: (project: Project) => void;
  onCancel: () => void;
  language: Language;
  defaultModel: string;
  apiKey: string;
  onOpenSettings?: (returnToAi?: boolean) => void;
  reopenAiModal?: boolean;
  onAiModalOpened?: () => void;
  onProjectImported?: (project: Project) => void;
}

type Tab = 'GENERAL' | 'FEATURES' | 'ENTITIES' | 'MATRIX';
type AiMode = 'TOPIC' | 'IMPORT' | 'REFINE' | 'MERGE';
type RefineAction = 'EXPAND' | 'REFINE' | 'CLEAN' | 'PHOTOS' | 'VALIDATE';

const t = {
  en: {
    builder: "Builder",
    aiWizard: "Nuts AI",
    savePlay: "Save & Play",
    exit: "Exit",
    save: "Save",
    open: "Open",
    export: "Export Project",
    exportXLSX: "Export XLSX",
    exportHTML: "Export HTML",
    import: "Import Project",
    general: "General",
    features: "Features",
    entities: "Entities",
    matrix: "Matrix Scoring",
    projectName: "Project Name",
    description: "Description",
    definedFeatures: "Defined Features",
    definedFeaturesDesc: "Define traits and their possible states.",
    addFeature: "Add Feature",
    featureName: "Feature Name",
    imageURL: "Image URL (optional)",
    states: "States",
    addState: "Add State",
    manageEntities: "Entities",
    manageEntitiesDesc: "Manage the taxa included in your key.",
    addEntity: "Add Entity",
    scoringMatrix: "Scoring Matrix",
    scoringMatrixDesc: "Click cells to toggle state association",
    taxaFeatures: "Taxa / Features",
    aiTitle: "Nuts AI Wizard",
    aiDesc: "Generate or Extract keys using Gemini AI.",
    topic: "Key Topic / Subject",
    topicPlace: "e.g. Rainforest Trees, Garden Weeds",
    geography: "Geographic Scope",
    taxonomyFamily: "Family",
    taxonomyGenus: "Genus",
    biome: "Biome",
    stateUF: "State/Region",
    scopeLabel: "Scope",
    scopeGlobal: "Global",
    scopeNational: "National (Brazil)",
    scopeRegional: "Regional",
    taxonomyFilters: "Taxonomic Filters",
    geographyFilters: "Geographic Filters",
    numEntities: "Approx. # of Entities",
    numFeatures: "Approx. # of Features",
    requiredFeatures: "Required Features",
    requiredFeaturesDesc: "Select features the AI must include",
    addCustomFeature: "Add custom feature...",
    selectedFeatures: "selected",
    requiredSpecies: "Required Species List",
    requiredSpeciesDesc: "Species that MUST be included (one per line)",
    requiredSpeciesPlaceholder: "Enter species names, one per line:\nInga edulis\nInga marginata\nInga vera",
    importSpeciesList: "Import species list",
    importSpeciesFormats: "Supports: .txt, .csv, .doc, .json",
    speciesCount: "species listed",
    clearList: "Clear list",
    generating: "Nozes IA is thinking... (15-45s)",
    cancel: "Cancel",
    generate: "Generate Key",
    savedMsg: "Project saved to browser storage!",
    errGen: "Failed to generate key. Check console.",
    featureFocus: "Feature Focus",
    focusGeneral: "General (All)",
    focusRepro: "Reproductive Only",
    focusVeg: "Vegetative Only",
    options: "Options",
    fetchSpeciesImg: "Fetch Species Images",
    fetchFeatureImg: "Fetch Feature Images",
    fetchLinks: "Fetch External Links",
    detailLevel: "Detail Level",
    detailSimple: "Simplified",
    detailBalanced: "Balanced",
    detailExpert: "Expert / High",
    detailOriginal: "Original Fidelity",
    noSaved: "No saved projects.",
    close: "Close",
    clearImage: "Clear Image",
    modeTopic: "Generate from Topic",
    modeImport: "Import from File",
    uploadLabel: "Upload PDF, Image, or Text",
    uploadDesc: "The AI will study the document and extract entities and features automatically.",
    supportedFormats: "Supports: .pdf, .txt, .jpg, .png",
    dropFile: "Drop file here",
    removeFile: "Remove file",
    analyzing: "Analyzing document...",
    promptCopied: "Prompt copied to clipboard!",
    configSettings: "Configuration",
    links: "Additional Links / Resources",
    addLink: "Add Link",
    editTraits: "Edit Characteristics",
    traitEditor: "Trait Editor",
    copyPrompt: "Copy",
    missingKey: "Missing API Key. Please configure it in the main menu Settings.",
    apiKeyWarning: "Configure your API Key to use AI features",
    clickGear: "Click the key icon above",
    modeRefine: "Expand/Refine",
    refineTitle: "Enhance Current Key",
    refineDesc: "Use AI to expand or refine your existing identification key.",
    actionExpand: "Expand Entities",
    actionExpandDesc: "Add new species/entities similar to existing ones",
    actionRefine: "Refine Features",
    actionRefineDesc: "Improve feature descriptions and add discriminating traits",
    actionClean: "Clean & Optimize",
    actionCleanDesc: "Remove redundant features, fix inconsistencies",
    expandCount: "# New Entities to Add",
    keepExisting: "Preserve existing entities",
    addFeatures: "Add new discriminating features",
    expandFilters: "Taxonomic & Geographic Filters",
    expandFamily: "Family (optional)",
    expandGenus: "Genus (optional)",
    expandBiome: "Biome (optional)",
    expandStateUF: "State/UF (optional)",
    expandScope: "Geographic Scope",
    expandRequiredSpecies: "Required Species to Add",
    expandRequiredSpeciesDesc: "Species that MUST be added (one per line)",
    expandRequiredSpeciesPlaceholder: "Enter species to add:\nInga edulis\nInga marginata",
    refineRequiredFeaturesTitle: "Required Features",
    refineRequiredFeaturesDesc: "Features that MUST be included in the key",
    addRequiredFeature: "Add feature...",
    customFeature: "Custom feature",
    improveDescriptions: "Improve descriptions",
    fillGaps: "Fill missing trait data",
    removeRedundant: "Remove redundant features",
    fixInconsistencies: "Fix inconsistencies",
    featureTypeLabel: "Feature Type",
    featureTypeVegetative: "Vegetative only",
    featureTypeReproductive: "Reproductive only",
    featureTypeBoth: "Both (vegetative + reproductive)",
    featureTypeDesc: "Focus on vegetative characters (leaves, stems, bark) or reproductive (flowers, fruits, seeds)",
    currentProject: "Current Project",
    noProjectLoaded: "No project loaded. Create or load a project first.",
    entitiesCount: "entities",
    featuresCount: "features",
    // Entity/Matrix Filters
    filterEntities: "Filter Entities",
    filterByFamily: "Filter by family",
    filterByGenus: "Filter by genus",
    filterByName: "Filter by name",
    searchPlaceholder: "Search...",
    allFamilies: "All families",
    allGenera: "All genera",
    clearFilters: "Clear filters",
    onlyWithGaps: "Only with gaps",
    onlyWithGapsDesc: "Show only entities with missing traits",
    showingEntities: "Showing",
    ofEntities: "of",
    completePhotos: "Complete Photo Collection",
    completePhotosDesc: "Fill missing images with valid URLs",
    photoTargetEntities: "Entity Images",
    photoTargetFeatures: "Feature Images",
    photoTargetBoth: "Both",
    actionPhotos: "Complete Photos",
    actionPhotosDesc: "Fill all missing images with real URLs",
    photosActionDesc: "Select which images to complete with valid URLs",
    actionValidate: "Validate Taxonomy",
    actionValidateDesc: "Check species names, synonyms, and geographic distribution",
    validateOptions: "Validation Options",
    validateFixNames: "Correct invalid/outdated names",
    validateFixNamesDesc: "Update names according to Flora do Brasil 2020 or other catalogs",
    validateMergeSynonyms: "Merge synonyms",
    validateMergeSynonymsDesc: "Combine synonymous species, preserving traits from both",
    validateCheckGeography: "Check geographic distribution",
    validateCheckGeographyDesc: "Remove species outside the defined geographic scope",
    validateCheckTaxonomy: "Check taxonomic scope",
    validateCheckTaxonomyDesc: "Remove species outside the defined family/genus",
    validateReference: "Reference Catalog",
    validateFloradobrasil: "Flora do Brasil 2020",
    validateGbif: "GBIF Backbone",
    validatePowo: "POWO (Kew)",
    validateCustom: "Custom/Other",
    photoModeReplace: "Replace All",
    photoModeReplaceDesc: "Clear existing and find new photos",
    photoModeExpand: "Only Fill Missing",
    photoModeExpandDesc: "Keep existing, fill empty only",
    photoCustomSources: "Custom Sources (optional)",
    photoCustomSourcesPlaceholder: "Paste URLs of image databases separated by newlines\ne.g., https://inaturalist.org\nhttps://floradobrasil.jbrj.gov.br",
    modeMerge: "Merge Keys",
    mergeTitle: "Combine Two Keys",
    mergeDesc: "Import two JSON keys and merge them into one optimized key.",
    mergeKey1: "First Key (JSON)",
    mergeKey2: "Second Key (JSON)",
    uploadKey1: "Upload Key 1 (JSON)",
    uploadKey2: "Upload Key 2 (JSON)",
    mergeStrategy: "Merge Strategy",
    strategyUnion: "Union (All-inclusive)",
    strategyUnionDesc: "Include all features and entities from both keys",
    strategyIntersection: "Intersection (Common)",
    strategyIntersectionDesc: "Focus on shared characteristics between keys",
    strategyPrimary: "Primary (Key 1 base)",
    strategyPrimaryDesc: "Use Key 1 as base, add unique elements from Key 2",
    remove: "Remove",
    mergeAction: "Merge Keys",
    mergeLoaded: "loaded",
    stateImage: "State image",
    addStateImage: "Add image",
    viewImage: "View image",
    closeImage: "Close"
  },
  pt: {
    builder: "Construtor",
    aiWizard: "Nozes IA",
    savePlay: "Salvar & Testar",
    exit: "Sair",
    save: "Salvar",
    open: "Abrir",
    export: "Exportar Projeto",
    exportXLSX: "Exportar XLSX",
    exportHTML: "Exportar HTML",
    import: "Importar Projeto",
    general: "Geral",
    features: "Características",
    entities: "Entidades",
    matrix: "Matriz",
    projectName: "Nome do Projeto",
    description: "Descrição",
    definedFeatures: "Características Definidas",
    definedFeaturesDesc: "Defina características e seus estados possíveis.",
    addFeature: "Adicionar Característica",
    featureName: "Nome",
    imageURL: "URL da Imagem (opcional)",
    states: "Estados",
    addState: "Adicionar Estado",
    manageEntities: "Entidades",
    manageEntitiesDesc: "Gerencie os táxons incluídos na chave.",
    addEntity: "Adicionar Entidade",
    scoringMatrix: "Matriz de Pontuação",
    scoringMatrixDesc: "Clique nas células para associar estados",
    taxaFeatures: "Táxons / Características",
    aiTitle: "Assistente Nozes IA",
    aiDesc: "Gere ou Extraia chaves usando Gemini IA.",
    topic: "Tópico / Assunto",
    topicPlace: "ex: Árvores da Amazônia, Ervas Daninhas",
    geography: "Escopo Geográfico",
    taxonomyFamily: "Família",
    taxonomyGenus: "Gênero",
    biome: "Bioma",
    stateUF: "Estado/UF",
    scopeLabel: "Escopo",
    scopeGlobal: "Global",
    scopeNational: "Nacional (Brasil)",
    scopeRegional: "Regional",
    taxonomyFilters: "Filtros Taxonômicos",
    geographyFilters: "Filtros Geográficos",
    numEntities: "Aprox. # de Entidades",
    numFeatures: "Aprox. # de Características",
    requiredFeatures: "Características Obrigatórias",
    requiredFeaturesDesc: "Selecione características que a IA deve incluir",
    addCustomFeature: "Adicionar característica...",
    selectedFeatures: "selecionadas",
    requiredSpecies: "Lista de Espécies Obrigatórias",
    requiredSpeciesDesc: "Espécies que DEVEM ser incluídas (uma por linha)",
    requiredSpeciesPlaceholder: "Digite nomes de espécies, uma por linha:\nInga edulis\nInga marginata\nInga vera",
    importSpeciesList: "Importar lista de espécies",
    importSpeciesFormats: "Suporta: .txt, .csv, .doc, .json",
    speciesCount: "espécies listadas",
    clearList: "Limpar lista",
    generating: "Nozes IA está pensando... (15-45s)",
    cancel: "Cancelar",
    generate: "Gerar Chave",
    savedMsg: "Projeto salvo no navegador!",
    errGen: "Falha ao gerar chave. Verifique o console.",
    featureFocus: "Foco das Características",
    focusGeneral: "Geral (Todas)",
    focusRepro: "Apenas Reprodutivas",
    focusVeg: "Apenas Vegetativas",
    options: "Opções",
    fetchSpeciesImg: "Buscar Imagens de Espécies",
    fetchFeatureImg: "Buscar Imagens de Características",
    fetchLinks: "Buscar Links/Materiais",
    detailLevel: "Nível de Detalhe",
    detailSimple: "Simplificado",
    detailBalanced: "Equilibrado",
    detailExpert: "Especialista / Alto",
    detailOriginal: "Fidelidade Original",
    noSaved: "Nenhum projeto salvo.",
    close: "Fechar",
    modeTopic: "Gerar por Tópico",
    modeImport: "Importar Arquivo",
    uploadLabel: "Upload PDF, Imagem ou Texto",
    uploadDesc: "A IA estudará o documento e extrairá entidades e características automaticamente.",
    supportedFormats: "Suporta: .pdf, .txt, .jpg, .png",
    dropFile: "Solte o arquivo aqui",
    removeFile: "Remover arquivo",
    analyzing: "Analisando documento...",
    promptCopied: "Prompt copiado para a área de transferência!",
    configSettings: "Configuração",
    links: "Links Adicionais / Materiais",
    addLink: "Adicionar Link",
    editTraits: "Editar Características",
    traitEditor: "Editor de Características",
    copyPrompt: "Copiar",
    missingKey: "Falta a Chave da API. Configure-a nas Configurações do menu principal.",
    apiKeyWarning: "Configure sua Chave de API para usar a IA",
    clickGear: "Clique na chave acima",
    modeRefine: "Expandir/Refinar",
    refineTitle: "Aprimorar Chave Atual",
    refineDesc: "Use IA para expandir ou refinar sua chave de identificação existente.",
    actionExpand: "Expandir Entidades",
    actionExpandDesc: "Adicionar novas espécies/entidades similares às existentes",
    actionRefine: "Refinar Características",
    actionRefineDesc: "Melhorar descrições e adicionar características discriminantes",
    actionClean: "Limpar & Otimizar",
    actionCleanDesc: "Remover características redundantes, corrigir inconsistências",
    expandCount: "# Novas Entidades a Adicionar",
    keepExisting: "Preservar entidades existentes",
    addFeatures: "Adicionar novas características discriminantes",
    expandFilters: "Filtros Taxonômicos & Geográficos",
    expandFamily: "Família (opcional)",
    expandGenus: "Gênero (opcional)",
    expandBiome: "Bioma (opcional)",
    expandStateUF: "Estado/UF (opcional)",
    expandScope: "Escopo Geográfico",
    expandRequiredSpecies: "Espécies Obrigatórias a Adicionar",
    expandRequiredSpeciesDesc: "Espécies que DEVEM ser adicionadas (uma por linha)",
    expandRequiredSpeciesPlaceholder: "Digite espécies a adicionar:\nInga edulis\nInga marginata",
    refineRequiredFeaturesTitle: "Características Obrigatórias",
    refineRequiredFeaturesDesc: "Características que DEVEM estar na chave",
    addRequiredFeature: "Adicionar característica...",
    customFeature: "Característica personalizada",
    improveDescriptions: "Melhorar descrições",
    fillGaps: "Preencher dados de características faltantes",
    removeRedundant: "Remover características redundantes",
    fixInconsistencies: "Corrigir inconsistências",
    featureTypeLabel: "Tipo de Característica",
    featureTypeVegetative: "Apenas vegetativas",
    featureTypeReproductive: "Apenas reprodutivas",
    featureTypeBoth: "Ambas (vegetativas + reprodutivas)",
    featureTypeDesc: "Foco em caracteres vegetativos (folhas, caules, cascas) ou reprodutivos (flores, frutos, sementes)",
    currentProject: "Projeto Atual",
    noProjectLoaded: "Nenhum projeto carregado. Crie ou carregue um projeto primeiro.",
    entitiesCount: "entidades",
    featuresCount: "características",
    // Entity/Matrix Filters
    filterEntities: "Filtrar Entidades",
    filterByFamily: "Filtrar por família",
    filterByGenus: "Filtrar por gênero",
    filterByName: "Filtrar por nome",
    searchPlaceholder: "Buscar...",
    allFamilies: "Todas as famílias",
    allGenera: "Todos os gêneros",
    clearFilters: "Limpar filtros",
    onlyWithGaps: "Apenas com lacunas",
    onlyWithGapsDesc: "Mostrar apenas entidades com características faltantes",
    showingEntities: "Exibindo",
    ofEntities: "de",
    completePhotos: "Completar Acervo Fotográfico",
    completePhotosDesc: "Preencher imagens faltantes com URLs válidas",
    photoTargetEntities: "Imagens de Entidades",
    photoTargetFeatures: "Imagens de Características",
    photoTargetBoth: "Ambos",
    actionPhotos: "Completar Fotos",
    actionPhotosDesc: "Preencher todas as imagens faltantes com URLs reais",
    photosActionDesc: "Selecione quais imagens completar com URLs válidas",
    actionValidate: "Validar Taxonomia",
    actionValidateDesc: "Verificar nomes de espécies, sinonímias e distribuição geográfica",
    validateOptions: "Opções de Validação",
    validateFixNames: "Corrigir nomes inválidos/desatualizados",
    validateFixNamesDesc: "Atualizar nomes conforme Flora do Brasil 2020 ou outros catálogos",
    validateMergeSynonyms: "Mesclar sinônimos",
    validateMergeSynonymsDesc: "Combinar espécies sinônimas, preservando características de ambas",
    validateCheckGeography: "Verificar distribuição geográfica",
    validateCheckGeographyDesc: "Remover espécies fora do escopo geográfico definido",
    validateCheckTaxonomy: "Verificar escopo taxonômico",
    validateCheckTaxonomyDesc: "Remover espécies fora da família/gênero definido",
    validateReference: "Catálogo de Referência",
    validateFloradobrasil: "Flora do Brasil 2020",
    validateGbif: "GBIF Backbone",
    validatePowo: "POWO (Kew)",
    validateCustom: "Personalizado/Outro",
    photoModeReplace: "Substituir Todas",
    photoModeReplaceDesc: "Limpar existentes e buscar novas",
    photoModeExpand: "Apenas Preencher Faltantes",
    photoModeExpandDesc: "Manter existentes, preencher vazias",
    photoCustomSources: "Fontes Personalizadas (opcional)",
    photoCustomSourcesPlaceholder: "Cole URLs de bancos de imagens separados por quebras de linha\nex: https://inaturalist.org\nhttps://floradobrasil.jbrj.gov.br",
    modeMerge: "Combinar",
    mergeTitle: "Combinar Duas Chaves",
    mergeDesc: "Importe dois JSONs e combine-os em uma chave otimizada.",
    mergeKey1: "Primeira Chave (JSON)",
    mergeKey2: "Segunda Chave (JSON)",
    uploadKey1: "Carregar Chave 1 (JSON)",
    uploadKey2: "Carregar Chave 2 (JSON)",
    mergeStrategy: "Estratégia de Combinação",
    strategyUnion: "União (Tudo incluído)",
    strategyUnionDesc: "Incluir todas as características e entidades de ambas as chaves",
    strategyIntersection: "Interseção (Comum)",
    strategyIntersectionDesc: "Focar nas características compartilhadas entre as chaves",
    strategyPrimary: "Primária (Base Chave 1)",
    strategyPrimaryDesc: "Usar Chave 1 como base, adicionar elementos únicos da Chave 2",
    remove: "Remover",
    mergeAction: "Combinar Chaves",
    mergeLoaded: "carregado",
    stateImage: "Imagem do estado",
    addStateImage: "Adicionar imagem",
    viewImage: "Ver imagem",
    closeImage: "Fechar",
    clearImage: "Limpar Imagem"
  }
};

/**
 * Normalize name for matching: lowercase, trim, remove accents/diacritics, collapse spaces
 */
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' '); // Collapse multiple spaces
};

/**
 * Check if two names are similar enough to be considered the same entity
 * Uses substring matching for cases where AI shortens/expands names
 */
const namesMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // One contains the other (for cases like "Eugenia uniflora" vs "Eugenia uniflora L.")
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // First significant word matches (for species names)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  if (words1.length > 0 && words2.length > 0 && words1[0] === words2[0]) {
    // If first word matches and at least 2 words match, consider it a match
    const matchingWords = words1.filter(w => words2.includes(w));
    if (matchingWords.length >= 2 || (matchingWords.length === 1 && Math.min(words1.length, words2.length) === 1)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Merge generated project with existing project data to preserve:
 * - Existing imageUrl (if not placeholder)
 * - Existing links
 * - Existing description (if new one is empty/placeholder)
 * - Existing scientificName and family
 * This prevents AI from overwriting valuable user data with mockups/placeholders
 */
const mergeProjectsPreservingData = (newProject: Project, existingProject: Project, preserveAllExisting: boolean = true): Project => {
  console.log(`[mergeProjectsPreservingData] Starting merge: new=${newProject.entities.length} entities, existing=${existingProject.entities.length} entities`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // CRITICAL SAFETY CHECKS: Detect AI failures that could cause data loss
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Check 1: Empty or near-empty AI response - ONLY reject if truly empty
  if (!newProject.entities || newProject.entities.length === 0) {
    console.error(`[mergeProjectsPreservingData] CRITICAL: AI returned EMPTY project! Preserving original.`);
    return existingProject;
  }
  
  // Check 2: Partial response - AI returned fewer entities
  // Instead of rejecting, we'll merge what we got and keep the rest
  const isPartialResponse = newProject.entities.length < existingProject.entities.length;
  if (isPartialResponse) {
    console.warn(`[mergeProjectsPreservingData] PARTIAL RESPONSE: AI returned ${newProject.entities.length} of ${existingProject.entities.length} entities. Will merge available data and preserve remaining entities.`);
  }
  
  // Check 3: AI returned entities but NO features (corrupt response)
  if (!newProject.features || newProject.features.length === 0) {
    console.error(`[mergeProjectsPreservingData] CRITICAL: AI returned NO features! Preserving original.`);
    return existingProject;
  }
  
  // Log trait counts for debugging (no longer used to reject)
  const countTotalTraits = (proj: Project): number => {
    return proj.entities.reduce((sum, e) => {
      return sum + Object.values(e.traits).reduce((tSum, states) => tSum + states.length, 0);
    }, 0);
  };
  
  const existingTotalTraits = countTotalTraits(existingProject);
  const newTotalTraits = countTotalTraits(newProject);
  console.log(`[mergeProjectsPreservingData] Trait count - existing: ${existingTotalTraits}, new: ${newTotalTraits}`);
  
  // ═══════════════════════════════════════════════════════════════════════════════

  // Create lookup maps for existing data
  const existingEntitiesById = new Map(existingProject.entities.map(e => [e.id, e]));
  const existingFeaturesById = new Map(existingProject.features.map(f => [f.id, f]));

  // Track which existing entities were matched
  const matchedExistingIds = new Set<string>();

  // Helper to check if URL is a placeholder/mockup
  const isPlaceholderUrl = (url: string | undefined): boolean => {
    if (!url) return true;
    const placeholderPatterns = [
      'picsum.photos',
      'placehold.co',
      'placeholder.com',
      'via.placeholder',
      'dummyimage.com',
      'fakeimg.pl',
      'lorempixel.com'
    ];
    return placeholderPatterns.some(p => url.includes(p));
  };

  // Find matching existing entity using flexible matching
  const findMatchingEntity = (newEntity: Entity): Entity | undefined => {
    // Try by ID first
    if (existingEntitiesById.has(newEntity.id)) {
      return existingEntitiesById.get(newEntity.id);
    }
    // Try by name with flexible matching
    for (const existingEntity of existingProject.entities) {
      if (namesMatch(newEntity.name, existingEntity.name)) {
        return existingEntity;
      }
    }
    return undefined;
  };

  // Find matching existing feature using flexible matching
  const findMatchingFeature = (newFeature: Feature): Feature | undefined => {
    // Try by ID first
    if (existingFeaturesById.has(newFeature.id)) {
      return existingFeaturesById.get(newFeature.id);
    }
    // Try by name with flexible matching
    for (const existingFeature of existingProject.features) {
      if (namesMatch(newFeature.name, existingFeature.name)) {
        return existingFeature;
      }
    }
    return undefined;
  };

  // Build a map of new feature IDs to their names for trait mapping
  const newFeatureIdToName = new Map<string, string>();
  newProject.features.forEach(f => {
    newFeatureIdToName.set(f.id, f.name);
  });

  // Counters for summary logging (instead of per-item logs)
  let mappingStats = { featureMatches: 0, stateMatches: 0, stateMisses: 0, traitsFilled: 0, traitsSkipped: 0 };

  // Map feature ID from new project to existing project ID
  const mapFeatureId = (newFeatureId: string): string | null => {
    // First check if it's already a valid existing ID
    if (existingFeaturesById.has(newFeatureId)) {
      return newFeatureId;
    }
    
    // Try to find matching feature by ID in new project and map to existing by name
    const newFeature = newProject.features.find(f => f.id === newFeatureId);
    if (newFeature) {
      const existingFeature = findMatchingFeature(newFeature);
      if (existingFeature) {
        mappingStats.featureMatches++;
        return existingFeature.id;
      }
    }
    
    // If we have the feature name from our map, try to find existing feature by name
    const featureName = newFeatureIdToName.get(newFeatureId);
    if (featureName) {
      for (const existingFeature of existingProject.features) {
        if (namesMatch(featureName, existingFeature.name)) {
          mappingStats.featureMatches++;
          return existingFeature.id;
        }
      }
    }
    
    return null;
  };

  // Map state ID from new project to existing project ID (optimized - no per-item logs)
  const mapStateId = (newStateId: string, existingFeatureId: string, newFeatureId: string): string | null => {
    const existingFeature = existingFeaturesById.get(existingFeatureId);
    if (!existingFeature) return null;
    
    // First check if state ID already exists in existing feature (direct match)
    const directMatch = existingFeature.states.find(s => s.id === newStateId);
    if (directMatch) {
      mappingStats.stateMatches++;
      return newStateId;
    }
    
    // Try to find state label from new project
    let newStateLabel: string | null = null;
    
    // Method 1: Find in the specified new feature
    const newFeature = newProject.features.find(f => f.id === newFeatureId);
    if (newFeature) {
      const newState = newFeature.states.find(s => s.id === newStateId);
      if (newState) {
        newStateLabel = newState.label;
      }
    }
    
    // Method 2: If not found, search in all new features
    if (!newStateLabel) {
      for (const nf of newProject.features) {
        const foundState = nf.states.find(s => s.id === newStateId);
        if (foundState) {
          newStateLabel = foundState.label;
          break;
        }
      }
    }
    
    // Method 3: Try to find by ID pattern - some IDs might have the label encoded
    if (!newStateLabel && newStateId.includes('_')) {
      const potentialLabel = newStateId.split('_').slice(0, -1).join('_').replace(/-/g, ' ');
      if (potentialLabel.length > 2) {
        newStateLabel = potentialLabel;
      }
    }
    
    if (newStateLabel) {
      // Find matching state by normalized label in existing feature
      const normalizedNewLabel = normalizeName(newStateLabel);
      const matchingState = existingFeature.states.find(s => 
        normalizeName(s.label) === normalizedNewLabel
      );
      if (matchingState) {
        mappingStats.stateMatches++;
        return matchingState.id;
      }
      
      // Try partial match (label contains or is contained)
      const partialMatch = existingFeature.states.find(s => {
        const existingNorm = normalizeName(s.label);
        return existingNorm.includes(normalizedNewLabel) || normalizedNewLabel.includes(existingNorm);
      });
      if (partialMatch) {
        mappingStats.stateMatches++;
        return partialMatch.id;
      }
    }
    
    // Method 4: Try matching by index position (if state order is preserved)
    if (newFeature) {
      const newStateIndex = newFeature.states.findIndex(s => s.id === newStateId);
      if (newStateIndex >= 0 && newStateIndex < existingFeature.states.length) {
        mappingStats.stateMatches++;
        return existingFeature.states[newStateIndex].id;
      }
    }
    
    // Method 5: If the state ID looks like a number (0, 1, 2...) use it as index
    const stateIdAsNumber = parseInt(newStateId, 10);
    if (!isNaN(stateIdAsNumber) && stateIdAsNumber >= 0 && stateIdAsNumber < existingFeature.states.length) {
      mappingStats.stateMatches++;
      return existingFeature.states[stateIdAsNumber].id;
    }
    
    mappingStats.stateMisses++;
    return null;
  };

  // Helper to get valid state IDs for a feature
  const getValidStateIdsForFeature = (featureId: string): Set<string> => {
    const feature = existingFeaturesById.get(featureId);
    if (!feature) return new Set();
    return new Set(feature.states.map(s => s.id));
  };

  // Clean invalid trait IDs from existing traits
  const cleanExistingTraits = (traits: Record<string, string[]>): Record<string, string[]> => {
    const cleaned: Record<string, string[]> = {};
    for (const [featureId, stateIds] of Object.entries(traits)) {
      // Only keep if featureId exists in existing project
      if (existingFeaturesById.has(featureId)) {
        const validStateIds = getValidStateIdsForFeature(featureId);
        const validTraits = stateIds.filter(sid => validStateIds.has(sid));
        if (validTraits.length > 0) {
          cleaned[featureId] = validTraits;
        }
      }
    }
    return cleaned;
  };

  // Merge traits from new entity to existing entity, mapping IDs correctly (optimized - no per-item logs)
  const mergeTraits = (newTraits: Record<string, string[]>, existingTraits: Record<string, string[]>): Record<string, string[]> => {
    // IMPORTANT: First clean existing traits to remove invalid IDs from previous failed merges
    const cleanedExistingTraits = cleanExistingTraits(existingTraits);
    const result = { ...cleanedExistingTraits };
    
    // Build a set of new feature IDs for quick lookup
    const newFeatureIds = new Set(newProject.features.map(f => f.id));
    
    for (const [newFeatureId, newStateIds] of Object.entries(newTraits)) {
      const existingFeatureId = mapFeatureId(newFeatureId);
      
      if (existingFeatureId) {
        // Feature exists in both - map state IDs
        const mappedStateIds: string[] = [];
        for (const newStateId of newStateIds) {
          const mappedStateId = mapStateId(newStateId, existingFeatureId, newFeatureId);
          if (mappedStateId) {
            mappedStateIds.push(mappedStateId);
          }
        }
        
        if (mappedStateIds.length > 0) {
          // Only update if existing doesn't have VALID data for this feature (filling gaps)
          if (!result[existingFeatureId] || result[existingFeatureId].length === 0) {
            result[existingFeatureId] = mappedStateIds;
            mappingStats.traitsFilled++;
          } else {
            mappingStats.traitsSkipped++;
          }
        }
      } else if (newFeatureIds.has(newFeatureId)) {
        // NEW FEATURE: This feature doesn't exist in existing project but is a valid new feature
        // Keep the trait data as-is since the IDs are from the new feature
        if (newStateIds.length > 0) {
          result[newFeatureId] = [...newStateIds];
          mappingStats.traitsFilled++;
        }
      }
      // If feature doesn't exist in either, skip it (orphaned data)
    }
    
    return result;
  };

  // Merge entities from new project with existing data
  const mergedEntities = newProject.entities.map(newEntity => {
    const existingEntity = findMatchingEntity(newEntity);

    if (existingEntity) {
      // Mark as matched
      matchedExistingIds.add(existingEntity.id);
    }

    if (!existingEntity) {
      // New entity, keep as is
      return newEntity;
    }

    // Merge: preserve existing data if new data is placeholder/empty
    return {
      ...newEntity,
      // ALWAYS preserve existing ID to maintain consistency
      id: existingEntity.id,
      // Preserve imageUrl if existing has a real image and new has placeholder
      imageUrl: (!isPlaceholderUrl(existingEntity.imageUrl) && isPlaceholderUrl(newEntity.imageUrl))
        ? existingEntity.imageUrl
        : (newEntity.imageUrl || existingEntity.imageUrl),
      // Preserve links if existing has them and new doesn't
      links: (newEntity.links && newEntity.links.length > 0) 
        ? newEntity.links 
        : existingEntity.links,
      // Preserve description if new is empty/generic
      description: (newEntity.description && newEntity.description.length > 20)
        ? newEntity.description
        : (existingEntity.description || newEntity.description),
      // Preserve taxonomic data
      scientificName: newEntity.scientificName || existingEntity.scientificName,
      family: newEntity.family || existingEntity.family,
      // IMPORTANT: Merge traits with proper ID mapping to fill gaps
      traits: mergeTraits(newEntity.traits, existingEntity.traits),
    };
  });

  // CRITICAL: Add back existing entities that were NOT included in new project
  // This prevents data loss when AI truncates or omits entities
  if (preserveAllExisting) {
    const missingEntities = existingProject.entities.filter(e => !matchedExistingIds.has(e.id));
    
    if (missingEntities.length > 0) {
      console.warn(`[mergeProjectsPreservingData] ═══════════════════════════════════════════════════════════`);
      console.warn(`[mergeProjectsPreservingData] PARTIAL MERGE SUMMARY:`);
      console.warn(`[mergeProjectsPreservingData]   ✓ Updated: ${matchedExistingIds.size} entities with new AI data`);
      console.warn(`[mergeProjectsPreservingData]   ⟳ Preserved: ${missingEntities.length} entities (not in AI response)`);
      console.warn(`[mergeProjectsPreservingData]   Total: ${matchedExistingIds.size + missingEntities.length} entities`);
      console.warn(`[mergeProjectsPreservingData] ═══════════════════════════════════════════════════════════`);
      console.log(`[mergeProjectsPreservingData] Preserved entities (user can re-run for these):`);
      missingEntities.slice(0, 10).forEach(e => console.log(`  - "${e.name}"`));
      if (missingEntities.length > 10) {
        console.log(`  ... and ${missingEntities.length - 10} more`);
      }
      mergedEntities.push(...missingEntities);
    }
  }

  // Track matched features
  const matchedFeatureIds = new Set<string>();
  const newFeaturesList: string[] = [];

  // Merge features (similar logic)
  const mergedFeatures = newProject.features.map(newFeature => {
    const existingFeature = findMatchingFeature(newFeature);

    if (existingFeature) {
      matchedFeatureIds.add(existingFeature.id);
    }

    if (!existingFeature) {
      // This is a NEW feature from AI - keep it with its IDs
      newFeaturesList.push(newFeature.name);
      return newFeature;
    }

    // CRITICAL: Use existing feature's ID and states to maintain consistency with mapped traits
    // The traits were mapped using existingFeature.states IDs, so we MUST use those same states
    return {
      ...existingFeature, // Start with existing feature to preserve all IDs
      // Update name if new has a better one
      name: newFeature.name || existingFeature.name,
      // Preserve feature imageUrl if existing has real image
      imageUrl: (!isPlaceholderUrl(existingFeature.imageUrl) && isPlaceholderUrl(newFeature.imageUrl))
        ? existingFeature.imageUrl
        : (newFeature.imageUrl || existingFeature.imageUrl),
      // ALWAYS use existing states to maintain ID consistency with mapped traits
      states: existingFeature.states,
    };
  });

  // Log new features added by AI
  if (newFeaturesList.length > 0) {
    console.log(`[mergeProjectsPreservingData] ✨ AI added ${newFeaturesList.length} NEW features:`);
    newFeaturesList.forEach(name => console.log(`  + "${name}"`));
  }

  // Add back missing features (for REFINE/CLEAN actions where features might be accidentally removed)
  if (preserveAllExisting) {
    const missingFeatures = existingProject.features.filter(f => !matchedFeatureIds.has(f.id));
    
    if (missingFeatures.length > 0) {
      console.warn(`[mergeProjectsPreservingData] AI omitted ${missingFeatures.length} features. Re-adding them to prevent data loss:`);
      missingFeatures.forEach(f => console.warn(`  - "${f.name}" (ID: ${f.id})`));
      mergedFeatures.push(...missingFeatures);
    }
  }

  console.log(`[mergeProjectsPreservingData] Final result: ${mergedEntities.length} entities, ${mergedFeatures.length} features (${newFeaturesList.length} new, ${matchedFeatureIds.size} updated, ${mergedFeatures.length - newFeaturesList.length - matchedFeatureIds.size} preserved)`);

  // Build a map of valid state IDs for each feature in the FINAL merged features
  const finalFeaturesMap = new Map<string, Set<string>>();
  mergedFeatures.forEach(f => {
    finalFeaturesMap.set(f.id, new Set(f.states.map(s => s.id)));
  });

  // FINAL SANITIZATION: Ensure all trait IDs in entities are valid for final features (optimized - batch processing)
  let sanitizeStats = { entitiesProcessed: 0, invalidTraitsRemoved: 0, entitiesWithIssues: 0 };
  
  const sanitizedEntities = mergedEntities.map(entity => {
    const sanitizedTraits: Record<string, string[]> = {};
    let entityHadIssues = false;
    
    for (const [featureId, stateIds] of Object.entries(entity.traits)) {
      const validStateIds = finalFeaturesMap.get(featureId);
      if (validStateIds) {
        const validTraits = stateIds.filter(sid => validStateIds.has(sid));
        if (validTraits.length > 0) {
          sanitizedTraits[featureId] = validTraits;
        }
        if (validTraits.length !== stateIds.length) {
          entityHadIssues = true;
          sanitizeStats.invalidTraitsRemoved += (stateIds.length - validTraits.length);
        }
      } else {
        entityHadIssues = true;
        sanitizeStats.invalidTraitsRemoved += stateIds.length;
      }
    }
    
    sanitizeStats.entitiesProcessed++;
    if (entityHadIssues) sanitizeStats.entitiesWithIssues++;
    
    return { ...entity, traits: sanitizedTraits };
  });

  // Single summary log instead of per-entity logs
  console.log(`[mergeProjectsPreservingData] ═══════════════════════════════════════════════════════════`);
  console.log(`[mergeProjectsPreservingData] MERGE COMPLETE SUMMARY:`);
  console.log(`[mergeProjectsPreservingData]   • Entities: ${sanitizedEntities.length} total (${matchedExistingIds.size} matched, ${sanitizedEntities.length - matchedExistingIds.size} preserved/new)`);
  console.log(`[mergeProjectsPreservingData]   • Features: ${mergedFeatures.length} total`);
  console.log(`[mergeProjectsPreservingData]   • Mapping: ${mappingStats.featureMatches} features, ${mappingStats.stateMatches} states matched, ${mappingStats.stateMisses} state misses`);
  console.log(`[mergeProjectsPreservingData]   • Traits: ${mappingStats.traitsFilled} gaps filled, ${mappingStats.traitsSkipped} skipped (already had data)`);
  if (sanitizeStats.invalidTraitsRemoved > 0) {
    console.warn(`[mergeProjectsPreservingData]   • Sanitization: ${sanitizeStats.invalidTraitsRemoved} invalid trait IDs removed from ${sanitizeStats.entitiesWithIssues} entities`);
  }
  console.log(`[mergeProjectsPreservingData] ═══════════════════════════════════════════════════════════`);

  // DEDUPLICATION: Ensure no duplicate entity IDs (can happen with merge edge cases)
  const seenEntityIds = new Set<string>();
  const deduplicatedEntities = sanitizedEntities.filter(entity => {
    if (seenEntityIds.has(entity.id)) {
      console.warn(`[mergeProjectsPreservingData] Removing duplicate entity ID: ${entity.id} (${entity.name})`);
      return false;
    }
    seenEntityIds.add(entity.id);
    return true;
  });

  // DEDUPLICATION: Ensure no duplicate feature IDs
  const seenFeatureIds = new Set<string>();
  const deduplicatedFeatures = mergedFeatures.filter(feature => {
    if (seenFeatureIds.has(feature.id)) {
      console.warn(`[mergeProjectsPreservingData] Removing duplicate feature ID: ${feature.id} (${feature.name})`);
      return false;
    }
    seenFeatureIds.add(feature.id);
    return true;
  });

  if (deduplicatedEntities.length !== sanitizedEntities.length || deduplicatedFeatures.length !== mergedFeatures.length) {
    console.warn(`[mergeProjectsPreservingData] Deduplication removed ${sanitizedEntities.length - deduplicatedEntities.length} entity and ${mergedFeatures.length - deduplicatedFeatures.length} feature duplicates`);
  }

  return {
    ...newProject,
    // Preserve original project ID and metadata if they match
    id: existingProject.id || newProject.id,
    entities: deduplicatedEntities,
    features: deduplicatedFeatures
  };
};

export const Builder: React.FC<BuilderProps> = ({ initialProject, onSave, onCancel, language, defaultModel, apiKey, onOpenSettings, reopenAiModal, onAiModalOpened, onProjectImported }) => {
  const strings = t[language];
  
  // Helper to ensure unique IDs in project (prevents React key warnings)
  const ensureUniqueIds = (proj: Project): Project => {
    const seenEntityIds = new Set<string>();
    const seenFeatureIds = new Set<string>();
    
    const uniqueEntities = proj.entities.filter(e => {
      if (seenEntityIds.has(e.id)) return false;
      seenEntityIds.add(e.id);
      return true;
    });
    
    const uniqueFeatures = proj.features.filter(f => {
      if (seenFeatureIds.has(f.id)) return false;
      seenFeatureIds.add(f.id);
      return true;
    });
    
    if (uniqueEntities.length !== proj.entities.length || uniqueFeatures.length !== proj.features.length) {
      return { ...proj, entities: uniqueEntities, features: uniqueFeatures };
    }
    return proj;
  };
  
  // State
  const [project, setProjectRaw] = useState<Project>(ensureUniqueIds(initialProject || {
    id: Math.random().toString(36).substr(2, 9),
    name: language === 'pt' ? "Nova Chave" : "New Key",
    description: "",
    features: [],
    entities: []
  }));
  
  // Wrapper for setProject that ensures unique IDs
  const setProject = (newProject: Project | ((prev: Project) => Project)) => {
    setProjectRaw(prev => {
      const updated = typeof newProject === 'function' ? newProject(prev) : newProject;
      return ensureUniqueIds(updated);
    });
  };
  
  const [activeTab, setActiveTab] = useState<Tab>('GENERAL');

  // AI Generation State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    topic: "",
    category: 'FLORA',
    count: 10,
    featureCount: 5,
    geography: "",
    taxonomy: "",
    taxonomyFamily: "",
    taxonomyGenus: "",
    biome: "",
    stateUF: "",
    scope: "national",
    language: language,
    featureFocus: 'general',
    includeSpeciesImages: true,
    includeFeatureImages: true,
    includeLinks: true, // Default to true as per request or set false if preference
    model: defaultModel,
    detailLevel: 2
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string>(''); // Progress message during generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStep, setAiStep] = useState<'CATEGORY' | 'WIZARD'>('CATEGORY');
  const [aiMode, setAiMode] = useState<AiMode>('TOPIC');
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Mobile Header Menu
  const [pendingImportProject, setPendingImportProject] = useState<Project | null>(null); // For confirming optimized imports
  const [pendingNervuraFile, setPendingNervuraFile] = useState<Project | null>(null); // For staging Nervura JSON before import
  
  // State Image Modal
  const [expandedStateImage, setExpandedStateImage] = useState<{url: string, label: string, featureName: string} | null>(null);

  // Refine Mode State
  const [refineAction, setRefineAction] = useState<RefineAction>('EXPAND');
  const [currentRefineMode, setCurrentRefineMode] = useState<'fillGaps' | 'refine' | 'expand' | 'clean' | null>(null);
  const [refineOptions, setRefineOptions] = useState({
    expandCount: 10,
    keepExisting: true,
    addFeatures: true,
    // Expand filters
    expandFamily: '',
    expandGenus: '',
    expandBiome: '',
    expandStateUF: '',
    expandScope: 'national' as 'global' | 'national' | 'regional',
    expandRequiredSpecies: '' as string, // Species that MUST be added
    // Refine required features
    refineRequiredFeatures: [] as string[],
    featureType: 'both' as 'vegetative' | 'reproductive' | 'both', // Feature type filter
    improveDescriptions: true,
    fillGaps: true,
    removeRedundant: false,
    fixInconsistencies: true,
    refineFeatureCount: 3,
    completePhotos: false,
    photoTarget: 'both' as 'entities' | 'features' | 'both',
    photoMode: 'expand' as 'replace' | 'expand',
    photoCustomSources: '',
    // Validate options
    validateFixNames: true,
    validateMergeSynonyms: true,
    validateCheckGeography: true,
    validateCheckTaxonomy: true,
    validateReference: 'floradobrasil' as 'floradobrasil' | 'gbif' | 'powo' | 'custom',
    validateFamily: '',
    validateGenus: '',
    validateBiome: '',
    validateStateUF: '',
    validateScope: 'national' as 'global' | 'national' | 'regional'
  });

  // Merge Mode State
  const [mergeKey1, setMergeKey1] = useState<Project | null>(null);

  // Spreadsheet import states
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<{ format: KeyFormat; confidence: number; description: string } | null>(null);
  const [pendingSpreadsheetData, setPendingSpreadsheetData] = useState<{ data: any[][]; fileName: string } | null>(null);
  const [isConvertingWithAI, setIsConvertingWithAI] = useState(false);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [showMultiFileModal, setShowMultiFileModal] = useState(false);
  const [mergeKey2, setMergeKey2] = useState<Project | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<'union' | 'intersection' | 'primary'>('union');

  // Entity/Matrix Filter State
  const [entityFilter, setEntityFilter] = useState({
    searchText: '',
    family: '',
    genus: '',
    scientificName: '',
    onlyWithGaps: false
  });

  // Required Features State (for AI generation)
  const [requiredFeatures, setRequiredFeatures] = useState<string[]>([]);
  const [showRequiredFeaturesDropdown, setShowRequiredFeaturesDropdown] = useState(false);
  const [customFeatureInput, setCustomFeatureInput] = useState('');
  
  // Required Species State (for TOPIC mode)
  const [requiredSpeciesText, setRequiredSpeciesText] = useState('');
  const speciesListInputRef = React.useRef<HTMLInputElement>(null);
  
  // Suggested features for dropdown (bilingual) - Dynamic based on Category
  const suggestedFeatures = (() => {
    if (aiConfig.category === 'FAUNA') {
      return language === 'pt' ? [
        { category: 'Morfológicas', items: ['Forma do corpo', 'Coloração', 'Tamanho', 'Tipo de pele/tegumento', 'Número de patas', 'Presença de cauda', 'Tipo de bico/boca', 'Dimorfismo sexual'] },
        { category: 'Comportamentais', items: ['Dieta/Alimentação', 'Hábito (diurno/noturno)', 'Comportamento social', 'Modo de locomoção', 'Vocalização', 'Reprodução'] },
        { category: 'Habitat', items: ['Tipo de ambiente', 'Estrato', 'Distribuição geográfica'] }
      ] : [
        { category: 'Morphological', items: ['Body shape', 'Coloration', 'Size', 'Skin type', 'Number of legs', 'Tail presence', 'Beak/mouth type', 'Sexual dimorphism'] },
        { category: 'Behavioral', items: ['Diet', 'Activity pattern', 'Social behavior', 'Locomotion', 'Vocalization', 'Reproduction'] },
        { category: 'Habitat', items: ['Environment type', 'Stratum', 'Geographic distribution'] }
      ];
    } else if (aiConfig.category === 'OTHER') {
      return language === 'pt' ? [
        { category: 'Visuais/Físicas', items: ['Cor predominante', 'Formato', 'Material', 'Tamanho', 'Estilo visual', 'Textura'] },
        { category: 'Conceituais', items: ['Gênero/Categoria', 'Tema', 'Época/Ano', 'Origem', 'Autor/Criador', 'Público-alvo'] },
        { category: 'Outros', items: ['Popularidade', 'Prêmios', 'Duração/Extensão'] }
      ] : [
        { category: 'Visual/Physical', items: ['Dominant color', 'Shape', 'Material', 'Size', 'Visual style', 'Texture'] },
        { category: 'Conceptual', items: ['Genre/Category', 'Theme', 'Era/Year', 'Origin', 'Author/Creator', 'Target audience'] },
        { category: 'Other', items: ['Popularity', 'Awards', 'Duration/Length'] }
      ];
    } else {
      // FLORA (Default)
      return language === 'pt' ? [
        // Vegetative features
        { category: 'Vegetativas', items: [
          'Tipo de folha (simples/composta)',
          'Filotaxia (alterna/oposta/verticilada)',
          'Margem foliar',
          'Forma da folha',
          'Textura da folha',
          'Presença de estípulas',
          'Tipo de nervação',
          'Forma do caule',
          'Tipo de casca',
          'Hábito de crescimento',
          'Presença de espinhos/acúleos',
          'Presença de látex',
          'Tipo de raiz',
          'Presença de tricomas/pelos',
          'Domácias',
        ]},
        // Reproductive features
        { category: 'Reprodutivas', items: [
          'Tipo de inflorescência',
          'Cor da flor',
          'Número de pétalas',
          'Simetria floral',
          'Tipo de fruto',
          'Cor do fruto',
          'Tipo de semente',
          'Deiscência do fruto',
        ]},
        // Ecological/Other
        { category: 'Ecológicas', items: [
          'Ambiente/habitat',
          'Altitude',
          'Fenologia',
          'Polinizadores',
          'Dispersão',
        ]}
      ] : [
        // Vegetative features (English)
        { category: 'Vegetative', items: [
          'Leaf type (simple/compound)',
          'Phyllotaxy (alternate/opposite/whorled)',
          'Leaf margin',
          'Leaf shape',
          'Leaf texture',
          'Stipule presence',
          'Venation type',
          'Stem shape',
          'Bark type',
          'Growth habit',
          'Spine/prickle presence',
          'Latex presence',
          'Root type',
          'Trichome/hair presence',
          'Domatia',
        ]},
        // Reproductive features (English)
        { category: 'Reproductive', items: [
          'Inflorescence type',
          'Flower color',
          'Petal number',
          'Floral symmetry',
          'Fruit type',
          'Fruit color',
          'Seed type',
          'Fruit dehiscence',
        ]},
        // Ecological/Other (English)
        { category: 'Ecological', items: [
          'Habitat/environment',
          'Altitude',
          'Phenology',
          'Pollinators',
          'Dispersal',
        ]}
      ];
    }
  })();

  // Prompt Editor State
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("");
  const [aiTypingText, setAiTypingText] = useState(""); // Simulated AI typing response
  const [aiTypingComplete, setAiTypingComplete] = useState(false); // Whether typing animation is complete
  const typingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const typingContainerRef = React.useRef<HTMLDivElement | null>(null); // Ref for auto-scroll

  // Entity Trait Editor State
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  // State for inline editing of state image URL
  const [editingStateImageUrl, setEditingStateImageUrl] = useState<{ featureId: string, stateId: string } | null>(null);

  // Matrix Feature Expansion State
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(
    project.features.length > 0 ? project.features[0].id : null
  );
  const matrixScrollRef = React.useRef<HTMLDivElement>(null);
  const [isMatrixScrolled, setIsMatrixScrolled] = useState(false);

  const toggleFeatureExpansion = (featureId: string) => {
    const isExpanding = expandedFeatureId !== featureId;
    setExpandedFeatureId(prev => prev === featureId ? null : featureId);

    // Auto-scroll to center the expanded feature
    if (isExpanding && matrixScrollRef.current) {
      setTimeout(() => {
        const container = matrixScrollRef.current;
        if (!container) return;
        
        // Calculate position of the feature column
        const featureIndex = project.features.findIndex(f => f.id === featureId);
        if (featureIndex === -1) return;
        
        // Calculate offset: entity column width (200px) + collapsed columns before this feature
        let scrollTarget = 200; // Entity column width
        for (let i = 0; i < featureIndex; i++) {
          scrollTarget += 70; // Collapsed column width
        }
        
        // Center the expanded section in the viewport
        const containerWidth = container.clientWidth;
        const expandedWidth = project.features[featureIndex].states.length * 90;
        const centeredScroll = scrollTarget - (containerWidth / 2) + (expandedWidth / 2);
        
        container.scrollTo({
          left: Math.max(0, centeredScroll),
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  const navigateFeature = (direction: 'prev' | 'next') => {
    const currentIndex = project.features.findIndex(f => f.id === expandedFeatureId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'prev'
      ? (currentIndex - 1 + project.features.length) % project.features.length
      : (currentIndex + 1) % project.features.length;

    toggleFeatureExpansion(project.features[newIndex].id);
  };

  // Update AI config language when prop changes
  useEffect(() => {
    setAiConfig(prev => ({ ...prev, language }));
  }, [language]);

  // Compute unique families and genera from entities
  const uniqueFamilies = React.useMemo(() => {
    const families = new Set<string>();
    project.entities.forEach(e => {
      if (e.family && e.family.trim()) {
        families.add(e.family.trim());
      }
    });
    return Array.from(families).sort();
  }, [project.entities]);

  const uniqueGenera = React.useMemo(() => {
    const genera = new Set<string>();
    project.entities.forEach(e => {
      // Extract genus from scientificName or name (first word)
      const name = e.scientificName || e.name || '';
      const genus = name.split(' ')[0];
      if (genus && genus.trim() && /^[A-Z][a-z]+$/.test(genus)) {
        genera.add(genus.trim());
      }
    });
    return Array.from(genera).sort();
  }, [project.entities]);

  // Filter entities based on current filter settings
  const filteredEntities = React.useMemo(() => {
    return project.entities.filter(entity => {
      // Filter by search text (name or scientificName)
      if (entityFilter.searchText) {
        const searchLower = entityFilter.searchText.toLowerCase();
        const nameMatch = entity.name?.toLowerCase().includes(searchLower);
        const sciNameMatch = entity.scientificName?.toLowerCase().includes(searchLower);
        if (!nameMatch && !sciNameMatch) return false;
      }
      
      // Filter by family
      if (entityFilter.family) {
        if (entity.family?.toLowerCase() !== entityFilter.family.toLowerCase()) return false;
      }
      
      // Filter by genus (first word of scientificName or name)
      if (entityFilter.genus) {
        const name = entity.scientificName || entity.name || '';
        const genus = name.split(' ')[0];
        if (genus?.toLowerCase() !== entityFilter.genus.toLowerCase()) return false;
      }
      
      // Filter by gaps (entities with missing traits)
      if (entityFilter.onlyWithGaps) {
        const hasGaps = project.features.some(feature => {
          const traitIds = entity.traits[feature.id] || [];
          return traitIds.length === 0;
        });
        if (!hasGaps) return false;
      }
      
      return true;
    });
  }, [project.entities, project.features, entityFilter]);

  // Clear all filters
  const clearEntityFilters = () => {
    setEntityFilter({
      searchText: '',
      family: '',
      genus: '',
      scientificName: '',
      onlyWithGaps: false
    });
  };

  // Check if any filter is active
  const hasActiveFilters = entityFilter.searchText || entityFilter.family || entityFilter.genus || entityFilter.onlyWithGaps;

  // Reopen AI modal when returning from settings
  useEffect(() => {
    if (reopenAiModal) {
      setShowAiModal(true);
      onAiModalOpened?.();
    }
  }, [reopenAiModal, onAiModalOpened]);

  // Update model if defaultModel prop changes
  useEffect(() => {
    setAiConfig(prev => ({ ...prev, model: defaultModel }));
  }, [defaultModel]);

  // Monitor scroll position for sticky header visual effect
  useEffect(() => {
    const scrollContainer = matrixScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsMatrixScrolled(scrollContainer.scrollTop > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('nozesia_projects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) { console.error("Failed to load local projects"); }
    }
  }, []);

  // Auto-scroll typing container when new text is added
  useEffect(() => {
    if (typingContainerRef.current && aiTypingText) {
      typingContainerRef.current.scrollTop = typingContainerRef.current.scrollHeight;
    }
  }, [aiTypingText]);

  // Handlers
  const updateProject = (updates: Partial<Project>) => setProject(p => ({ ...p, ...updates }));

  // Helper to check if URL is a placeholder/mockup - for cleaning data
  const isPlaceholderImageUrl = (url: string | undefined): boolean => {
    if (!url) return true;
    const placeholderPatterns = [
      'picsum.photos',
      'placehold.co',
      'placeholder.com',
      'via.placeholder',
      'dummyimage.com',
      'fakeimg.pl',
      'lorempixel.com',
      'placekitten.com',
      'loremflickr.com'
    ];
    return placeholderPatterns.some(p => url.toLowerCase().includes(p));
  };

  // Clean project data by removing all placeholder/mockup URLs
  const cleanProjectForExport = (proj: Project): Project => {
    return {
      ...proj,
      entities: proj.entities.map(e => ({
        ...e,
        imageUrl: isPlaceholderImageUrl(e.imageUrl) ? '' : e.imageUrl
      })),
      features: proj.features.map(f => ({
        ...f,
        imageUrl: isPlaceholderImageUrl(f.imageUrl) ? '' : f.imageUrl
      }))
    };
  };

  const saveToLocal = () => {
    const cleanedProject = cleanProjectForExport(project);
    const updatedList = [cleanedProject, ...savedProjects.filter(p => p.id !== project.id)];
    setSavedProjects(updatedList);
    localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));
    alert(strings.savedMsg);
  };

  const loadFromLocal = (p: Project) => {
    setProject(p);
    setShowLoadModal(false);
  };

  const exportJSON = () => {
    // Clean project data before export - remove all placeholder URLs
    const cleanedProject = cleanProjectForExport(project);
    // Export with pretty formatting (2-space indent) for readability
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanedProject, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${project.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportXLSX = () => {
    // Clean project data before export - remove all placeholder URLs
    const cleanedProject = cleanProjectForExport(project);
    const workbook = utils.book_new();

    // 1. Entities Sheet
    const entityRows = cleanedProject.entities.map(e => ({
      ID: e.id,
      Name: e.name,
      Description: e.description,
      ImageURL: e.imageUrl,
      LinkLabels: e.links?.map(l => l.label).join("; ") || "",
      LinkURLs: e.links?.map(l => l.url).join("; ") || ""
    }));
    const wsEntities = utils.json_to_sheet(entityRows);
    utils.book_append_sheet(workbook, wsEntities, "Entities");

    // 2. Features Sheet
    const featureRows = cleanedProject.features.map(f => ({
      ID: f.id,
      Name: f.name,
      ImageURL: isPlaceholderImageUrl(f.imageUrl) ? '' : f.imageUrl,
      States: f.states.map(s => s.label).join("; ")
    }));
    const wsFeatures = utils.json_to_sheet(featureRows);
    utils.book_append_sheet(workbook, wsFeatures, "Features");

    // 3. Matrix Sheet
    const matrixRows = cleanedProject.entities.map(entity => {
      const row: any = { Entity: entity.name };
      cleanedProject.features.forEach(feature => {
        const traitIds = entity.traits[feature.id] || [];
        const traitLabels = feature.states
          .filter(s => traitIds.includes(s.id))
          .map(s => s.label)
          .join(", ");
        row[feature.name] = traitLabels;
      });
      return row;
    });
    const wsMatrix = utils.json_to_sheet(matrixRows);
    utils.book_append_sheet(workbook, wsMatrix, "Matrix");

    // 4. Project Info Sheet
    const projectRows = [{
      Name: cleanedProject.name,
      Description: cleanedProject.description,
      ExportDate: new Date().toISOString().split('T')[0],
      TotalEntities: cleanedProject.entities.length,
      TotalFeatures: cleanedProject.features.length
    }];
    const wsProject = utils.json_to_sheet(projectRows);
    utils.book_append_sheet(workbook, wsProject, "Project Info");

    // Save file
    writeFile(workbook, `${cleanedProject.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Export as standalone HTML
  const exportHTML = () => {
    // Clean project data before export - remove all placeholder URLs
    const cleanedProject = cleanProjectForExport(project);
    const htmlContent = generateStandaloneHTML(cleanedProject, language);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanedProject.name.replace(/\s+/g, '_')}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [optimizeNervura, setOptimizeNervura] = useState(false);

  // Update the message when optimize mode changes and there's a pending Nervura file
  useEffect(() => {
    if (pendingNervuraFile && !isGenerating && !pendingImportProject) {
      const numStates = pendingNervuraFile.features?.reduce((sum: number, f: Feature) => sum + (f.states?.length || 0), 0) || 0;
      
      const fileInfo = language === 'pt' 
        ? `📁 Projeto: "${pendingNervuraFile.name}"\n📊 ${pendingNervuraFile.entities?.length || 0} entidades • ${pendingNervuraFile.features?.length || 0} características • ${numStates} estados\n\n${optimizeNervura ? '🔧 Modo: Otimizar com IA\n\n⬇️ Clique no botão amarelo abaixo para iniciar a importação.' : '📥 Modo: Importação Fiel\n\n⬇️ Clique no botão amarelo abaixo para confirmar a importação.'}`
        : `📁 Project: "${pendingNervuraFile.name}"\n📊 ${pendingNervuraFile.entities?.length || 0} entities • ${pendingNervuraFile.features?.length || 0} features • ${numStates} states\n\n${optimizeNervura ? '🔧 Mode: Optimize with AI\n\n⬇️ Click the yellow button below to start import.' : '📥 Mode: Faithful Import\n\n⬇️ Click the yellow button below to confirm import.'}`;
      
      setAiTypingText(fileInfo);
    }
  }, [optimizeNervura, pendingNervuraFile, isGenerating, pendingImportProject, language]);

  // Generate curiosities from existing user projects
  const generateCuriositiesFromProjects = (): string[] => {
    const saved = localStorage.getItem('nozesia_projects');
    if (!saved) return [];
    
    try {
      const projects: Project[] = JSON.parse(saved);
      if (projects.length === 0) return [];
      
      const curiosities: string[] = [];
      
      // Collect statistics from all projects
      const totalEntities = projects.reduce((sum, p) => sum + (p.entities?.length || 0), 0);
      const totalFeatures = projects.reduce((sum, p) => sum + (p.features?.length || 0), 0);
      
      // Get unique entity names from all projects
      const allEntities = projects.flatMap(p => p.entities?.map(e => e.name) || []);
      const uniqueEntityNames = [...new Set(allEntities)];
      
      // Get unique feature names from all projects
      const allFeatures = projects.flatMap(p => p.features?.map(f => f.name) || []);
      const uniqueFeatureNames = [...new Set(allFeatures)];
      
      // Generate curiosities based on the data
      if (language === 'pt') {
        if (projects.length > 0) {
          curiosities.push(`📚 Você possui ${projects.length} chave${projects.length > 1 ? 's' : ''} salva${projects.length > 1 ? 's' : ''} no banco de dados`);
        }
        if (totalEntities > 0) {
          curiosities.push(`🌿 Ao todo, suas chaves contêm ${totalEntities} entidades catalogadas`);
        }
        if (totalFeatures > 0) {
          curiosities.push(`🔬 ${totalFeatures} características morfológicas registradas em seu acervo`);
        }
        
        // Pick random entities to highlight
        if (uniqueEntityNames.length > 0) {
          const randomEntities = uniqueEntityNames.sort(() => Math.random() - 0.5).slice(0, 3);
          curiosities.push(`🌱 Algumas espécies em suas chaves: ${randomEntities.join(', ')}`);
        }
        
        // Pick random features to highlight
        if (uniqueFeatureNames.length > 0) {
          const randomFeatures = uniqueFeatureNames.sort(() => Math.random() - 0.5).slice(0, 3);
          curiosities.push(`🔍 Características utilizadas: ${randomFeatures.join(', ')}`);
        }
        
        // Most recent project
        if (projects.length > 0) {
          const recentProject = projects[0];
          curiosities.push(`📖 Sua chave mais recente: "${recentProject.name}"`);
        }
        
        // Project with most entities
        if (projects.length > 1) {
          const largestProject = projects.reduce((max, p) => 
            (p.entities?.length || 0) > (max.entities?.length || 0) ? p : max
          , projects[0]);
          if (largestProject.entities?.length > 0) {
            curiosities.push(`🏆 Maior chave: "${largestProject.name}" com ${largestProject.entities.length} entidades`);
          }
        }
      } else {
        if (projects.length > 0) {
          curiosities.push(`📚 You have ${projects.length} key${projects.length > 1 ? 's' : ''} saved in your database`);
        }
        if (totalEntities > 0) {
          curiosities.push(`🌿 In total, your keys contain ${totalEntities} catalogued entities`);
        }
        if (totalFeatures > 0) {
          curiosities.push(`🔬 ${totalFeatures} morphological features recorded in your collection`);
        }
        
        if (uniqueEntityNames.length > 0) {
          const randomEntities = uniqueEntityNames.sort(() => Math.random() - 0.5).slice(0, 3);
          curiosities.push(`🌱 Some species in your keys: ${randomEntities.join(', ')}`);
        }
        
        if (uniqueFeatureNames.length > 0) {
          const randomFeatures = uniqueFeatureNames.sort(() => Math.random() - 0.5).slice(0, 3);
          curiosities.push(`🔍 Features used: ${randomFeatures.join(', ')}`);
        }
        
        if (projects.length > 0) {
          const recentProject = projects[0];
          curiosities.push(`📖 Your most recent key: "${recentProject.name}"`);
        }
        
        if (projects.length > 1) {
          const largestProject = projects.reduce((max, p) => 
            (p.entities?.length || 0) > (max.entities?.length || 0) ? p : max
          , projects[0]);
          if (largestProject.entities?.length > 0) {
            curiosities.push(`🏆 Largest key: "${largestProject.name}" with ${largestProject.entities.length} entities`);
          }
        }
      }
      
      return curiosities;
    } catch (err) {
      console.error("Error generating curiosities:", err);
      return [];
    }
  };

  // Format Nervura project with standardized name and description
  const formatNervuraProject = (parsed: Project): Project => {
    const numSpecies = parsed.entities?.length || 0;
    const numFeatures = parsed.features?.length || 0;
    
    // Count total states across all features
    const numStates = parsed.features?.reduce((sum, f) => sum + (f.states?.length || 0), 0) || 0;
    
    // Detect language from content
    const isPortuguese = parsed.description?.includes('Chave de identificação') || 
                         parsed.features?.some(f => f.name === 'Forma de Vida' || f.name === 'Filotaxia') ||
                         language === 'pt';
    const langCode = isPortuguese ? 'PTBR' : 'EN';
    
    // Generate version number (v1 for new imports)
    const version = 'v1';
    
    // Standardized name: "NervuraColetora PTBR v1 (14sp / 49crc)"
    const standardName = `NervuraColetora ${langCode} ${version} (${numSpecies}sp / ${numFeatures}crc)`;
    
    // Extract metadata from original description if available
    let collector = isPortuguese ? 'Coletor não especificado' : 'Collector not specified';
    let collectionDates = '';
    let exportDate = '';
    let collectionStates = '';
    let families: string[] = [];
    let genera: string[] = [];
    let lifeFormsText = '';
    
    if (parsed.description) {
      // Extract collector
      const collectorMatch = parsed.description.match(/pelo coletor[:\s]+([^\n.]+)/i) ||
                             parsed.description.match(/by collector[:\s]+([^\n.]+)/i);
      if (collectorMatch) {
        collector = collectorMatch[1].trim();
      }
      
      // Extract dates
      const dateMatch = parsed.description.match(/Data de coleta[:\s]+([^\n]+)/i) ||
                        parsed.description.match(/Collection date[:\s]+([^\n]+)/i);
      if (dateMatch) {
        collectionDates = dateMatch[1].trim();
      }
      
      const exportMatch = parsed.description.match(/Data de exportação[:\s]+([^\n]+)/i) ||
                          parsed.description.match(/Export date[:\s]+([^\n]+)/i);
      if (exportMatch) {
        exportDate = exportMatch[1].trim();
      }
      
      // Extract states
      const statesMatch = parsed.description.match(/Estados de coleta[:\s]+([^\n]+)/i) ||
                          parsed.description.match(/Collection states[:\s]+([^\n]+)/i);
      if (statesMatch) {
        collectionStates = statesMatch[1].trim();
      }
      
      // Extract families
      const familiesMatch = parsed.description.match(/FAMÍLIAS[:\s]*\n([^\n]+)/i) ||
                            parsed.description.match(/FAMILIES[:\s]*\n([^\n]+)/i);
      if (familiesMatch) {
        families = familiesMatch[1].split(',').map(f => f.trim()).filter(f => f);
      }
      
      // Extract genera
      const generaMatch = parsed.description.match(/GÊNEROS[:\s]*\n([^\n]+)/i) ||
                          parsed.description.match(/GENERA[:\s]*\n([^\n]+)/i);
      if (generaMatch) {
        genera = generaMatch[1].split(',').map(g => g.trim()).filter(g => g);
      }
      
      // Extract life forms
      const lifeFormsMatch = parsed.description.match(/FORMAS DE VIDA[:\s]*\n([^\n]+)/i) ||
                             parsed.description.match(/LIFE FORMS[:\s]*\n([^\n]+)/i);
      if (lifeFormsMatch) {
        lifeFormsText = lifeFormsMatch[1].trim();
      }
    }
    
    // If no data extracted from description, try to infer from entities
    if (families.length === 0 && parsed.entities) {
      const extractedFamilies = new Set<string>();
      const extractedGenera = new Set<string>();
      
      parsed.entities.forEach(entity => {
        // Try to extract family from description
        const famMatch = entity.description?.match(/Família[:\s]+([A-Za-z]+)/i);
        if (famMatch) extractedFamilies.add(famMatch[1]);
        
        // Extract genus from species name (first word)
        const genusMatch = entity.name?.match(/^([A-Z][a-z]+)/);
        if (genusMatch) extractedGenera.add(genusMatch[1]);
      });
      
      families = Array.from(extractedFamilies);
      genera = Array.from(extractedGenera);
    }
    
    // Build standardized description
    let newDescription = '';
    
    if (isPortuguese) {
      newDescription = `🌿 Chave de identificação produzida com dados coletados no NervuraColetora pelo coletor: ${collector}.\n\n`;
      
      if (collectionDates) {
        newDescription += `📅 Data de coleta: ${collectionDates}\n`;
      }
      if (exportDate) {
        newDescription += `📅 Data de exportação: ${exportDate}\n`;
      } else {
        newDescription += `📅 Data de importação: ${new Date().toLocaleDateString('pt-BR')}\n`;
      }
      
      newDescription += `\n📊 ESTATÍSTICAS:\n`;
      newDescription += `• Número de espécies/entidades: ${numSpecies}\n`;
      newDescription += `• Número de características morfológicas: ${numFeatures}\n`;
      newDescription += `• Número total de estados: ${numStates}\n`;
      
      if (families.length > 0) {
        newDescription += `• Número de famílias: ${families.length}\n`;
      }
      if (genera.length > 0) {
        newDescription += `• Número de gêneros: ${genera.length}\n`;
      }
      if (collectionStates) {
        newDescription += `• Estados de coleta: ${collectionStates}\n`;
      }
      
      if (lifeFormsText) {
        newDescription += `\n🌳 FORMAS DE VIDA:\n${lifeFormsText}\n`;
      }
      
      if (families.length > 0) {
        newDescription += `\n👨‍👩‍👧‍👦 FAMÍLIAS:\n${families.join(', ')}\n`;
      }
      
      if (genera.length > 0) {
        newDescription += `\n🧬 GÊNEROS:\n${genera.join(', ')}`;
      }
    } else {
      newDescription = `🌿 Identification key produced with data collected in NervuraColetora by collector: ${collector}.\n\n`;
      
      if (collectionDates) {
        newDescription += `📅 Collection date: ${collectionDates}\n`;
      }
      if (exportDate) {
        newDescription += `📅 Export date: ${exportDate}\n`;
      } else {
        newDescription += `📅 Import date: ${new Date().toLocaleDateString('en-US')}\n`;
      }
      
      newDescription += `\n📊 STATISTICS:\n`;
      newDescription += `• Number of species/entities: ${numSpecies}\n`;
      newDescription += `• Number of morphological features: ${numFeatures}\n`;
      newDescription += `• Total number of states: ${numStates}\n`;
      
      if (families.length > 0) {
        newDescription += `• Number of families: ${families.length}\n`;
      }
      if (genera.length > 0) {
        newDescription += `• Number of genera: ${genera.length}\n`;
      }
      if (collectionStates) {
        newDescription += `• Collection states: ${collectionStates}\n`;
      }
      
      if (lifeFormsText) {
        newDescription += `\n🌳 LIFE FORMS:\n${lifeFormsText}\n`;
      }
      
      if (families.length > 0) {
        newDescription += `\n👨‍👩‍👧‍👦 FAMILIES:\n${families.join(', ')}\n`;
      }
      
      if (genera.length > 0) {
        newDescription += `\n🧬 GENERA:\n${genera.join(', ')}`;
      }
    }
    
    return {
      ...parsed,
      name: standardName,
      description: newDescription
    };
  };

  // Handle Nervura file selection - stages the file, doesn't run immediately
  const handleNervuraImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.name && parsed.features && parsed.entities) {
            // Format the project with standardized name and description
            const formattedProject = formatNervuraProject(parsed);
            
            // Stage the formatted file for confirmation - don't run immediately
            setPendingNervuraFile(formattedProject);
            
            // Show the prompt editor with info about the staged file
            setShowPromptEditor(true);
            setAiTypingText(""); 
            setAiTypingComplete(false);
            
            const numStates = parsed.features?.reduce((sum: number, f: Feature) => sum + (f.states?.length || 0), 0) || 0;
            
            const fileInfo = language === 'pt' 
              ? `📁 Arquivo carregado: "${parsed.name}"\n\n🏷️ Nome padronizado: "${formattedProject.name}"\n📊 ${parsed.entities.length} entidades • ${parsed.features.length} características • ${numStates} estados\n\n${optimizeNervura ? '🔧 Modo: Otimizar com IA\n\n⬇️ Clique no botão amarelo abaixo para iniciar a importação.' : '📥 Modo: Importação Fiel\n\n⬇️ Clique no botão amarelo abaixo para confirmar a importação.'}`
              : `📁 File loaded: "${parsed.name}"\n\n🏷️ Standardized name: "${formattedProject.name}"\n📊 ${parsed.entities.length} entities • ${parsed.features.length} features • ${numStates} states\n\n${optimizeNervura ? '🔧 Mode: Optimize with AI\n\n⬇️ Click the yellow button below to start import.' : '📥 Mode: Faithful Import\n\n⬇️ Click the yellow button below to confirm import.'}`;
            
            setAiTypingText(fileInfo);
            setAiTypingComplete(true);
            
          } else {
            alert("Formato inválido. Certifique-se que é um JSON do Nervura/Nozes.");
          }
        } catch (error) {
          alert("Erro ao ler o arquivo JSON.");
        }
      };
    }
  };

  // Execute the actual Nervura import (called when user confirms)
  const executeNervuraImport = async () => {
    if (!pendingNervuraFile) return;
    
    const parsed = pendingNervuraFile;
    
    // Get curiosities from existing projects
    const curiosities = generateCuriositiesFromProjects();
    
    if (optimizeNervura) {
      // Show the typing view for optimization
      setIsGenerating(true);
      setAiTypingText(""); // Reset typing text
      setAiTypingComplete(false);
      
      // Simulate typing effect for the "thinking" phase
      const thinkingText = language === 'pt' 
        ? "🔄 Analisando estrutura da chave...\n🔍 Identificando redundâncias...\n✨ Otimizando características e estados...\n" 
        : "🔄 Analyzing key structure...\n🔍 Identifying redundancies...\n✨ Optimizing features and states...\n";
      
      // Add curiosities section
      const curiositiesText = curiosities.length > 0 
        ? (language === 'pt' ? "\n📖 Curiosidades do seu acervo:\n" : "\n📖 Curiosities from your collection:\n") + 
          curiosities.map(c => `   ${c}`).join('\n') + "\n"
        : "";
      
      const fullThinkingText = thinkingText + curiositiesText;
      
      let charIndex = 0;
      const typingInterval = setInterval(() => {
        if (charIndex < fullThinkingText.length) {
          setAiTypingText(prev => prev + fullThinkingText.charAt(charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 30);

      try {
        // Explicit language instruction
        const prompt = language === 'pt' 
          ? "Limpe e otimize esta chave importada. MANTENHA TODO O CONTEÚDO EM PORTUGUÊS. Padronize nomes de características e estados. Remova redundâncias."
          : "Clean and optimize this imported key. KEEP ALL CONTENT IN ENGLISH. Standardize feature and state names. Remove redundancies.";

        const optimizedProject = await refineExistingProject(
          prompt,
          parsed,
          apiKey,
          defaultModel,
          language,
          'clean'
        );
        
        // Store for confirmation instead of setting immediately
        setPendingImportProject(optimizedProject);
        setPendingNervuraFile(null); // Clear the staged file
        
        // Add completion message to typing text
        const completionText = language === 'pt'
          ? `\n\n✅ Otimização concluída!\n📊 ${optimizedProject.entities.length} entidades • ${optimizedProject.features.length} características\n\n⬇️ Clique no botão amarelo para confirmar a importação.`
          : `\n\n✅ Optimization complete!\n📊 ${optimizedProject.entities.length} entities • ${optimizedProject.features.length} features\n\n⬇️ Click the yellow button to confirm import.`;
        
        setAiTypingText(prev => prev + completionText);
        setAiTypingComplete(true);
        
      } catch (err) {
        console.error(err);
        const errorText = language === 'pt'
          ? `\n\n❌ Erro na otimização: ${(err as Error).message}\n\n💡 Você pode tentar novamente ou importar sem otimização.`
          : `\n\n❌ Optimization error: ${(err as Error).message}\n\n💡 You can try again or import without optimization.`;
        setAiTypingText(prev => prev + errorText);
        setAiTypingComplete(true);
      } finally {
        clearInterval(typingInterval);
        setIsGenerating(false);
        // Do NOT close modal here - wait for user confirmation
      }
    } else {
      // Faithful import - no AI processing, but show confirmation
      setAiTypingText(prev => prev + (language === 'pt' 
        ? "\n\n🔄 Processando importação...\n" 
        : "\n\n🔄 Processing import...\n"));
      
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Store for confirmation
      setPendingImportProject(parsed);
      setPendingNervuraFile(null);
      
      const successText = language === 'pt'
        ? `\n✅ Arquivo processado!\n\n⬇️ Clique no botão amarelo para confirmar a importação.`
        : `\n✅ File processed!\n\n⬇️ Click the yellow button to confirm import.`;
      
      setAiTypingText(prev => prev + successText);
      setAiTypingComplete(true);
    }
  };

  // Detect spreadsheet format type
  type KeyFormat = 'matrix' | 'dichotomous_sequential' | 'indented' | 'synoptic' | 'linked_hub' | 'unknown';

  const detectSpreadsheetFormat = (data: any[][]): { format: KeyFormat; confidence: number; description: string } => {
    if (!data || data.length < 2) {
      return { format: 'unknown', confidence: 0, description: 'Empty or invalid data' };
    }

    const headers = data[0].map((h: any) => h?.toString().toLowerCase().trim() || '');
    const firstDataRow = data[1]?.map((cell: any) => cell?.toString() || '');

    // 1. Check for LINKED/HUB KEY (references to other keys)
    // Format: Contains references like "Chave A", "Chave B", "Key A", etc.
    const allCellsText = data.map(row => row.join(' ')).join(' ').toLowerCase();
    const keyReferencePatterns = [
      /chave\s+[a-h]/gi, // "Chave A", "Chave B"
      /key\s+[a-h]/gi,   // "Key A", "Key B"
      /\bchave\s+\d+/gi, // "Chave 1", "Chave 2"
    ];

    let keyReferences = 0;
    keyReferencePatterns.forEach(pattern => {
      const matches = allCellsText.match(pattern);
      if (matches) keyReferences += matches.length;
    });

    // Check if this appears to be a hub/general key that links to multiple sub-keys
    if (keyReferences >= 3) {
      return {
        format: 'linked_hub',
        confidence: 0.95,
        description: language === 'pt'
          ? 'Chave Hub com Referências (sistema de chaves interligadas)'
          : 'Hub Key with References (linked key system)'
      };
    }

    // 2. Check for DICHOTOMOUS SEQUENTIAL KEY
    // Format: Passo | Diagnose | Identificação/Próximo Passo
    const dichotomousPatterns = ['passo', 'diagnose', 'identificação', 'próximo', 'step', 'diagnosis', 'result', 'next', 'couplet'];
    const dichotomousMatch = headers.filter((h: string) =>
      dichotomousPatterns.some(pattern => h.includes(pattern))
    ).length;

    if (dichotomousMatch >= 2) {
      return {
        format: 'dichotomous_sequential',
        confidence: 0.9,
        description: language === 'pt'
          ? 'Chave Dicotômica Sequencial (passos numerados com diagnoses)'
          : 'Sequential Dichotomous Key (numbered steps with diagnoses)'
      };
    }

    // 2. Check for INDENTED/BRACKETED KEY
    // Format: Text with indentation levels or brackets
    const hasIndentation = data.some(row =>
      row[0]?.toString().startsWith('  ') || row[0]?.toString().startsWith('\t')
    );
    const hasBrackets = data.some(row =>
      row[0]?.toString().match(/^\d+\s*\(/) || row[0]?.toString().match(/^[a-z]\)/)
    );

    if (hasIndentation || hasBrackets) {
      return {
        format: 'indented',
        confidence: 0.8,
        description: language === 'pt'
          ? 'Chave Indentada (estrutura hierárquica)'
          : 'Indented Key (hierarchical structure)'
      };
    }

    // 3. Check for SYNOPTIC KEY
    // Format: Comparative table with main characteristics
    const synopticPatterns = ['comparison', 'comparação', 'vs', 'versus', 'character', 'característica'];
    const synopticMatch = headers.filter((h: string) =>
      synopticPatterns.some(pattern => h.includes(pattern))
    ).length;

    if (synopticMatch >= 1 && headers.length >= 3) {
      return {
        format: 'synoptic',
        confidence: 0.7,
        description: language === 'pt'
          ? 'Chave Sinóptica (tabela comparativa)'
          : 'Synoptic Key (comparative table)'
      };
    }

    // 4. Check for MATRIX FORMAT
    // Format: Entities in rows, Features in columns
    // Should have entity names in first column and consistent feature data
    const hasEntityColumn = firstDataRow && firstDataRow[0]?.length > 0;
    const hasMultipleFeatures = headers.length >= 3;
    const hasConsistentData = data.slice(1).every(row =>
      row.length >= headers.length * 0.5 // At least 50% of cells have data
    );

    if (hasEntityColumn && hasMultipleFeatures && hasConsistentData) {
      return {
        format: 'matrix',
        confidence: 0.85,
        description: language === 'pt'
          ? 'Matriz de Características (entidades × características)'
          : 'Character Matrix (entities × features)'
      };
    }

    return {
      format: 'unknown',
      confidence: 0,
      description: language === 'pt'
        ? 'Formato não reconhecido automaticamente'
        : 'Format not automatically recognized'
    };
  };

  // Convert spreadsheet data to Project format (Matrix format)
  const convertSpreadsheetToProject = (fileName: string, data: any[][]): Project | null => {
    if (!data || data.length < 2) {
      alert(language === 'pt' ? 'Planilha vazia ou inválida.' : 'Empty or invalid spreadsheet.');
      return null;
    }

    const headers = data[0];
    const entityColumnIndex = 0; // First column is entity name

    // Extract feature names from headers (skip first column which is entity name)
    const featureNames = headers.slice(1).filter(h => h && h.trim());

    if (featureNames.length === 0) {
      alert(language === 'pt' ? 'Nenhuma característica encontrada na planilha.' : 'No features found in spreadsheet.');
      return null;
    }

    // Create features with states
    const featuresMap = new Map<string, Set<string>>();
    const entitiesData: Array<{name: string, traits: Record<string, string>}> = [];

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const entityName = row[entityColumnIndex]?.toString().trim();

      if (!entityName) continue;

      const traits: Record<string, string> = {};

      // Process each feature column
      for (let j = 1; j < headers.length; j++) {
        const featureName = headers[j]?.toString().trim();
        if (!featureName) continue;

        const cellValue = row[j]?.toString().trim();
        if (!cellValue) continue;

        // Split by comma if multiple states
        const states = cellValue.split(/[,;]/).map(s => s.trim()).filter(Boolean);

        states.forEach(state => {
          if (!featuresMap.has(featureName)) {
            featuresMap.set(featureName, new Set());
          }
          featuresMap.get(featureName)!.add(state);
        });

        traits[featureName] = cellValue;
      }

      entitiesData.push({ name: entityName, traits });
    }

    // Build features array
    const features: Feature[] = Array.from(featuresMap.entries()).map(([featureName, statesSet], index) => {
      const featureId = `f-${Date.now()}-${index}`;
      const states = Array.from(statesSet).map((stateName, sIdx) => ({
        id: `s-${Date.now()}-${index}-${sIdx}`,
        label: stateName
      }));

      return {
        id: featureId,
        name: featureName,
        states
      };
    });

    // Build entities array with mapped trait IDs
    const entities: Entity[] = entitiesData.map((entityData, index) => {
      const traits: Record<string, string[]> = {};

      features.forEach(feature => {
        const cellValue = entityData.traits[feature.name];
        if (!cellValue) return;

        // cellValue is already a string, split it
        const stateNames = cellValue.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        const stateIds = stateNames
          .map(stateName => feature.states.find(s => s.label === stateName)?.id)
          .filter((id): id is string => id !== undefined);

        if (stateIds.length > 0) {
          traits[feature.id] = stateIds;
        }
      });

      return {
        id: `e-${Date.now()}-${index}`,
        name: entityData.name,
        description: '',
        traits,
        links: []
      };
    });

    // Create project
    const projectName = fileName.replace(/\.(xlsx|csv|xls)$/i, '');
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: projectName,
      description: language === 'pt'
        ? `Chave importada de ${fileName}`
        : `Key imported from ${fileName}`,
      features,
      entities
    };

    return project;
  };

  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileReader = new FileReader();

    // Handle XLSX/CSV files
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to 2D array
          const sheetData: any[][] = utils.sheet_to_json(worksheet, { header: 1 });

          // Detect format
          const formatInfo = detectSpreadsheetFormat(sheetData);

          // If it's a linked hub key, suggest importing multiple files
          if (formatInfo.format === 'linked_hub') {
            setPendingSpreadsheetData({ data: sheetData, fileName: file.name });
            setDetectedFormat(formatInfo);
            setShowFormatModal(true);
            return;
          }

          // For other formats, check if we need AI conversion
          if (formatInfo.format === 'dichotomous_sequential' || formatInfo.format === 'indented' || formatInfo.format === 'synoptic') {
            setPendingSpreadsheetData({ data: sheetData, fileName: file.name });
            setDetectedFormat(formatInfo);
            setShowFormatModal(true);
            return;
          }

          // Matrix format - direct conversion
          const project = convertSpreadsheetToProject(file.name, sheetData);
          if (!project) return;

          // Set project in editor
          setProject(project);

          // Save to localStorage
          const saved = localStorage.getItem('nozesia_projects');
          let projectsList: Project[] = [];
          if (saved) {
            try {
              projectsList = JSON.parse(saved);
            } catch (err) {
              console.error("Failed to parse projects", err);
            }
          }
          const updatedList = [project, ...projectsList.filter((p: Project) => p.id !== project.id)];
          localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));

          if (onProjectImported) {
            onProjectImported(project);
          }
        } catch (error) {
          console.error(error);
          alert(language === 'pt' ? 'Erro ao processar planilha.' : 'Error processing spreadsheet.');
        }
      };
      return;
    }

    // Handle JSON files
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.name && parsed.features && parsed.entities) {
          // Set project in editor
          setProject(parsed);

          // Also save to localStorage so it appears in load modals
          const saved = localStorage.getItem('nozesia_projects');
          let projectsList: Project[] = [];
          if (saved) {
            try {
              projectsList = JSON.parse(saved);
            } catch (err) {
              console.error("Failed to parse projects", err);
            }
          }
          // Remove existing version if exists, add new one to top
          const updatedList = [parsed, ...projectsList.filter((p: Project) => p.id !== parsed.id)];
          localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));

          // Notify parent to update its state
          if (onProjectImported) {
            onProjectImported(parsed);
          }
        } else {
          alert(language === 'pt' ? 'Formato de arquivo inválido.' : 'Invalid project file format.');
        }
      } catch (error) {
        alert(language === 'pt' ? 'Erro ao processar arquivo JSON.' : 'Error parsing JSON file.');
      }
    };
  };

  // Handle multiple file selection for linked keys
  const handleMultipleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setMultipleFiles(filesArray);
      setShowMultiFileModal(true);
    }
  };

  // Process multiple files to create linked key collection
  const processMultipleFilesWithAI = async (files: File[], mainFileIndex: number) => {
    if (!aiConfig.model || files.length === 0) {
      alert(language === 'pt' ? 'Configure a API Key primeiro' : 'Configure API Key first');
      return;
    }

    setIsConvertingWithAI(true);
    setShowMultiFileModal(false);

    try {
      const allProjects: Project[] = [];

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setGeneratingMessage(language === 'pt'
          ? `Processando ${i + 1}/${files.length}: ${file.name}...`
          : `Processing ${i + 1}/${files.length}: ${file.name}...`
        );

        const fileData = await file.arrayBuffer();
        const workbook = read(new Uint8Array(fileData), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData: any[][] = utils.sheet_to_json(worksheet, { header: 1 });

        // Use AI to convert
        const project = await convertDichotomousKey(
          aiConfig.model,
          sheetData,
          file.name,
          language
        );

        // Mark as sub-key if not the main file
        if (i !== mainFileIndex) {
          project.isSubKey = true;
          project.parentKeyId = `main-${Date.now()}`;
        }

        allProjects.push(project);
      }

      // Create the main project with references to sub-keys
      const mainProject = allProjects[mainFileIndex];
      mainProject.subKeys = allProjects
        .filter((_, idx) => idx !== mainFileIndex)
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          projectId: p.id
        }));

      // Set main project
      setProject(mainProject);

      // Save all projects to localStorage
      const saved = localStorage.getItem('nozesia_projects');
      let projectsList: Project[] = saved ? JSON.parse(saved) : [];

      // Add all projects
      allProjects.forEach(proj => {
        projectsList = [proj, ...projectsList.filter(p => p.id !== proj.id)];
      });

      localStorage.setItem('nozesia_projects', JSON.stringify(projectsList));

      if (onProjectImported) {
        onProjectImported(mainProject);
      }

      alert(language === 'pt'
        ? `${allProjects.length} chaves importadas com sucesso!`
        : `${allProjects.length} keys imported successfully!`
      );

    } catch (error) {
      console.error('Multi-file import error:', error);
      alert(language === 'pt' ? 'Erro ao processar arquivos' : 'Error processing files');
    } finally {
      setIsConvertingWithAI(false);
      setGeneratingMessage('');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportedFile(event.target.files[0]);
    }
  };

  // Drag and drop handlers for file import
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Validate file type
      const validTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/jpg'];
      const validExtensions = ['.pdf', '.txt', '.jpg', '.jpeg', '.png'];
      const fileName = file.name.toLowerCase();
      const isValidType = validTypes.includes(file.type) || validExtensions.some(ext => fileName.endsWith(ext));
      
      if (isValidType) {
        setImportedFile(file);
      } else {
        alert(language === 'pt' 
          ? 'Tipo de arquivo não suportado. Use PDF, TXT, JPG ou PNG.'
          : 'Unsupported file type. Use PDF, TXT, JPG or PNG.');
      }
    }
  };

  // Handle species list file import
  const handleSpeciesListImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    const fileName = file.name.toLowerCase();
    
    try {
      let speciesText = '';
      
      if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
        // Plain text or CSV
        const text = await file.text();
        // Split by newlines, commas, or semicolons and filter empty
        const species = text
          .split(/[\n\r,;]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.match(/^(species|especie|nome|name|#)/i)); // Filter headers
        speciesText = species.join('\n');
      } else if (fileName.endsWith('.json')) {
        // JSON file - expect array or object with species
        const text = await file.text();
        const json = JSON.parse(text);
        let species: string[] = [];
        if (Array.isArray(json)) {
          species = json.map(item => typeof item === 'string' ? item : item.name || item.species || item.especie || '').filter(Boolean);
        } else if (json.species) {
          species = Array.isArray(json.species) ? json.species : [json.species];
        } else if (json.entities) {
          species = json.entities.map((e: any) => e.name || '').filter(Boolean);
        }
        speciesText = species.join('\n');
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel file - use SheetJS if available, otherwise show message
        // For now, try to read as text (won't work for binary xlsx)
        // We'll use a simpler approach: ask user to save as CSV
        alert(language === 'pt' 
          ? 'Para arquivos Excel, por favor salve como .csv ou .txt primeiro, ou copie e cole a lista diretamente.'
          : 'For Excel files, please save as .csv or .txt first, or copy and paste the list directly.');
        return;
      } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        // Word file - similar limitation
        alert(language === 'pt'
          ? 'Para arquivos Word, por favor copie e cole a lista diretamente no campo de texto.'
          : 'For Word files, please copy and paste the list directly into the text field.');
        return;
      }
      
      // Append to existing or replace
      if (requiredSpeciesText.trim()) {
        const existingSpecies = requiredSpeciesText.split('\n').filter(s => s.trim());
        const newSpecies = speciesText.split('\n').filter(s => s.trim());
        const combined = [...new Set([...existingSpecies, ...newSpecies])]; // Remove duplicates
        setRequiredSpeciesText(combined.join('\n'));
      } else {
        setRequiredSpeciesText(speciesText);
      }
      
      // Reset input
      if (speciesListInputRef.current) {
        speciesListInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error importing species list:', error);
      alert(language === 'pt' 
        ? 'Erro ao importar arquivo. Verifique o formato.'
        : 'Error importing file. Check the format.');
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Generate random curiosities from saved projects for the typing effect
  const generateCuriosities = (): string[] => {
    const curiosities: string[] = [];
    const introMessages = language === 'pt' ? [
      "🔬 Analisando estrutura do documento...",
      "🌿 Identificando características taxonômicas...",
      "📊 Processando matriz de identificação...",
      "🧬 Extraindo informações das espécies...",
    ] : [
      "🔬 Analyzing document structure...",
      "🌿 Identifying taxonomic features...",
      "📊 Processing identification matrix...",
      "🧬 Extracting species information...",
    ];
    
    // Add intro messages
    curiosities.push(...introMessages);
    
    // Get curiosities from saved projects
    if (savedProjects.length > 0) {
      const headerMsg = language === 'pt' 
        ? "\n💡 Enquanto isso, você sabia que..."
        : "\n💡 Meanwhile, did you know that...";
      curiosities.push(headerMsg);
      
      savedProjects.forEach(proj => {
        // Random entity facts
        if (proj.entities && proj.entities.length > 0) {
          const randomEntities = [...proj.entities].sort(() => Math.random() - 0.5).slice(0, 3);
          randomEntities.forEach(entity => {
            if (entity.description && entity.description.length > 20) {
              const fact = language === 'pt'
                ? `\n🌱 "${entity.name}": ${entity.description}`
                : `\n🌱 "${entity.name}": ${entity.description}`;
              curiosities.push(fact);
            }
            // Add scientific name/family info
            if (entity.scientificName || entity.family) {
              const taxInfo = language === 'pt'
                ? `\n   📚 ${entity.scientificName ? `Nome científico: ${entity.scientificName}` : ''}${entity.scientificName && entity.family ? ' | ' : ''}${entity.family ? `Família: ${entity.family}` : ''}`
                : `\n   📚 ${entity.scientificName ? `Scientific name: ${entity.scientificName}` : ''}${entity.scientificName && entity.family ? ' | ' : ''}${entity.family ? `Family: ${entity.family}` : ''}`;
              if (entity.scientificName || entity.family) curiosities.push(taxInfo);
            }
          });
        }
        
        // Random feature facts
        if (proj.features && proj.features.length > 0) {
          const randomFeature = proj.features[Math.floor(Math.random() * proj.features.length)];
          if (randomFeature.states && randomFeature.states.length > 1) {
            const states = randomFeature.states.map(s => s.label).join(', ');
            const fact = language === 'pt'
              ? `\n🔍 A característica "${randomFeature.name}" pode ter os estados: ${states}`
              : `\n🔍 The feature "${randomFeature.name}" can have states: ${states}`;
            curiosities.push(fact);
          }
        }
      });
      
      // Project stats
      const totalEntities = savedProjects.reduce((sum, p) => sum + (p.entities?.length || 0), 0);
      const totalFeatures = savedProjects.reduce((sum, p) => sum + (p.features?.length || 0), 0);
      const statsMsg = language === 'pt'
        ? `\n\n📈 Você já catalogou ${totalEntities} entidades e ${totalFeatures} características em ${savedProjects.length} chave(s)!`
        : `\n\n📈 You have cataloged ${totalEntities} entities and ${totalFeatures} features across ${savedProjects.length} key(s)!`;
      curiosities.push(statsMsg);
    }
    
    return curiosities;
  };

  // Start the typing effect
  const startTypingEffect = () => {
    setAiTypingText("");
    setAiTypingComplete(false);
    
    const curiosities = generateCuriosities();
    const fullText = curiosities.join('\n');
    let currentIndex = 0;
    
    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < fullText.length) {
        // Type multiple characters at once for faster effect
        const charsToAdd = Math.min(3, fullText.length - currentIndex);
        setAiTypingText(prev => prev + fullText.substring(currentIndex, currentIndex + charsToAdd));
        currentIndex += charsToAdd;
      }
    }, 30); // 30ms per batch of characters
  };

  // Stop the typing effect and show completion summary
  const stopTypingEffect = (resultProject?: Project) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    
    if (resultProject) {
      const entitiesCount = resultProject.entities?.length || 0;
      const featuresCount = resultProject.features?.length || 0;
      const statesCount = resultProject.features?.reduce((sum, f) => sum + (f.states?.length || 0), 0) || 0;
      const withPhotos = resultProject.entities?.filter(e => e.imageUrl && !e.imageUrl.includes('picsum.photos') && !e.imageUrl.includes('placehold.co')).length || 0;
      const withLinks = resultProject.entities?.filter(e => e.links && e.links.length > 0).length || 0;
      
      const warningMsg = language === 'pt'
        ? `\n\n⚠️ ATENÇÃO: REVISÃO NECESSÁRIA!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOs dados gerados por IA podem conter:\n• Erros taxonômicos ou nomenclaturais\n• Características incorretas ou incompletas\n• Associações espécie-característica imprecisas\n• Fotos que não correspondem à espécie\n\n👉 REVISE E CORRIJA todos os dados antes\n   de utilizar esta chave para identificação.`
        : `\n\n⚠️ WARNING: REVIEW REQUIRED!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAI-generated data may contain:\n• Taxonomic or nomenclatural errors\n• Incorrect or incomplete features\n• Inaccurate species-trait associations\n• Photos that don't match the species\n\n👉 REVIEW AND CORRECT all data before\n   using this key for identification.`;
      
      const summaryMsg = language === 'pt'
        ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ANÁLISE CONCLUÍDA!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Resumo da Geração:\n\n   🌿 Entidades: ${entitiesCount}\n   🔬 Características: ${featuresCount}\n   📋 Estados totais: ${statesCount}\n   📷 Com fotos: ${withPhotos}/${entitiesCount}\n   🔗 Com links: ${withLinks}/${entitiesCount}${warningMsg}`
        : `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ANALYSIS COMPLETE!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Generation Summary:\n\n   🌿 Entities: ${entitiesCount}\n   🔬 Features: ${featuresCount}\n   📋 Total states: ${statesCount}\n   📷 With photos: ${withPhotos}/${entitiesCount}\n   🔗 With links: ${withLinks}/${entitiesCount}${warningMsg}`;
      
      setAiTypingText(prev => prev + summaryMsg);
    }
    
    setAiTypingComplete(true);
  };

  // Close AI Modal and reset all generation state
  const handleCloseAiModal = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setIsGenerating(false);
    setGeneratingMessage('');
    setAiTypingText('');
    setAiTypingComplete(false);
    setShowAiModal(false);
  };

  const handleAiGenerate = async () => {
    if (!apiKey) {
      alert(strings.missingKey);
      return;
    }
    setIsGenerating(true);
    setGeneratingMessage(strings.generating);
    
    // Open prompt editor and start typing effect
    setShowAiModal(false);
    setShowPromptEditor(true);
    startTypingEffect();
    
    try {
      // Parse required species from text input
      const requiredSpeciesList = requiredSpeciesText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      let config = { ...aiConfig, requiredFeatures, requiredSpecies: requiredSpeciesList };

      if (aiMode === 'IMPORT' && importedFile) {
        const base64Data = await convertFileToBase64(importedFile);
        config.importedFile = {
          data: base64Data,
          mimeType: importedFile.type
        };
        // Ensure topic isn't empty so logic doesn't fail, though it's ignored for imports
        config.topic = `Imported: ${importedFile.name}`;
      } else if (aiMode === 'TOPIC') {
        if (!config.topic.trim()) return;
        config.importedFile = undefined;
      }

      // Pass callbacks to receive prompt text and image fetch progress
      const generatedProject = await generateKeyFromTopic(
        config, 
        apiKey, 
        (fullPrompt) => {
          // Store prompt for viewing/editing
          setManualPrompt(fullPrompt);
        },
        // Image fetch progress callback
        (current, total, entityName) => {
          const msg = aiConfig.language === 'pt' 
            ? `🔍 Buscando imagens: ${current}/${total} - ${entityName}`
            : `🔍 Fetching images: ${current}/${total} - ${entityName}`;
          setGeneratingMessage(msg);
          // Also update typing text with image progress
          setAiTypingText(prev => {
            const newLine = `\n📷 ${entityName}...`;
            // Avoid duplicate entries
            if (!prev.includes(newLine)) return prev + newLine;
            return prev;
          });
        }
      );

      // Stop typing effect and show summary
      stopTypingEffect(generatedProject);
      
      // Wait so user can see the summary
      await new Promise(resolve => setTimeout(resolve, 2500));

      setProject(generatedProject);
      setShowPromptEditor(false);
      setActiveTab('MATRIX');
    } catch (e) {
      console.error(e);
      // Stop typing and show error
      stopTypingEffect();
      setAiTypingText(prev => prev + (language === 'pt' 
        ? "\n\n❌ ERRO: Não foi possível gerar a chave."
        : "\n\n❌ ERROR: Could not generate the key."));
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(strings.errGen);
      setShowPromptEditor(false);
    } finally {
      setIsGenerating(false);
      setGeneratingMessage('');
    }
  };

  // Build refine prompt based on current settings
  const buildRefinePrompt = () => {
    // ═══════════════════════════════════════════════════════════════════════════════
    // OPTIMIZED: Use ID-based format for traits to avoid complex remapping
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Build compact ID reference for features and states
    const featuresRef = project.features.map(f => ({
      id: f.id,
      name: f.name,
      states: f.states.map(s => ({ id: s.id, label: s.label }))
    }));
    
    // Build entity data with ID-based traits (traitsMap format)
    const entitiesRef = project.entities.map(e => ({
      id: e.id,
      name: e.name,
      scientificName: e.scientificName || '',
      family: e.family || '',
      description: e.description || '',
      traitsMap: JSON.stringify(e.traits) // {featureId: [stateIds]} as JSON string
    }));

    let refinePrompt = '';
    
    // PHOTOS action - dedicated photo completion prompt (optimized: send only names, not full JSON)
    if (refineAction === 'PHOTOS') {
      setCurrentRefineMode(null); // PHOTOS doesn't use refine mode
      const targetEntities = refineOptions.photoTarget === 'entities' || refineOptions.photoTarget === 'both';
      const targetFeatures = refineOptions.photoTarget === 'features' || refineOptions.photoTarget === 'both';
      const replaceMode = refineOptions.photoMode === 'replace';
      const customSources = refineOptions.photoCustomSources?.trim();
      
      // Build compact data: only names and optionally current URLs
      let photoData: any = { name: project.name };
      
      if (targetEntities) {
        photoData.entities = project.entities.map(e => ({
          name: e.name,
          searchName: extractBinomial(e.scientificName || e.name), // Use only genus+epithet for image search
          currentUrl: replaceMode ? '' : (e.imageUrl || '')
        })).filter(e => replaceMode || !e.currentUrl); // Only include items needing photos
      }
      
      if (targetFeatures) {
        photoData.features = project.features.map(f => ({
          name: f.name,
          currentUrl: replaceMode ? '' : (f.imageUrl || '')
        })).filter(f => replaceMode || !f.currentUrl);
      }
      
      const compactJson = JSON.stringify(photoData, null, 2);
      
      // Build source instructions
      let sourceInstructions = '';
      if (customSources) {
        const sources = customSources.split('\n').filter(s => s.trim());
        sourceInstructions = `
USER-PREFERRED SOURCES (check these FIRST, in order):
${sources.map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')}

If user sources don't have the image, then check these scientific databases:`;
      } else {
        sourceInstructions = `
SCIENTIFIC IMAGE SOURCES (check in this order):`;
      }
      
      refinePrompt = `
# PHOTO COLLECTION TASK

You are an expert at finding HIGH-QUALITY, VALID image URLs from scientific databases.

## PROJECT: "${project.name}"
${project.description ? `Description: ${project.description}` : ''}

## ITEMS NEEDING PHOTOS:
${compactJson}

## YOUR TASK:
Find ONE valid, high-quality image URL for each item listed above.
${replaceMode ? 'REPLACE ALL URLs - ignore any existing URLs and find new ones.' : 'ONLY FILL EMPTY URLs - skip items that already have a URL.'}

## HOW TO FIND GOOD PHOTOS:

⚠️ CRITICAL: For image searches, ALWAYS use the "searchName" field (genus + epithet only).
NEVER use author names in image searches (e.g., search "Andira fraxinifolia", NOT "Andira fraxinifolia Benth.").

${sourceInstructions}
1. **iNaturalist** - Search: https://www.inaturalist.org/taxa/search?q=[searchName]
   - Navigate to species page → Photos tab → Right-click image → Copy Image Address
   - Valid format: https://inaturalist-open-data.s3.amazonaws.com/photos/[id]/medium.jpg

2. **GBIF** - Search: https://www.gbif.org/species/search?q=[species_name]
   - Go to species page → Gallery → Click image → Copy direct URL
   
3. **Flickr Commons** - Scientific/botanical photos with open licenses
   - Valid format: https://live.staticflickr.com/[path].jpg

4. **Biodiversity Heritage Library** - For historical botanical illustrations
   - Valid format: https://www.biodiversitylibrary.org/pagethumb/[id]

5. **Wikimedia Commons** - ONLY use if you know the EXACT filename exists
   - Valid format: https://upload.wikimedia.org/wikipedia/commons/thumb/X/XX/Exact_Filename.jpg/400px-Exact_Filename.jpg

${language === 'pt' ? `
6. **Flora e Funga do Brasil** - Para espécies brasileiras
   - https://floradobrasil.jbrj.gov.br

7. **Species Link** - Rede de herbários brasileiros
   - http://www.splink.org.br
` : ''}

## CRITICAL RULES:
1. ✅ URL MUST be a DIRECT image link ending in .jpg, .jpeg, .png, .gif, or .webp
2. ✅ URL MUST work when opened directly in a browser (no login required)
3. ❌ DO NOT use Google Images, Pinterest, or any search result pages
4. ❌ DO NOT guess or make up URLs - only use URLs you are confident exist
5. ❌ DO NOT use Wikimedia URLs unless you know the exact filename
6. ❌ NEVER use placeholder, mockup, picsum, placehold.co, or any fake/generated images

## IF NO REAL PHOTO FOUND:
Leave the imageUrl as empty string "" - DO NOT use any placeholder or fake URLs.
It's better to have no image than a fake/mockup image.

## OUTPUT FORMAT:
Return a JSON array with the results:
\`\`\`json
{
  ${targetEntities ? `"entities": [
    { "name": "Species Name", "imageUrl": "https://direct-image-url.jpg" }
  ]${targetFeatures ? ',' : ''}` : ''}
  ${targetFeatures ? `"features": [
    { "name": "Feature Name", "imageUrl": "https://direct-image-url.jpg" }
  ]` : ''}
}
\`\`\`

Language: ${language === 'pt' ? 'Portuguese' : 'English'}
Total items to process: ${(targetEntities ? photoData.entities?.length || 0 : 0) + (targetFeatures ? photoData.features?.length || 0 : 0)}
`;
    } else if (refineAction === 'EXPAND') {
      // Build geographic/taxonomic context for EXPAND
      const expandFilters: string[] = [];
      if (refineOptions.expandFamily) {
        expandFilters.push(`FAMILY RESTRICTION: Only add species from family "${refineOptions.expandFamily}"`);
      }
      if (refineOptions.expandGenus) {
        expandFilters.push(`GENUS RESTRICTION: Only add species from genus "${refineOptions.expandGenus}"`);
      }
      if (refineOptions.expandBiome) {
        expandFilters.push(`BIOME RESTRICTION: Only add species that occur in "${refineOptions.expandBiome}" biome`);
      }
      if (refineOptions.expandStateUF) {
        expandFilters.push(`STATE/UF RESTRICTION: Only add species that occur in "${refineOptions.expandStateUF}" state, Brazil`);
      }
      if (refineOptions.expandScope === 'national') {
        expandFilters.push('GEOGRAPHIC SCOPE: Only add species native to or occurring in Brazil');
      } else if (refineOptions.expandScope === 'regional' && (refineOptions.expandBiome || refineOptions.expandStateUF)) {
        expandFilters.push('GEOGRAPHIC SCOPE: Strictly regional - species must occur in the specified biome/state');
      }
      
      const filterInstructions = expandFilters.length > 0 
        ? `\nTAXONOMIC & GEOGRAPHIC FILTERS (MANDATORY):\n${expandFilters.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`
        : '';

      const keepExistingEntities = refineOptions.keepExisting;
      
      // Parse required species for EXPAND
      const expandRequiredSpeciesList = refineOptions.expandRequiredSpecies
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const requiredSpeciesInstr = expandRequiredSpeciesList.length > 0
        ? `\nMANDATORY SPECIES TO ADD: ${expandRequiredSpeciesList.join(', ')}`
        : '';
      
      // Set refine mode for optimized processing
      setCurrentRefineMode('expand');
      
      // Use ID-based format for EXPAND
      refinePrompt = `
EXPAND IDENTIFICATION KEY

FEATURES (use these IDs):
${JSON.stringify(featuresRef, null, 2)}

EXISTING ENTITIES (${project.entities.length} - ${keepExistingEntities ? 'PRESERVE ALL' : 'may replace'}):
${JSON.stringify(entitiesRef, null, 2)}

TASK: Add ${refineOptions.expandCount} NEW entities.${requiredSpeciesInstr}
${filterInstructions}
RULES:
1. ${keepExistingEntities ? 'PRESERVE all existing entities with their IDs' : 'Replace existing entities'}
2. For NEW entities, generate new unique IDs
3. Return traitsMap as JSON string: {"featureId": ["stateId1", "stateId2"]}
4. Use ONLY existing feature and state IDs from the FEATURES list above
5. Language: ${language === 'pt' ? 'Portuguese' : 'English'}

OUTPUT: Return JSON with "entities" array. Each entity needs: id, name, scientificName, family, description, traitsMap
`;
    } else if (refineAction === 'REFINE') {
      // Build required features instruction
      const requiredFeaturesInstr = refineOptions.refineRequiredFeatures.length > 0
        ? `\nREQUIRED FEATURES (MANDATORY - must be added if not present):
${refineOptions.refineRequiredFeatures.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

For each required feature above:
- If it already exists in the key, ensure it has appropriate states and all entities are assigned.
- If it does NOT exist, ADD it as a new feature with relevant states and assign all entities accordingly.
`
        : '';
      
      // Check if ONLY fillGaps is selected (specialized prompt for better results)
      const onlyFillGaps = refineOptions.fillGaps && !refineOptions.improveDescriptions && !refineOptions.addFeatures && refineOptions.refineRequiredFeatures.length === 0;
      
      // Helper to get valid state IDs for a feature
      const getValidStateIds = (feature: Feature): Set<string> => new Set(feature.states.map(s => s.id));
      
      // Clean up invalid trait IDs from entities before processing
      // This fixes issues where traits were saved with incorrect IDs from previous AI responses
      const cleanedProject = {
        ...project,
        entities: project.entities.map(entity => {
          const cleanedTraits: Record<string, string[]> = {};
          for (const [featureId, stateIds] of Object.entries(entity.traits)) {
            const feature = project.features.find(f => f.id === featureId);
            if (feature) {
              const validIds = getValidStateIds(feature);
              const validTraits = stateIds.filter(sid => validIds.has(sid));
              if (validTraits.length > 0) {
                cleanedTraits[featureId] = validTraits;
              }
            }
          }
          return { ...entity, traits: cleanedTraits };
        })
      };
      
      // Use cleaned project for gap analysis
      const projectForAnalysis = cleanedProject;

      if (onlyFillGaps) {
        // Build detailed gap analysis - identify which entities need which features filled
        const entitiesWithGaps: { id: string; name: string; missingFeatureIds: string[] }[] = [];
        
        projectForAnalysis.entities.forEach(entity => {
          const missingFeatureIds: string[] = [];
          projectForAnalysis.features.forEach(feature => {
            const traitIds = entity.traits[feature.id] || [];
            const validStateIds = feature.states.map(s => s.id);
            const hasValidTraits = traitIds.length > 0 && traitIds.some(tid => validStateIds.includes(tid));
            if (!hasValidTraits) {
              missingFeatureIds.push(feature.id);
            }
          });
          if (missingFeatureIds.length > 0) {
            entitiesWithGaps.push({ id: entity.id, name: entity.name, missingFeatureIds });
          }
        });
        
        if (entitiesWithGaps.length === 0) {
          setCurrentRefineMode(null);
          refinePrompt = `No missing trait data found. All ${projectForAnalysis.entities.length} entities have assignments for all ${projectForAnalysis.features.length} features.`;
        } else {
          // Set refine mode for optimized processing
          setCurrentRefineMode('fillGaps');
          
          // Create compact prompt for fillGaps
          const entitiesListText = entitiesWithGaps.length > 20 
            ? `Entities with gaps: ${entitiesWithGaps.length} (see attached project data for full list)` 
            : `ENTITIES NEEDING DATA:\n${entitiesWithGaps.map(e => `- ${e.id}: "${e.name}" needs: ${e.missingFeatureIds.map(fid => {
                const f = projectForAnalysis.features.find(feat => feat.id === fid);
                return f ? f.name : fid;
              }).join(', ')}`).join('\n')}`;

          refinePrompt = `
FILL MISSING TRAITS

FEATURES (use these IDs for traits):
${JSON.stringify(featuresRef, null, 2)}

${entitiesListText}

TASK: For each entity with missing data, determine the correct trait values.

OUTPUT FORMAT (use fillGapsSchema):
Return "filledEntities" array with:
- entityId: the entity ID
- filledTraits: Array like [{"featureId": "fid", "stateIds": ["sid"]}] - ONLY the new traits being added

RULES:
1. Use ONLY the state IDs from FEATURES list above
2. Return ONLY entities that have gaps
3. Do NOT include existing traits - only NEW ones
4. Language: ${language === 'pt' ? 'Portuguese' : 'English'}
`;
        }
      } else {
        // Standard REFINE prompt (multiple options selected)
        setCurrentRefineMode('refine');
        
        // Feature type instruction - Dynamic based on Category
        let featureTypeInstr = '';
        if (aiConfig.category === 'FAUNA') {
          featureTypeInstr = refineOptions.featureType === 'vegetative' // mapped to Morphological
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on MORPHOLOGICAL characters (body shape, size, color, appendages, skin/fur/feathers, etc.). Do NOT add behavioral characters.`
            : refineOptions.featureType === 'reproductive' // mapped to Behavioral
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on BEHAVIORAL characters (diet, activity, social, locomotion, vocalization, etc.). Do NOT add morphological characters.`
            : '';
        } else if (aiConfig.category === 'OTHER') {
          featureTypeInstr = refineOptions.featureType === 'vegetative' // mapped to Visual/Physical
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on VISUAL/PHYSICAL characters (color, shape, material, size, texture, etc.). Do NOT add conceptual characters.`
            : refineOptions.featureType === 'reproductive' // mapped to Conceptual
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on CONCEPTUAL characters (genre, theme, era, origin, creator, etc.). Do NOT add visual characters.`
            : '';
        } else {
          // FLORA (Default)
          featureTypeInstr = refineOptions.featureType === 'vegetative'
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on VEGETATIVE characters (leaves, stems, bark, branching, stipules, etc.). Do NOT add reproductive characters (flowers, fruits, seeds).`
            : refineOptions.featureType === 'reproductive'
            ? `\nFEATURE TYPE RESTRICTION: Focus ONLY on REPRODUCTIVE characters (flowers, inflorescences, fruits, seeds, pods, etc.). Do NOT add vegetative characters.`
            : '';
        }
        
        refinePrompt = `
REFINE IDENTIFICATION KEY

FEATURES (use these IDs):
${JSON.stringify(featuresRef, null, 2)}

ENTITIES (${project.entities.length} - PRESERVE ALL):
${JSON.stringify(entitiesRef, null, 2)}

TASK: Improve this key.
${requiredFeaturesInstr}${featureTypeInstr}
IMPROVEMENTS:
${refineOptions.improveDescriptions ? '- Improve and lengthen descriptions for all entities' : ''}
${refineOptions.fillGaps ? '- Fill ALL missing traits for existing features (currently some entities have gaps)' : ''}
${refineOptions.addFeatures ? `- ADD EXACTLY ${refineOptions.refineFeatureCount} NEW DISCRIMINATING FEATURES. These features MUST effectively separate the species in the list. You MUST assign these new features to EVERY SINGLE one of the ${project.entities.length} entities.` : ''}

CRITICAL RULES:
1. PRESERVE all ${project.entities.length} entity IDs from input. Do NOT omit any species.
2. For NEW features: provide a unique "id" (9 chars) and a "name", and at least 2 "states" (each with "id" and "label").
3. For EVERY entity in the "entities" array:
   - "traitsMap" MUST be a JSON string representing an object: {"featureId": ["stateId1", ...]}
   - The traitsMap MUST include assignments for BOTH existing features AND the new features you add.
   - NO GAPS: Ensure every feature has at least one state assigned for every entity.
4. Scientific Accuracy: Use real taxonomic data for the species provided.
5. Language: ${language === 'pt' ? 'Portuguese (Brazil)' : 'English'}

OUTPUT FORMAT: 
Return a JSON object with:
- "features": [array of ONLY the ${refineOptions.addFeatures ? refineOptions.refineFeatureCount : 0} NEW features you created]
- "entities": [array of ALL ${project.entities.length} entities with updated description and traitsMap]
`;
      }
    } else { // CLEAN
      setCurrentRefineMode('clean');
      
      refinePrompt = `
CLEAN IDENTIFICATION KEY

FEATURES:
${JSON.stringify(featuresRef, null, 2)}

ENTITIES (${project.entities.length}):
${JSON.stringify(entitiesRef.map(e => ({ id: e.id, name: e.name })), null, 2)}

TASK: Optimize this key.
${refineOptions.removeRedundant ? '- Remove redundant features (all entities have same state)' : ''}
${refineOptions.fixInconsistencies ? '- Fix trait inconsistencies' : ''}

RULES:
1. PRESERVE all ${project.entities.length} entity IDs
2. Return traitsMap as JSON string
3. Language: ${language === 'pt' ? 'Portuguese' : 'English'}

OUTPUT: Return JSON with "entities" array with: id, name, traitsMap
`;
    }
    
    return refinePrompt;
  };

  // Build merge prompt for combining two keys
  const buildMergePrompt = () => {
    if (!mergeKey1 || !mergeKey2) return '';

    const key1Json = JSON.stringify({
      name: mergeKey1.name,
      description: mergeKey1.description,
      features: mergeKey1.features.map(f => ({
        name: f.name,
        states: f.states.map(s => s.label)
      })),
      entities: mergeKey1.entities.map(e => ({
        name: e.name,
        description: e.description,
        traits: Object.entries(e.traits).map(([fid, sids]) => {
          const feature = mergeKey1.features.find(f => f.id === fid);
          return sids.map(sid => {
            const state = feature?.states.find(s => s.id === sid);
            return { featureName: feature?.name || '', stateValue: state?.label || '' };
          });
        }).flat()
      }))
    }, null, 2);

    const key2Json = JSON.stringify({
      name: mergeKey2.name,
      description: mergeKey2.description,
      features: mergeKey2.features.map(f => ({
        name: f.name,
        states: f.states.map(s => s.label)
      })),
      entities: mergeKey2.entities.map(e => ({
        name: e.name,
        description: e.description,
        traits: Object.entries(e.traits).map(([fid, sids]) => {
          const feature = mergeKey2.features.find(f => f.id === fid);
          return sids.map(sid => {
            const state = feature?.states.find(s => s.id === sid);
            return { featureName: feature?.name || '', stateValue: state?.label || '' };
          });
        }).flat()
      }))
    }, null, 2);

    let strategyInstructions = '';
    if (mergeStrategy === 'union') {
      strategyInstructions = `
MERGE STRATEGY: UNION (All-inclusive)
- Include ALL features from BOTH keys
- Include ALL entities from BOTH keys
- Merge similar features where possible, keeping all unique states
- For duplicate entities, combine traits from both sources`;
    } else if (mergeStrategy === 'intersection') {
      strategyInstructions = `
MERGE STRATEGY: INTERSECTION (Common elements)
- Keep only features that are present in BOTH keys (or semantically equivalent)
- Include ALL entities from both keys, but focus on shared characteristics
- Prioritize traits that appear in both keys for duplicate entities`;
    } else {
      strategyInstructions = `
MERGE STRATEGY: PRIMARY (Key 1 priority)
- Use KEY 1 as the primary structure base
- Add entities from KEY 2 that don't exist in KEY 1
- For duplicate entities, prefer KEY 1's trait assignments
- Add features from KEY 2 only if they add discrimination value`;
    }

    return `
You are an expert taxonomist specializing in identification key design and optimization.

TASK: Merge two identification keys into ONE comprehensive, optimized key.

KEY 1 (${mergeKey1.entities.length} entities, ${mergeKey1.features.length} features):
${key1Json}

KEY 2 (${mergeKey2.entities.length} entities, ${mergeKey2.features.length} features):
${key2Json}

${strategyInstructions}

CRITICAL REQUIREMENTS:
1. PRESERVE ALL ENTITIES from BOTH keys. The merged key must include every single species/entity.
2. Create a unified feature set that can describe ALL entities
3. Assign appropriate traits to every entity for every feature in the merged key
4. Merge semantically similar features (e.g., "Leaf Shape" and "Leaf Form")
5. Maintain language: ${language === 'pt' ? 'Portuguese' : 'English'}

PROCESS:
1. First, identify all unique entities from both keys
2. Analyze features from both keys for similarities
3. Create unified feature set based on merge strategy
4. Map all entities to the new feature set
5. Ensure every entity has trait assignments for every feature

OUTPUT: Return a single merged JSON identification key with:
- Combined name and description
- Unified feature set
- ALL entities from both keys with complete trait mappings
`;
  };

  // Handle merge key file upload
  const handleMergeKeyUpload = (keyNumber: 1 | 2) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        // Validate it's a valid project structure
        if (!parsed.features || !parsed.entities) {
          alert(language === 'pt' ? 'JSON inválido. Deve conter features e entities.' : 'Invalid JSON. Must contain features and entities.');
          return;
        }
        
        if (keyNumber === 1) {
          setMergeKey1(parsed as Project);
        } else {
          setMergeKey2(parsed as Project);
        }
      } catch (err) {
        alert(language === 'pt' ? 'Erro ao ler arquivo JSON.' : 'Error reading JSON file.');
      }
    };
    input.click();
  };

  // Handle merge generation
  const handleMergeGenerate = async () => {
    if (!apiKey) {
      alert(strings.missingKey);
      return;
    }
    if (!mergeKey1 || !mergeKey2) {
      alert(language === 'pt' ? 'Carregue ambas as chaves JSON primeiro.' : 'Load both JSON keys first.');
      return;
    }
    
    try {
      const mergePrompt = buildMergePrompt();
      setManualPrompt(mergePrompt);
      
      // Open prompt editor - user can review/edit then click Generate to execute
      setShowAiModal(false);
      setShowPromptEditor(true);
      // Don't execute automatically - let user review prompt and click Generate in the modal
    } catch (e) {
      console.error(e);
      alert(language === 'pt' ? 'Erro ao gerar prompt.' : 'Error generating prompt.');
    }
  };

  const handleRefineGenerate = async () => {
    // PHOTOS action doesn't need API key (uses free public APIs)
    if (refineAction !== 'PHOTOS' && !apiKey) {
      alert(strings.missingKey);
      return;
    }
    if (project.entities.length === 0) {
      alert(language === 'pt' ? 'Carregue um projeto primeiro.' : 'Load a project first.');
      return;
    }
    
    // Validate action requires at least one validation option
    if (refineAction === 'VALIDATE' && 
        !refineOptions.validateFixNames && 
        !refineOptions.validateMergeSynonyms && 
        !refineOptions.validateCheckGeography && 
        !refineOptions.validateCheckTaxonomy) {
      alert(language === 'pt' 
        ? 'Selecione pelo menos uma opção de validação.' 
        : 'Select at least one validation option.');
      return;
    }
    
    setIsGenerating(true);
    setGeneratingMessage('');
    
    // Open prompt editor and start typing effect for all refine actions
    setShowAiModal(false);
    setShowPromptEditor(true);
    setAiTypingText('');
    setAiTypingComplete(false);
    
    try {
      // PHOTOS action - Use direct API fetching instead of Gemini (much more reliable!)
      if (refineAction === 'PHOTOS') {
        const targetEntities = refineOptions.photoTarget === 'entities' || refineOptions.photoTarget === 'both';
        const targetFeatures = refineOptions.photoTarget === 'features' || refineOptions.photoTarget === 'both';
        const replaceMode = refineOptions.photoMode === 'replace';
        
        let updatedProject = { ...project };
        
        // Initial message
        const introMsg = language === 'pt'
          ? "🔍 Iniciando busca de imagens...\n\n📷 Fontes: Biodiversity4All, iNaturalist, Wikipedia, Wikimedia Commons, PlantNet, POWO (Kew)\n\n"
          : "🔍 Starting image search...\n\n📷 Sources: Biodiversity4All, iNaturalist, Wikipedia, Wikimedia Commons, PlantNet, POWO (Kew)\n\n";
        setAiTypingText(introMsg);
        
        // Fetch images for entities
        if (targetEntities) {
          const entitiesToFetch = project.entities
            .filter(e => replaceMode || !e.imageUrl || e.imageUrl.includes('picsum.photos') || e.imageUrl.includes('placehold.co'))
            .map(e => ({ name: e.name, scientificName: e.name }));
          
          if (entitiesToFetch.length > 0) {
            const imageMap = await fetchImagesForEntities(
              entitiesToFetch,
              language,
              (current, total, entityName) => {
                const msg = language === 'pt' 
                  ? `🔍 Buscando imagens: ${current}/${total} - ${entityName}`
                  : `🔍 Fetching images: ${current}/${total} - ${entityName}`;
                setGeneratingMessage(msg);
                // Update typing text with progress
                setAiTypingText(prev => prev + `📷 ${entityName}...\n`);
              },
              aiConfig.category
            );
            
            updatedProject.entities = project.entities.map(entity => {
              const newUrl = imageMap.get(entity.name);
              if (newUrl) {
                return { ...entity, imageUrl: newUrl };
              }
              return entity;
            });
          }
        }
        
        // Note: Feature images are harder to fetch automatically as they're abstract concepts
        if (targetFeatures) {
          const featureMsg = language === 'pt' 
            ? '\n⚠️ Imagens de características não suportadas via API automática\n'
            : '\n⚠️ Feature images not supported via automatic API\n';
          setAiTypingText(prev => prev + featureMsg);
          await new Promise(r => setTimeout(r, 1500));
        }
        
        // Show summary
        const foundCount = targetEntities 
          ? updatedProject.entities.filter(e => e.imageUrl && !e.imageUrl.includes('picsum.photos')).length
          : 0;
        const totalCount = targetEntities ? project.entities.length : 0;
        
        const summaryMsg = language === 'pt'
          ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ BUSCA CONCLUÍDA!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Resultado:\n   📷 Imagens encontradas: ${foundCount}/${totalCount}\n\n🎉 Fotos atualizadas com sucesso!`
          : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ SEARCH COMPLETE!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Result:\n   📷 Images found: ${foundCount}/${totalCount}\n\n🎉 Photos updated successfully!`;
        
        setAiTypingText(prev => prev + summaryMsg);
        setAiTypingComplete(true);
        
        // Wait so user can see the summary
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setProject(updatedProject);
        setShowPromptEditor(false);
        setActiveTab('ENTITIES');
        
        return;
      }

      // VALIDATE action - Uses Gemini to validate taxonomy
      if (refineAction === 'VALIDATE') {
        startTypingEffect();
        
        // Build validation prompt
        const entityList = project.entities.map((e, idx) => 
          `${idx + 1}. "${e.name}"${e.scientificName ? ` [Scientific: ${e.scientificName}]` : ''} (ID: ${e.id})`
        ).join('\n');
        
        const catalogName = refineOptions.validateReference === 'floradobrasil' 
          ? 'Flora do Brasil 2020 (https://floradobrasil.jbrj.gov.br)' 
          : refineOptions.validateReference === 'gbif' 
            ? 'GBIF Backbone Taxonomy'
            : refineOptions.validateReference === 'powo'
              ? 'Plants of the World Online (POWO - Kew)'
              : 'current taxonomic literature';
        
        // Build strict validation rules
        const validationRules: string[] = [];
        const removalCriteria: string[] = [];
        
        if (refineOptions.validateFixNames) {
          validationRules.push(`RULE 1 - NAME VALIDATION:
   - Check each scientific name against ${catalogName}
   - If the name is a SYNONYM → replace with the ACCEPTED name
   - If the name is MISSPELLED → correct the spelling
   - If the name DOES NOT EXIST in any taxonomic database → REMOVE the entity entirely
   - Update the "scientificName" field with the correct binomial (Genus species Author)`);
        }
        
        if (refineOptions.validateMergeSynonyms) {
          validationRules.push(`RULE 2 - SYNONYM MERGING:
   - If TWO OR MORE entities in the list are synonyms of each other → KEEP ONLY ONE (the accepted name)
   - Merge their trait data: combine all trait values from both entities
   - Merge their descriptions: combine relevant information
   - Keep the best available imageUrl`);
        }
        
        if (refineOptions.validateCheckTaxonomy) {
          if (refineOptions.validateGenus) {
            removalCriteria.push(`GENUS FILTER: The species MUST belong to genus "${refineOptions.validateGenus}"`);
            validationRules.push(`RULE 3 - GENUS RESTRICTION (STRICT):
   - ONLY species of genus "${refineOptions.validateGenus}" are allowed
   - The first word of the scientific name MUST be exactly "${refineOptions.validateGenus}"
   - ANY species from a different genus MUST BE REMOVED - NO EXCEPTIONS
   - Example: If genus is "Andira", then "Bowdichia virgilioides" must be REMOVED because "Bowdichia" ≠ "Andira"`);
          }
          if (refineOptions.validateFamily) {
            removalCriteria.push(`FAMILY FILTER: The species MUST belong to family "${refineOptions.validateFamily}"`);
            validationRules.push(`RULE 3B - FAMILY RESTRICTION (STRICT):
   - ONLY species of family "${refineOptions.validateFamily}" are allowed
   - Check the taxonomic classification of each species
   - ANY species from a different family MUST BE REMOVED - NO EXCEPTIONS`);
          }
        }
        
        if (refineOptions.validateCheckGeography && refineOptions.validateScope !== 'global') {
          const geoDetails: string[] = [];
          if (refineOptions.validateScope === 'national') {
            geoDetails.push('Brazil (native or naturalized species only)');
          }
          if (refineOptions.validateBiome) {
            geoDetails.push(`Biome: ${refineOptions.validateBiome}`);
          }
          if (refineOptions.validateStateUF) {
            geoDetails.push(`State: ${refineOptions.validateStateUF}, Brazil`);
          }
          const geoScope = geoDetails.join(', ');
          removalCriteria.push(`GEOGRAPHIC FILTER: The species MUST occur in ${geoScope}`);
          validationRules.push(`RULE 4 - GEOGRAPHIC RESTRICTION (STRICT):
   - ONLY species that NATURALLY OCCUR in ${geoScope} are allowed
   - Check the species distribution according to ${catalogName}
   - Species that DO NOT OCCUR in this geographic area MUST BE REMOVED
   - Be strict: if uncertain about distribution, REMOVE the species`);
        }

        const validatePrompt = `You are a strict taxonomic validation expert. Your task is to validate a species list and REMOVE any species that do not meet ALL criteria.

═══════════════════════════════════════════════════════════════════════
SPECIES LIST TO VALIDATE (${project.entities.length} total):
═══════════════════════════════════════════════════════════════════════
${entityList}

═══════════════════════════════════════════════════════════════════════
MANDATORY REMOVAL CRITERIA - Species MUST be REMOVED if they fail ANY:
═══════════════════════════════════════════════════════════════════════
${removalCriteria.length > 0 ? removalCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None specified'}

═══════════════════════════════════════════════════════════════════════
VALIDATION RULES (apply in order):
═══════════════════════════════════════════════════════════════════════
${validationRules.join('\n\n')}

═══════════════════════════════════════════════════════════════════════
REFERENCE: ${catalogName}
═══════════════════════════════════════════════════════════════════════

CRITICAL INSTRUCTIONS:
1. BE STRICT - When in doubt, REMOVE the species
2. ${refineOptions.validateGenus ? `GENUS CHECK: Every species MUST have "${refineOptions.validateGenus}" as the first word of its scientific name. Remove ALL others.` : ''}
3. ${refineOptions.validateFamily ? `FAMILY CHECK: Every species MUST belong to family "${refineOptions.validateFamily}". Remove ALL others.` : ''}
4. DO NOT include species that fail ANY of the removal criteria
5. Preserve ALL existing data for species that pass validation (traits, description, links, imageUrl)
6. Return ONLY the entities that PASS ALL validation criteria`;

        setManualPrompt(validatePrompt);
        
        // Open prompt editor - user can review/edit then click Generate to execute
        setShowAiModal(false);
        setShowPromptEditor(true);
        setIsGenerating(false);
        // Don't execute automatically - let user review prompt and click Generate in the modal
        
        return;
      }

      // Other refine actions use Gemini - with typing effect
      const refinePrompt = buildRefinePrompt();
      setManualPrompt(refinePrompt);
      
      // Open prompt editor - user can review/edit then click Generate to execute
      setShowAiModal(false);
      setShowPromptEditor(true);
      // Don't execute automatically - let user review prompt and click Generate in the modal
      // The modal's Generate button calls handleSendManualPrompt which uses the (possibly edited) manualPrompt
      setIsGenerating(false);
      return;
    } catch (e) {
      console.error(e);
      // Stop typing and show error
      stopTypingEffect();
      setAiTypingText(prev => prev + (language === 'pt' 
        ? "\n\n❌ ERRO: Não foi possível refinar a chave."
        : "\n\n❌ ERROR: Could not refine the key."));
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(strings.errGen);
      setShowPromptEditor(false);
    } finally {
      setIsGenerating(false);
      setGeneratingMessage('');
    }
  };

  const handleOpenPromptEditor = async () => {
    try {
      // Handle REFINE mode
      if (aiMode === 'REFINE') {
        if (project.entities.length === 0) {
          alert(language === 'pt' ? 'Carregue um projeto primeiro.' : 'Load a project first.');
          return;
        }
        const refinePrompt = buildRefinePrompt();
        setManualPrompt(refinePrompt);
        setShowPromptEditor(true);
        setShowAiModal(false);
        return;
      }

      let config = { ...aiConfig };

      if (aiMode === 'IMPORT' && importedFile) {
        const base64Data = await convertFileToBase64(importedFile);
        config.importedFile = {
          data: base64Data,
          mimeType: importedFile.type
        };
        config.topic = `Imported: ${importedFile.name}`;
      } else if (aiMode === 'TOPIC') {
        if (!config.topic.trim()) {
          alert("Please enter a topic first.");
          return;
        }
        config.importedFile = undefined;
      }

      const { systemInstruction, prompt } = buildPromptData(config);
      const fullText = `SYSTEM:\n${systemInstruction}\n\nUSER PROMPT:\n${prompt}`;

      setManualPrompt(fullText);
      setShowPromptEditor(true);
      setShowAiModal(false);
    } catch (e) {
      console.error("Failed to build prompt", e);
    }
  };

  const handleSendManualPrompt = async () => {
    if (!apiKey) {
      alert(strings.missingKey);
      return;
    }
    setIsGenerating(true);
    // Don't close the modal - keep it open to show typing effect
    setShowPromptEditor(true);
    
    // Start the typing effect immediately
    startTypingEffect();

    try {
      let resultProject: Project;
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // Use optimized refine function when in refine mode
      // ═══════════════════════════════════════════════════════════════════════════════
      if (currentRefineMode && project.entities.length > 0) {
        // Use the new optimized refine function
        resultProject = await refineExistingProject(
          manualPrompt, 
          project, 
          apiKey, 
          aiConfig.model, 
          language, 
          currentRefineMode
        );

        // ═══════════════════════════════════════════════════════════════════════════════
        // AUTO-FETCH IMAGES FOR NEW ENTITIES (Expand Mode)
        // ═══════════════════════════════════════════════════════════════════════════════
        if (currentRefineMode === 'expand') {
          const originalNames = new Set(project.entities.map(e => e.name.toLowerCase()));
          const newEntities = resultProject.entities.filter(e => !originalNames.has(e.name.toLowerCase()));
          
          if (newEntities.length > 0) {
            const msg = language === 'pt'
              ? `\n\n🔍 Detectadas ${newEntities.length} novas entidades. Buscando imagens automaticamente...`
              : `\n\n🔍 Detected ${newEntities.length} new entities. Automatically fetching images...`;
            setAiTypingText(prev => prev + msg);
            
            const entitiesToFetch = newEntities.map(e => ({ name: e.name, scientificName: e.name }));
            
            try {
              const imageMap = await fetchImagesForEntities(
                entitiesToFetch,
                language,
                (current, total, entityName) => {
                  setAiTypingText(prev => prev + `\n📷 ${entityName}...`);
                },
                aiConfig.category
              );
              
              resultProject.entities = resultProject.entities.map(entity => {
                if (!originalNames.has(entity.name.toLowerCase())) {
                  const newUrl = imageMap.get(entity.name);
                  if (newUrl) return { ...entity, imageUrl: newUrl };
                }
                return entity;
              });
              
              const foundCount = Array.from(imageMap.values()).filter(url => url).length;
              const resultMsg = language === 'pt'
                ? `\n✅ Imagens encontradas: ${foundCount}/${newEntities.length}`
                : `\n✅ Images found: ${foundCount}/${newEntities.length}`;
              setAiTypingText(prev => prev + resultMsg);
            } catch (err) {
              console.error("Error auto-fetching images:", err);
              setAiTypingText(prev => prev + (language === 'pt' ? `\n⚠️ Erro na busca de imagens.` : `\n⚠️ Error fetching images.`));
            }
          }
        }
        
        // Show success message
        const successMsg = language === 'pt'
          ? `\n\n✅ Operação concluída! ${resultProject.entities.length} entidades processadas.`
          : `\n\n✅ Operation complete! ${resultProject.entities.length} entities processed.`;
        setAiTypingText(prev => prev + successMsg);
        
        // Clear refine mode
        setCurrentRefineMode(null);
      } else if (refineAction === 'VALIDATE' && project.entities.length > 0) {
        // Use optimized validate function
        resultProject = await validateTaxonomy(
          manualPrompt,
          project,
          apiKey,
          aiConfig.model,
          language
        );
        
        const successMsg = language === 'pt'
          ? `\n\n✅ Validação concluída! ${resultProject.entities.length} entidades mantidas.`
          : `\n\n✅ Validation complete! ${resultProject.entities.length} entities kept.`;
        setAiTypingText(prev => prev + successMsg);
      } else {
        // Standard generation (new key or non-refine operation)
        const generatedProject = await generateKeyFromCustomPrompt(manualPrompt, apiKey, aiConfig.model, language);
        
        // VALIDATION: Check if AI response is valid
        const isValidResponse = generatedProject && 
          generatedProject.entities && 
          generatedProject.entities.length > 0 &&
          generatedProject.features &&
          generatedProject.features.length > 0;
        
        if (!isValidResponse) {
          console.error("[handleSendManualPrompt] AI returned invalid/empty response:", generatedProject);
          stopTypingEffect();
          const errorMsg = language === 'pt' 
            ? "\n\n❌ ERRO: A IA retornou uma resposta vazia ou inválida. Os dados originais foram preservados. Tente novamente."
            : "\n\n❌ ERROR: AI returned empty or invalid response. Original data preserved. Please try again.";
          setAiTypingText(prev => prev + errorMsg);
          await new Promise(resolve => setTimeout(resolve, 3000));
          setShowPromptEditor(false);
          return;
        }
        
        // Check for significant data loss when refining
        if (project.entities.length > 0) {
          const existingTraitCount = project.entities.reduce((sum, e) => 
            sum + Object.values(e.traits).reduce((tSum, states) => tSum + states.length, 0), 0);
          const newTraitCount = generatedProject.entities.reduce((sum, e) => 
            sum + Object.values(e.traits).reduce((tSum, states) => tSum + states.length, 0), 0);
          
          if (existingTraitCount > 10 && newTraitCount < existingTraitCount * 0.3) {
            console.warn(`[handleSendManualPrompt] WARNING: Significant trait loss detected! Existing: ${existingTraitCount}, New: ${newTraitCount}`);
            const warningMsg = language === 'pt'
              ? `\n\n⚠️ AVISO: Detectada possível perda de dados (${existingTraitCount} → ${newTraitCount} traits). Preservando dados originais.`
              : `\n\n⚠️ WARNING: Possible data loss detected (${existingTraitCount} → ${newTraitCount} traits). Preserving original data.`;
            setAiTypingText(prev => prev + warningMsg);
          }
        }
        
        // Merge with existing project to preserve images, links, and other data
        resultProject = project.entities.length > 0 
          ? mergeProjectsPreservingData(generatedProject, project)
          : generatedProject;
        
        // Safety check: if merge returned original project, inform user
        if (resultProject === project) {
          const preservedMsg = language === 'pt'
            ? "\n\n🛡️ Dados originais foram preservados devido a resposta incompleta da IA."
            : "\n\n🛡️ Original data was preserved due to incomplete AI response.";
          setAiTypingText(prev => prev + preservedMsg);
        }
      }
      
      // Stop typing effect and show summary
      stopTypingEffect(resultProject);
      
      // Wait a moment so user can see the summary
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProject(resultProject);
      setActiveTab('MATRIX');
      setShowPromptEditor(false);
    } catch (e: any) {
      console.error(e);
      // Stop typing and show error with specific message based on error type
      stopTypingEffect();
      
      // Clear refine mode on error
      setCurrentRefineMode(null);
      
      const errorMessage = e?.message || String(e);
      let userErrorMessage: string;
      
      if (errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE')) {
        userErrorMessage = language === 'pt'
          ? "\n\n❌ ERRO: O serviço de IA está sobrecarregado no momento. Por favor, aguarde alguns minutos e tente novamente."
          : "\n\n❌ ERROR: AI service is currently overloaded. Please wait a few minutes and try again.";
      } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        userErrorMessage = language === 'pt'
          ? "\n\n❌ ERRO: Limite de requisições atingido. Por favor, aguarde um momento e tente novamente."
          : "\n\n❌ ERROR: Rate limit reached. Please wait a moment and try again.";
      } else if (errorMessage.includes('401') || errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        userErrorMessage = language === 'pt'
          ? "\n\n❌ ERRO: Chave de API inválida ou expirada. Por favor, verifique sua chave nas configurações."
          : "\n\n❌ ERROR: Invalid or expired API key. Please check your key in settings.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
        userErrorMessage = language === 'pt'
          ? "\n\n❌ ERRO: Falha na conexão. Verifique sua internet e tente novamente."
          : "\n\n❌ ERROR: Connection failed. Check your internet and try again.";
      } else {
        userErrorMessage = language === 'pt'
          ? "\n\n❌ ERRO: Não foi possível gerar a chave. Por favor, tente novamente."
          : "\n\n❌ ERROR: Could not generate the key. Please try again.";
      }
      
      setAiTypingText(prev => prev + userErrorMessage);
      await new Promise(resolve => setTimeout(resolve, 3000));
      // Don't show alert - the error is already displayed in the typing area
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClosePromptEditor = () => {
    // Reset generation state when closing
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setIsGenerating(false);
    setGeneratingMessage('');
    setAiTypingText('');
    setAiTypingComplete(false);
    setShowPromptEditor(false);
    setPendingNervuraFile(null); // Clear staged Nervura file
    setPendingImportProject(null); // Clear pending import
    setShowAiModal(true);
  };

  const addFeature = () => {
    const newFeature: Feature = {
      id: Math.random().toString(36).substr(2, 9),
      name: language === 'pt' ? "Nova Característica" : "New Feature",
      imageUrl: "",
      states: [{ id: Math.random().toString(36).substr(2, 9), label: language === 'pt' ? "Estado 1" : "State 1" }]
    };
    // Add to the beginning of the list so user can see and edit immediately
    setProject(p => ({ ...p, features: [newFeature, ...p.features] }));
  };

  const addEntity = () => {
    const newEntity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      name: language === 'pt' ? "Nova Entidade" : "New Entity",
      description: "...",
      links: [],
      traits: {}
    };
    // Add to the beginning of the list so user can see and edit immediately
    setProject(p => ({ ...p, entities: [newEntity, ...p.entities] }));
  };

  const toggleTrait = (entityId: string, featureId: string, stateId: string) => {
    setProject(p => {
      const entities = p.entities.map(e => {
        if (e.id !== entityId) return e;
        const currentTraits = e.traits[featureId] || [];
        const hasTrait = currentTraits.includes(stateId);
        let newTraits;
        if (hasTrait) {
          newTraits = currentTraits.filter(id => id !== stateId);
        } else {
          newTraits = [...currentTraits, stateId];
        }
        return { ...e, traits: { ...e.traits, [featureId]: newTraits } };
      });
      return { ...p, entities };
    });
  };

  // Helper to determine detail level label
  const getDetailLabel = (level: number) => {
    if (level === 1) return strings.detailSimple;
    if (level === 3) return strings.detailExpert;
    // For import, 2 is "Original Fidelity", for Topic it's "Balanced"
    return aiMode === 'IMPORT' ? strings.detailOriginal : strings.detailBalanced;
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans absolute inset-0">
      {/* Builder Header */}
      <div className="border-b px-4 py-3 flex justify-between items-center bg-slate-900 text-white shadow-md z-30 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            <Menu size={24} />
          </button>

          <h2 className="text-base md:text-xl font-bold flex items-center gap-2 truncate">
            <span className="bg-emerald-500 text-[10px] md:text-xs text-white px-2 py-1 rounded uppercase tracking-wider shadow-sm hidden sm:inline-block">{strings.builder}</span>
            <span className="truncate max-w-[150px] md:max-w-[300px]">{project.name}</span>
          </h2>

          <div className="h-6 w-px bg-slate-700 mx-2 hidden md:block"></div>

          {/* Desktop File Menu */}
          <div className="hidden md:flex items-center gap-1 text-sm">
            <button onClick={saveToLocal} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title={strings.save}>
              <Save size={14} /> <span className="hidden sm:inline">{strings.save}</span>
            </button>
            <button onClick={() => setShowLoadModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title={strings.open}>
              <FolderOpen size={14} /> <span className="hidden sm:inline">{strings.open}</span>
            </button>
            <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title={strings.export}>
              <Download size={14} /> <span className="hidden sm:inline">{strings.export}</span>
            </button>
            <button onClick={exportXLSX} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title={strings.exportXLSX}>
              <FileSpreadsheet size={14} /> <span className="hidden sm:inline">{strings.exportXLSX}</span>
            </button>
            <button onClick={exportHTML} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title={strings.exportHTML}>
              <FileCode size={14} /> <span className="hidden sm:inline">{strings.exportHTML}</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white cursor-pointer" title={strings.import}>
              <Upload size={14} /> <span className="hidden sm:inline">{strings.import}</span>
              <input type="file" accept=".json,.xlsx,.xls,.csv" onChange={importJSON} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex gap-2 md:gap-3">
          {/* Nozes IA Button */}
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white rounded-lg transition-all shadow-lg shadow-amber-900/30 text-xs md:text-sm font-bold border border-amber-400/20 group"
          >
            <Brain size={16} className="text-white fill-white/20 group-hover:scale-110 transition-transform" /> <span className="hidden sm:inline">{strings.aiWizard}</span><span className="sm:hidden">IA</span>
          </button>

          <button onClick={() => onSave(project)} className="flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all text-xs md:text-sm font-semibold shadow-lg shadow-emerald-900/30 text-white">
            <Play size={16} /> <span className="hidden sm:inline">{strings.savePlay}</span>
          </button>
          <button onClick={onCancel} className="px-2 py-1.5 md:px-4 md:py-2 text-slate-400 hover:text-white transition-colors text-xs md:text-sm font-medium">
            <X size={20} className="md:hidden" /> <span className="hidden md:inline">{strings.exit}</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden bg-slate-800 text-slate-200 border-b border-slate-700 p-2 grid grid-cols-5 gap-2 text-xs font-medium z-20">
          <button onClick={() => { saveToLocal(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <Save size={18} /> {strings.save}
          </button>
          <button onClick={() => { setShowLoadModal(true); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <FolderOpen size={18} /> {strings.open}
          </button>
          <button onClick={() => { exportJSON(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <Download size={18} /> JSON
          </button>
          <button onClick={() => { exportXLSX(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <FileSpreadsheet size={18} /> XLSX
          </button>
          <button onClick={() => { exportHTML(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <FileCode size={18} /> HTML
          </button>
          <label className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded cursor-pointer col-span-5">
            <Upload size={18} /> {strings.import}
            <input type="file" accept=".json,.xlsx,.xls,.csv" onChange={importJSON} className="hidden" />
          </label>
        </div>
      )}

      {/* Tabs - Scrollable on mobile */}
      <div className="flex border-b bg-white overflow-x-auto whitespace-nowrap shrink-0">
        {[
          { id: 'GENERAL', label: strings.general, icon: Box },
          { id: 'FEATURES', label: strings.features, icon: LayoutList },
          { id: 'ENTITIES', label: strings.entities, icon: Grid },
          { id: 'MATRIX', label: strings.matrix, icon: CheckSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-3 md:py-4 text-xs md:text-sm font-medium transition-all border-b-2 relative top-[2px] min-w-fit ${activeTab === tab.id
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-slate-50 p-4 md:p-6 pb-20 md:pb-6">
        <div className={`mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${activeTab === 'MATRIX' ? 'max-w-none' : 'max-w-6xl'}`}>
          {/* ... (Previous Tab Content unchanged) ... */}
          {activeTab === 'GENERAL' && (
            <div className="p-6 md:p-8 space-y-8 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">{strings.general}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{strings.projectName}</label>
                    <input
                      value={project.name}
                      onChange={e => updateProject({ name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{strings.description}</label>
                    <textarea
                      value={project.description}
                      onChange={e => updateProject({ description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all h-32 text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'FEATURES' && (
            <div className="p-4 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{strings.definedFeatures}</h3>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        {project.features.length} {language === 'pt' ? 'car.' : 'feat.'}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        {project.features.reduce((acc, f) => acc + f.states.length, 0)} {language === 'pt' ? 'estados' : 'states'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-slate-500">{strings.definedFeaturesDesc}</p>
                </div>
                <button onClick={addFeature} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow-md transition-all">
                  <Plus size={16} /> <span className="hidden sm:inline">{strings.addFeature}</span>
                </button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {project.features.map((feature, fIdx) => (
                  <div key={feature.id} className="border border-slate-200 rounded-xl p-5 bg-white relative group hover:border-emerald-300 hover:shadow-md transition-all">
                    <button
                      className="absolute top-3 right-3 text-slate-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                      onClick={() => {
                        const newFeatures = project.features.filter(f => f.id !== feature.id);
                        setProject(p => ({ ...p, features: newFeatures }));
                      }}
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="mb-4 space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{strings.featureName}</label>
                      <input
                        value={feature.name}
                        onChange={(e) => {
                          const newFeatures = [...project.features];
                          newFeatures[fIdx].name = e.target.value;
                          setProject(p => ({ ...p, features: newFeatures }));
                        }}
                        className="font-bold text-lg text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none w-full pb-1"
                      />
                      <div className="flex items-center gap-2">
                        <ImageIcon size={14} className="text-slate-400" />
                        <input
                          value={feature.imageUrl || ""}
                          onChange={(e) => {
                            const newFeatures = [...project.features];
                            newFeatures[fIdx].imageUrl = e.target.value;
                            setProject(p => ({ ...p, features: newFeatures }));
                          }}
                          className="text-xs flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-emerald-400"
                          placeholder={strings.imageURL}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pl-3 border-l-2 border-slate-100">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{strings.states}</label>
                      {feature.states.map((state, sIdx) => {
                        const isEditingImage = editingStateImageUrl?.featureId === feature.id && editingStateImageUrl?.stateId === state.id;

                        return (
                          <div key={state.id} className="group/state">
                            <div className="flex items-center gap-2">
                              {/* State image thumbnail / placeholder */}
                              {state.imageUrl ? (
                                <button
                                  onClick={() => setExpandedStateImage({ url: state.imageUrl!, label: state.label, featureName: feature.name })}
                                  className="w-6 h-6 rounded overflow-hidden border border-slate-200 hover:border-emerald-400 transition-colors shrink-0"
                                  title={strings.viewImage}
                                >
                                  <img src={state.imageUrl} alt={state.label} className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-focus-within/state:bg-emerald-400 shrink-0"></div>
                              )}
                              <input
                                value={state.label}
                                onChange={(e) => {
                                  const newFeatures = [...project.features];
                                  newFeatures[fIdx].states[sIdx].label = e.target.value;
                                  setProject(p => ({ ...p, features: newFeatures }));
                                }}
                                className="text-sm bg-transparent outline-none flex-1 text-slate-600 focus:text-slate-900 focus:font-medium"
                              />
                              {/* Button to show/hide the inline image URL input */}
                              {!isEditingImage && ( // Only show this button if not currently editing
                                <button
                                  onClick={() => setEditingStateImageUrl({ featureId: feature.id, stateId: state.id })}
                                  className={`${state.imageUrl ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-500'} md:opacity-0 group-hover/state:opacity-100 transition-opacity`}
                                  title={state.imageUrl ? strings.stateImage : strings.addStateImage} // Title already exists
                                >
                                  <ImageIcon size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const newFeatures = [...project.features];
                                  newFeatures[fIdx].states = newFeatures[fIdx].states.filter(s => s.id !== state.id);
                                  setProject(p => ({ ...p, features: newFeatures }));
                                }}
                                className="text-slate-300 hover:text-red-400 md:opacity-0 group-hover/state:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            {/* Inline Image URL Input */}
                            {isEditingImage && (
                              <div className="ml-8 mt-1 flex items-center gap-2">
                                <input
                                  value={state.imageUrl || ""}
                                  onChange={(e) => {
                                    const newFeatures = [...project.features];
                                    newFeatures[fIdx].states[sIdx].imageUrl = e.target.value || undefined;
                                    setProject(p => ({ ...p, features: newFeatures }));
                                  }}
                                  onBlur={() => setEditingStateImageUrl(null)} // Hide on blur
                                  className="text-[10px] w-full text-slate-400 bg-slate-50 rounded px-2 py-0.5 outline-none focus:bg-white focus:text-slate-600 border border-transparent focus:border-slate-200"
                                  placeholder="URL..."
                                  autoFocus // Automatically focus when it appears
                                />
                                <button
                                  onClick={() => {
                                    const newFeatures = [...project.features];
                                    newFeatures[fIdx].states[sIdx].imageUrl = undefined; // Clear image
                                    setProject(p => ({ ...p, features: newFeatures }));
                                    setEditingStateImageUrl(null); // Hide input
                                  }}
                                  className="text-slate-400 hover:text-red-400"
                                  title={strings.clearImage}
                                >
                                  <Trash2 size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingStateImageUrl(null)} // Just hide input
                                  className="text-slate-400 hover:text-slate-500"
                                  title={strings.closeImage}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                            {/* Existing Image URL (Read-only if not editing and URL exists) */}
                            {!isEditingImage && state.imageUrl && (
                                <div className="ml-8 mt-1">
                                    <span className="text-[10px] w-full text-slate-400 truncate block">{state.imageUrl}</span>
                                </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const newFeatures = [...project.features];
                          newFeatures[fIdx].states.push({ id: Math.random().toString(36).substr(2, 9), label: "..." });
                          setProject(p => ({ ...p, features: newFeatures }));
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-3 flex items-center gap-1 bg-emerald-50 w-fit px-2 py-1 rounded"
                      >
                        <Plus size={10} /> {strings.addState}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ENTITIES' && (
            <div className="p-4 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{strings.manageEntities}</h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                      {hasActiveFilters 
                        ? `${filteredEntities.length} ${strings.ofEntities} ${project.entities.length}`
                        : `${project.entities.length} ${language === 'pt' ? 'entidades' : 'entities'}`
                      }
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-500">{strings.manageEntitiesDesc}</p>
                </div>
                <button onClick={addEntity} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow-md transition-all">
                  <Plus size={16} /> <span className="hidden sm:inline">{strings.addEntity}</span>
                </button>
              </div>
              
              {/* Filter Bar */}
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={entityFilter.searchText}
                        onChange={(e) => setEntityFilter(prev => ({ ...prev, searchText: e.target.value }))}
                        placeholder={strings.searchPlaceholder}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  
                  {/* Family Filter */}
                  {uniqueFamilies.length > 0 && (
                    <select
                      value={entityFilter.family}
                      onChange={(e) => setEntityFilter(prev => ({ ...prev, family: e.target.value }))}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-emerald-500 outline-none min-w-[150px]"
                    >
                      <option value="">{strings.allFamilies}</option>
                      {uniqueFamilies.map(family => (
                        <option key={family} value={family}>{family}</option>
                      ))}
                    </select>
                  )}
                  
                  {/* Genus Filter */}
                  {uniqueGenera.length > 0 && (
                    <select
                      value={entityFilter.genus}
                      onChange={(e) => setEntityFilter(prev => ({ ...prev, genus: e.target.value }))}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-emerald-500 outline-none min-w-[150px]"
                    >
                      <option value="">{strings.allGenera}</option>
                      {uniqueGenera.map(genus => (
                        <option key={genus} value={genus}>{genus}</option>
                      ))}
                    </select>
                  )}
                  
                  {/* Only With Gaps Filter */}
                  {project.features.length > 0 && (
                    <label 
                      className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-colors ${
                        entityFilter.onlyWithGaps 
                          ? 'bg-amber-50 border-amber-300 text-amber-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={strings.onlyWithGapsDesc}
                    >
                      <input
                        type="checkbox"
                        checked={entityFilter.onlyWithGaps}
                        onChange={(e) => setEntityFilter(prev => ({ ...prev, onlyWithGaps: e.target.checked }))}
                        className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                      />
                      <span className="whitespace-nowrap">{strings.onlyWithGaps}</span>
                    </label>
                  )}
                  
                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearEntityFilters}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <X size={14} />
                      {strings.clearFilters}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {filteredEntities.map((entity) => {
                  const eIdx = project.entities.findIndex(e => e.id === entity.id);
                  return (
                  <div key={entity.id} className="flex flex-col sm:flex-row gap-6 items-start border border-slate-200 p-4 md:p-6 rounded-xl bg-white hover:shadow-md transition-shadow">
                    <div className="w-full sm:w-48 space-y-2 flex-shrink-0">
                      <div className="aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        {entity.imageUrl ? (
                          <img src={entity.imageUrl} className="w-full h-full object-cover" alt="preview" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={32} />
                          </div>
                        )}
                      </div>
                      <input
                        value={entity.imageUrl || ""}
                        onChange={(e) => {
                          const newEntities = [...project.entities];
                          newEntities[eIdx].imageUrl = e.target.value;
                          setProject(p => ({ ...p, entities: newEntities }));
                        }}
                        className="text-xs w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded outline-none focus:border-emerald-500 text-slate-600"
                        placeholder={strings.imageURL}
                      />
                      <button
                        onClick={() => setEditingEntityId(entity.id)}
                        className="w-full flex items-center justify-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 md:py-2 rounded-lg font-medium transition-colors border border-slate-200"
                      >
                        <Edit3 size={12} /> {strings.editTraits}
                      </button>
                    </div>

                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex justify-between items-start gap-2">
                        <input
                          value={entity.name}
                          onChange={(e) => {
                            const newEntities = [...project.entities];
                            newEntities[eIdx].name = e.target.value;
                            setProject(p => ({ ...p, entities: newEntities }));
                          }}
                          className="text-xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none w-full pb-1 text-slate-800"
                        />
                        <button
                          onClick={() => {
                            const newEntities = project.entities.filter(e => e.id !== entity.id);
                            setProject(p => ({ ...p, entities: newEntities }));
                          }}
                          className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      {/* Scientific Name & Family Row */}
                      <div className="flex gap-3 flex-wrap md:flex-nowrap">
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs text-slate-400 block mb-1">{language === 'pt' ? 'Nome Científico' : 'Scientific Name'}</label>
                          <input
                            value={entity.scientificName || ''}
                            onChange={(e) => {
                              const newEntities = [...project.entities];
                              newEntities[eIdx].scientificName = e.target.value;
                              setProject(p => ({ ...p, entities: newEntities }));
                            }}
                            placeholder={language === 'pt' ? 'Ex: Panthera leo' : 'e.g., Panthera leo'}
                            className="text-sm italic text-slate-600 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 w-full outline-none rounded-lg px-3 py-2 transition-colors"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-xs text-slate-400 block mb-1">{language === 'pt' ? 'Família' : 'Family'}</label>
                          <input
                            value={entity.family || ''}
                            onChange={(e) => {
                              const newEntities = [...project.entities];
                              newEntities[eIdx].family = e.target.value;
                              setProject(p => ({ ...p, entities: newEntities }));
                            }}
                            placeholder={language === 'pt' ? 'Ex: Felidae' : 'e.g., Felidae'}
                            className="text-sm text-slate-600 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 w-full outline-none rounded-lg px-3 py-2 transition-colors"
                          />
                        </div>
                      </div>

                      <textarea
                        value={entity.description}
                        onChange={(e) => {
                          const newEntities = [...project.entities];
                          newEntities[eIdx].description = e.target.value;
                          setProject(p => ({ ...p, entities: newEntities }));
                        }}
                        className="text-sm text-slate-600 bg-slate-50 border border-transparent focus:bg-white focus:border-emerald-500 w-full h-24 outline-none resize-none rounded-lg p-3 transition-colors"
                      />

                      {/* Links Section */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <LinkIcon size={12} /> {strings.links}
                        </h5>
                        <div className="space-y-2">
                          {(entity.links || []).map((link, lIdx) => (
                            <div key={link.id || lIdx} className="flex gap-2">
                              <input
                                placeholder="Label"
                                value={link.label}
                                onChange={(e) => {
                                  const newEntities = [...project.entities];
                                  if (!newEntities[eIdx].links) newEntities[eIdx].links = [];
                                  newEntities[eIdx].links[lIdx].label = e.target.value;
                                  setProject(p => ({ ...p, entities: newEntities }));
                                }}
                                className="text-xs flex-1 px-2 py-1 border border-slate-200 rounded outline-none focus:border-emerald-400"
                              />
                              <input
                                placeholder="URL"
                                value={link.url}
                                onChange={(e) => {
                                  const newEntities = [...project.entities];
                                  if (!newEntities[eIdx].links) newEntities[eIdx].links = [];
                                  newEntities[eIdx].links[lIdx].url = e.target.value;
                                  setProject(p => ({ ...p, entities: newEntities }));
                                }}
                                className="text-xs flex-[2] px-2 py-1 border border-slate-200 rounded outline-none focus:border-emerald-400"
                              />
                              <button
                                onClick={() => {
                                  const newEntities = [...project.entities];
                                  if (!newEntities[eIdx].links) newEntities[eIdx].links = [];
                                  newEntities[eIdx].links = newEntities[eIdx].links.filter((_, i) => i !== lIdx);
                                  setProject(p => ({ ...p, entities: newEntities }));
                                }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newEntities = [...project.entities];
                              if (!newEntities[eIdx].links) newEntities[eIdx].links = [];
                              newEntities[eIdx].links.push({ id: Math.random().toString(36).substr(2, 9), label: '', url: '' });
                              setProject(p => ({ ...p, entities: newEntities }));
                            }}
                            className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            <Plus size={12} /> {strings.addLink}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'MATRIX' && (
            <div className="flex flex-col h-full bg-slate-50 min-h-[500px]">
              <div className="p-4 border-b bg-white">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700">{strings.scoringMatrix}</h3>
                    {hasActiveFilters && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                        {filteredEntities.length} {strings.ofEntities} {project.entities.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 hidden sm:inline">{strings.scoringMatrixDesc}</span>
                    {/* Navigation Arrows */}
                    {project.features.length > 1 && (
                      <div className="flex gap-1 border-l pl-2 ml-2">
                        <button
                          onClick={() => navigateFeature('prev')}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-600"
                          title="Característica Anterior"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => navigateFeature('next')}
                          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-600"
                          title="Próxima Característica"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Entity Filter Bar for Matrix */}
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[150px] max-w-[250px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={entityFilter.searchText}
                      onChange={(e) => setEntityFilter(prev => ({ ...prev, searchText: e.target.value }))}
                      placeholder={strings.searchPlaceholder}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-emerald-500 outline-none"
                    />
                  </div>
                  
                  {/* Family Filter */}
                  {uniqueFamilies.length > 0 && (
                    <select
                      value={entityFilter.family}
                      onChange={(e) => setEntityFilter(prev => ({ ...prev, family: e.target.value }))}
                      className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-emerald-500 outline-none"
                    >
                      <option value="">{strings.allFamilies}</option>
                      {uniqueFamilies.map(family => (
                        <option key={family} value={family}>{family}</option>
                      ))}
                    </select>
                  )}
                  
                  {/* Genus Filter */}
                  {uniqueGenera.length > 0 && (
                    <select
                      value={entityFilter.genus}
                      onChange={(e) => setEntityFilter(prev => ({ ...prev, genus: e.target.value }))}
                      className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-emerald-500 outline-none"
                    >
                      <option value="">{strings.allGenera}</option>
                      {uniqueGenera.map(genus => (
                        <option key={genus} value={genus}>{genus}</option>
                      ))}
                    </select>
                  )}
                  
                  {/* Only With Gaps Filter */}
                  {project.features.length > 0 && (
                    <label 
                      className={`flex items-center gap-1.5 px-2 py-1.5 text-xs border rounded-lg cursor-pointer transition-colors ${
                        entityFilter.onlyWithGaps 
                          ? 'bg-amber-50 border-amber-300 text-amber-700' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                      title={strings.onlyWithGapsDesc}
                    >
                      <input
                        type="checkbox"
                        checked={entityFilter.onlyWithGaps}
                        onChange={(e) => setEntityFilter(prev => ({ ...prev, onlyWithGaps: e.target.checked }))}
                        className="w-3.5 h-3.5 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                      />
                      <span className="whitespace-nowrap">{strings.onlyWithGaps}</span>
                    </label>
                  )}
                  
                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearEntityFilters}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X size={12} />
                      {strings.clearFilters}
                    </button>
                  )}
                </div>
                
                {/* Feature Navigation Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {project.features.map((feature, idx) => (
                    <button
                      key={feature.id}
                      onClick={() => toggleFeatureExpansion(feature.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        expandedFeatureId === feature.id
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {feature.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 relative">
                {/* Matrix Container */}
                <div ref={matrixScrollRef} className="absolute inset-0 overflow-auto custom-scrollbar">
                  <table className="border-collapse w-max">
                    {/* Header */}
                    <thead className="sticky top-0 z-40">
                      {/* Row 1: Feature Names */}
                      <tr className="bg-gradient-to-r from-slate-800 to-slate-900">
                        <th 
                          rowSpan={2} 
                          className="sticky left-0 z-50 bg-gradient-to-br from-slate-800 to-slate-900 text-white px-3 py-2 font-bold border-r border-b border-slate-600 text-left align-bottom"
                          style={{ minWidth: '180px', maxWidth: '180px' }}
                        >
                          <span className="text-xs font-semibold tracking-wide">{strings.taxaFeatures}</span>
                        </th>
                        
                        {project.features.map((feature) => {
                          const isExpanded = expandedFeatureId === feature.id;
                          const colCount = isExpanded ? feature.states.length : 1;
                          
                          return (
                            <th
                              key={`header-${feature.id}`}
                              colSpan={colCount}
                              className={`px-1 py-1.5 font-semibold border-r border-b text-center align-middle cursor-pointer transition-all duration-200 ${
                                isExpanded 
                                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-400 text-white shadow-lg' 
                                  : 'bg-gradient-to-b from-slate-600 to-slate-700 border-slate-500 text-slate-100 hover:from-slate-500 hover:to-slate-600'
                              }`}
                              style={{ minWidth: isExpanded ? `${colCount * 80}px` : '60px' }}
                              onClick={() => toggleFeatureExpansion(feature.id)}
                              title={feature.name}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {isExpanded && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedFeatureId(null);
                                    }}
                                    className="p-0.5 hover:bg-emerald-400/50 rounded transition-colors flex-shrink-0"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                                <span className={`font-semibold leading-tight ${isExpanded ? 'text-[10px]' : 'text-[9px]'}`}>
                                  {feature.name}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                      
                      {/* Row 2: State Labels or Expand Info */}
                      <tr>
                        {project.features.map((feature) => {
                          const isExpanded = expandedFeatureId === feature.id;
                          
                          if (isExpanded) {
                            return feature.states.map((state) => (
                              <th
                                key={`state-${state.id}`}
                                className="bg-gradient-to-b from-emerald-600 to-emerald-700 text-white px-1 py-1.5 border-r border-b border-emerald-500 text-center align-top"
                                style={{ minWidth: '80px', maxWidth: '100px' }}
                                title={state.label}
                              >
                                <div className="text-[8px] font-medium leading-snug px-0.5 break-words" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                                  {state.label}
                                </div>
                              </th>
                            ));
                          } else {
                            return (
                              <th
                                key={`expand-${feature.id}`}
                                className="bg-gradient-to-b from-slate-500 to-slate-600 text-slate-200 px-1 py-1.5 border-r border-b border-slate-400 text-center cursor-pointer hover:from-slate-400 hover:to-slate-500 transition-all"
                                style={{ minWidth: '60px', maxWidth: '60px' }}
                                onClick={() => toggleFeatureExpansion(feature.id)}
                              >
                                <div className="flex flex-col items-center gap-0">
                                  <span className="text-[8px] opacity-80">expandir</span>
                                  <span className="text-[10px] font-bold">({feature.states.length})</span>
                                </div>
                              </th>
                            );
                          }
                        })}
                      </tr>
                    </thead>
                    
                    {/* Body */}
                    <tbody>
                      {filteredEntities.map((entity, idx) => (
                        <tr key={entity.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                          {/* Entity Name - Frozen Left */}
                          <td 
                            className={`sticky left-0 z-20 px-2 py-1.5 border-r-2 border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                            style={{ minWidth: '180px', maxWidth: '180px', boxShadow: '2px 0 6px rgba(0,0,0,0.08)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-200 overflow-hidden flex-shrink-0">
                                {entity.imageUrl && <img src={entity.imageUrl} className="w-full h-full object-cover" alt="" />}
                              </div>
                              <span className="text-[11px] font-medium text-slate-700 line-clamp-2 leading-tight" title={entity.name}>
                                {entity.name}
                              </span>
                            </div>
                          </td>

                          {/* Feature Cells */}
                          {project.features.map(feature => {
                            const isExpanded = expandedFeatureId === feature.id;
                            const entityTraits = entity.traits[feature.id] || [];
                            const selectedCount = entityTraits.length;

                            if (isExpanded) {
                              return feature.states.map(state => {
                                const isChecked = entityTraits.includes(state.id);
                                return (
                                  <td 
                                    key={`${entity.id}-${state.id}`} 
                                    className={`border-b border-r border-slate-200 text-center hover:bg-emerald-50 transition-colors p-1 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                                    style={{ minWidth: '80px', maxWidth: '100px' }}
                                  >
                                    <button
                                      onClick={() => toggleTrait(entity.id, feature.id, state.id)}
                                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all mx-auto ${
                                        isChecked
                                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                      }`}
                                    >
                                      {isChecked && <CheckSquare size={14} strokeWidth={2.5} />}
                                    </button>
                                  </td>
                                );
                              });
                            } else {
                              return (
                                <td
                                  key={`${entity.id}-${feature.id}-collapsed`}
                                  className={`border-b border-r border-slate-200 text-center cursor-pointer hover:bg-slate-100 transition-colors p-1 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                                  style={{ minWidth: '60px', maxWidth: '60px' }}
                                  onClick={() => toggleFeatureExpansion(feature.id)}
                                  title={`${selectedCount} de ${feature.states.length}`}
                                >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mx-auto ${
                                    selectedCount > 0
                                      ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {selectedCount}
                                  </div>
                                </td>
                              );
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Trait Editor Modal */}
      {editingEntityId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 truncate">
                <Edit3 size={18} className="text-emerald-600" />
                <span className="truncate">
                  {strings.traitEditor}: <span className="text-emerald-600">{project.entities.find(e => e.id === editingEntityId)?.name}</span>
                </span>
              </h3>
              <button onClick={() => setEditingEntityId(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
              {project.features.map(feature => (
                <div key={feature.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    {feature.name}
                    {feature.imageUrl && (
                      <a href={feature.imageUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-emerald-500">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {feature.states.map(state => {
                      const isChecked = project.entities.find(e => e.id === editingEntityId)?.traits[feature.id]?.includes(state.id);
                      return (
                        <button
                          key={state.id}
                          onClick={() => toggleTrait(editingEntityId!, feature.id, state.id)}
                          className={`text-sm px-3 py-3 md:py-2 rounded-lg border text-left flex items-center justify-between transition-all touch-manipulation active:scale-[0.98] ${isChecked
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                            }`}
                        >
                          <span className="truncate mr-2 text-xs md:text-sm">{state.label}</span>
                          {isChecked && <CheckSquare size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {project.features.length === 0 && (
                <div className="text-center text-slate-400 py-10">
                  Nenhuma característica definida no projeto.
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 shrink-0">
              <button
                onClick={() => setEditingEntityId(null)}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-900/10"
              >
                {strings.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Wizard Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {aiStep === 'CATEGORY' ? (
             <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 p-8 flex flex-col items-center relative">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={24} />
                </button>

                <img src="./assets/icon.png" className="w-24 h-24 mb-6 drop-shadow-md" alt="Nozes Logo" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Nozes IA</h2>
                <p className="text-slate-500 text-center mb-8">
                  {language === 'pt' ? 'O que você deseja identificar hoje?' : 'What do you want to identify today?'}
                </p>
                
                <div className="grid grid-cols-1 gap-4 w-full">
                  <button 
                    onClick={() => {
                      setAiConfig(prev => ({ ...prev, category: 'FLORA' }));
                      setAiStep('WIZARD');
                    }}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group bg-white shadow-sm hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🌿</div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-800 group-hover:text-emerald-700">Flora</h3>
                      <p className="text-xs text-slate-500">{language === 'pt' ? 'Plantas, árvores, flores' : 'Plants, trees, flowers'}</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setAiConfig(prev => ({ ...prev, category: 'FAUNA' }));
                      setAiStep('WIZARD');
                    }}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group bg-white shadow-sm hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🦁</div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-800 group-hover:text-amber-700">Fauna</h3>
                      <p className="text-xs text-slate-500">{language === 'pt' ? 'Animais, insetos, aves' : 'Animals, insects, birds'}</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setAiConfig(prev => ({ ...prev, category: 'OTHER' }));
                      setAiStep('WIZARD');
                    }}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition-all group bg-white shadow-sm hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">✨</div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-800 group-hover:text-purple-700">{language === 'pt' ? 'Outros' : 'Others'}</h3>
                      <p className="text-xs text-slate-500">{language === 'pt' ? 'Filmes, livros, objetos, etc.' : 'Movies, books, objects, etc.'}</p>
                    </div>
                  </button>
                </div>
             </div>
          ) : (
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Header - Dynamic Color based on Category */}
            <div className={`p-4 md:p-6 text-white shrink-0 bg-gradient-to-r ${
              aiConfig.category === 'FAUNA' ? 'from-amber-600 to-orange-500' :
              aiConfig.category === 'OTHER' ? 'from-purple-600 to-indigo-500' :
              'from-emerald-600 to-teal-500' // FLORA (Default)
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Brain size={24} className="text-white" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold flex-1">{strings.aiTitle}</h3>
                
                {/* Icon in Header */}
                <img src="./assets/icon.png" className="w-12 h-12 drop-shadow-sm opacity-90" alt="Nozes" />

                {onOpenSettings && (
                  <button
                    onClick={() => { setShowAiModal(false); onOpenSettings(true); }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    title={language === 'pt' ? 'Configurar Chave de API' : 'Configure API Key'}
                  >
                    <KeyRound size={18} className="text-white" />
                  </button>
                )}
              </div>
              <p className="text-white/90 text-xs md:text-sm font-medium drop-shadow-sm">
                {strings.aiDesc}
              </p>
              {/* API Key Warning - only show if no API key configured */}
              {!apiKey && onOpenSettings && (
                <div className="mt-3 flex items-center gap-2 bg-red-500/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-red-300/50 animate-pulse">
                  <KeyRound size={16} className="text-yellow-200" />
                  <div className="flex-1">
                    <p className="text-yellow-100 text-xs font-bold">{strings.apiKeyWarning}</p>
                    <p className="text-yellow-200/80 text-[10px]">{strings.clickGear}</p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Mode Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => setAiMode('TOPIC')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'TOPIC' ? (aiConfig.category === 'FAUNA' ? 'border-amber-500 text-amber-600' : aiConfig.category === 'OTHER' ? 'border-purple-500 text-purple-600' : 'border-emerald-500 text-emerald-600') + ' bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><Wand2 size={14} /> <span className="hidden sm:inline">{strings.modeTopic}</span><span className="sm:hidden">Gerar</span></span>
              </button>
              <button
                onClick={() => setAiMode('IMPORT')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'IMPORT' ? (aiConfig.category === 'FAUNA' ? 'border-amber-500 text-amber-600' : aiConfig.category === 'OTHER' ? 'border-purple-500 text-purple-600' : 'border-emerald-500 text-emerald-600') + ' bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><FileSearch size={14} /> <span className="hidden sm:inline">{strings.modeImport}</span><span className="sm:hidden">Importar</span></span>
              </button>
              <button
                onClick={() => setAiMode('REFINE')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'REFINE' ? (aiConfig.category === 'FAUNA' ? 'border-amber-500 text-amber-600' : aiConfig.category === 'OTHER' ? 'border-purple-500 text-purple-600' : 'border-emerald-500 text-emerald-600') + ' bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><Sparkles size={14} /> <span className="hidden sm:inline">{strings.modeRefine}</span><span className="sm:hidden">Refinar</span></span>
              </button>
              <button
                onClick={() => setAiMode('MERGE')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'MERGE' ? (aiConfig.category === 'FAUNA' ? 'border-amber-500 text-amber-600' : aiConfig.category === 'OTHER' ? 'border-purple-500 text-purple-600' : 'border-emerald-500 text-emerald-600') + ' bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><Combine size={14} /> <span className="hidden sm:inline">{strings.modeMerge}</span><span className="sm:hidden">Combinar</span></span>
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-white">

              {aiMode === 'TOPIC' ? (
                /* TOPIC MODE INPUTS */
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{strings.topic}</label>
                    <input
                      value={aiConfig.topic}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder={
                        aiConfig.category === 'FAUNA' ? (language === 'pt' ? "ex: Felinos da África, Aves do Pantanal" : "e.g. African Cats, Birds of Pantanal") :
                        aiConfig.category === 'OTHER' ? (language === 'pt' ? "ex: Filmes de Terror dos anos 80, Personagens de Harry Potter" : "e.g. 80s Horror Movies, Harry Potter Characters") :
                        strings.topicPlace // FLORA default
                      }
                      className={`w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 outline-none text-base md:text-lg ${
                        aiConfig.category === 'FAUNA' ? 'focus:ring-amber-500 focus:border-amber-500' :
                        aiConfig.category === 'OTHER' ? 'focus:ring-purple-500 focus:border-purple-500' :
                        'focus:ring-emerald-500 focus:border-emerald-500'
                      }`}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Taxonomic Filters - Only for FLORA and FAUNA */}
                  {(aiConfig.category === 'FLORA' || aiConfig.category === 'FAUNA') && (
                  <div className={`p-3 rounded-xl border ${
                    aiConfig.category === 'FAUNA' ? 'bg-amber-50/50 border-amber-100' : 'bg-emerald-50/50 border-emerald-100'
                  }`}>
                    <label className={`block text-xs font-bold uppercase mb-2 flex items-center gap-1 ${
                      aiConfig.category === 'FAUNA' ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      <Leaf size={12} /> {strings.taxonomyFilters}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{strings.taxonomyFamily}</label>
                        <input
                          value={aiConfig.taxonomyFamily}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, taxonomyFamily: e.target.value }))}
                          placeholder={
                            aiConfig.category === 'FAUNA' ? (language === 'pt' ? "ex: Felidae" : "e.g. Felidae") :
                            (language === 'pt' ? "ex: Fabaceae" : "e.g. Fabaceae")
                          }
                          className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 outline-none text-sm bg-white ${
                            aiConfig.category === 'FAUNA' ? 'focus:ring-amber-500' : 'focus:ring-emerald-500'
                          }`}
                          disabled={isGenerating}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{strings.taxonomyGenus}</label>
                        <input
                          value={aiConfig.taxonomyGenus}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, taxonomyGenus: e.target.value }))}
                          placeholder={
                            aiConfig.category === 'FAUNA' ? (language === 'pt' ? "ex: Panthera" : "e.g. Panthera") :
                            (language === 'pt' ? "ex: Inga" : "e.g. Inga")
                          }
                          className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 outline-none text-sm bg-white ${
                            aiConfig.category === 'FAUNA' ? 'focus:ring-amber-500' : 'focus:ring-emerald-500'
                          }`}
                          disabled={isGenerating}
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Geographic Filters - Only for FLORA and FAUNA */}
                  {(aiConfig.category === 'FLORA' || aiConfig.category === 'FAUNA') && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <label className="block text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">
                      <Globe size={12} /> {strings.geographyFilters}
                    </label>
                    
                    {/* Scope selector */}
                    <div className="flex gap-2 mb-3">
                      {(['global', 'national', 'regional'] as const).map((scope) => (
                        <button
                          key={scope}
                          onClick={() => setAiConfig(prev => ({ ...prev, scope }))}
                          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors ${
                            aiConfig.scope === scope 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white text-slate-600 hover:bg-blue-100 border border-slate-200'
                          }`}
                          disabled={isGenerating}
                        >
                          {scope === 'global' ? strings.scopeGlobal : scope === 'national' ? strings.scopeNational : strings.scopeRegional}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{strings.biome}</label>
                        <select
                          value={aiConfig.biome}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, biome: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                          disabled={isGenerating}
                        >
                          <option value="">{language === 'pt' ? "Todos os biomas" : "All biomes"}</option>
                          <option value="Amazônia">Amazônia</option>
                          <option value="Mata Atlântica">Mata Atlântica</option>
                          <option value="Cerrado">Cerrado</option>
                          <option value="Caatinga">Caatinga</option>
                          <option value="Pampa">Pampa</option>
                          <option value="Pantanal">Pantanal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{strings.stateUF}</label>
                        <select
                          value={aiConfig.stateUF}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, stateUF: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                          disabled={isGenerating}
                        >
                          <option value="">{language === 'pt' ? "Todos os estados" : "All states"}</option>
                          <option value="AC">Acre (AC)</option>
                          <option value="AL">Alagoas (AL)</option>
                          <option value="AP">Amapá (AP)</option>
                          <option value="AM">Amazonas (AM)</option>
                          <option value="BA">Bahia (BA)</option>
                          <option value="CE">Ceará (CE)</option>
                          <option value="DF">Distrito Federal (DF)</option>
                          <option value="ES">Espírito Santo (ES)</option>
                          <option value="GO">Goiás (GO)</option>
                          <option value="MA">Maranhão (MA)</option>
                          <option value="MT">Mato Grosso (MT)</option>
                          <option value="MS">Mato Grosso do Sul (MS)</option>
                          <option value="MG">Minas Gerais (MG)</option>
                          <option value="PA">Pará (PA)</option>
                          <option value="PB">Paraíba (PB)</option>
                          <option value="PR">Paraná (PR)</option>
                          <option value="PE">Pernambuco (PE)</option>
                          <option value="PI">Piauí (PI)</option>
                          <option value="RJ">Rio de Janeiro (RJ)</option>
                          <option value="RN">Rio Grande do Norte (RN)</option>
                          <option value="RS">Rio Grande do Sul (RS)</option>
                          <option value="RO">Rondônia (RO)</option>
                          <option value="RR">Roraima (RR)</option>
                          <option value="SC">Santa Catarina (SC)</option>
                          <option value="SP">São Paulo (SP)</option>
                          <option value="SE">Sergipe (SE)</option>
                          <option value="TO">Tocantins (TO)</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Free text geography field */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-500 mb-1">{language === 'pt' ? "Região específica (opcional)" : "Specific region (optional)"}</label>
                      <input
                        value={aiConfig.geography}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, geography: e.target.value }))}
                        placeholder={language === 'pt' ? "ex: Serra do Mar, Bacia do Rio Doce" : "e.g. Amazon Basin, Andes"}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                        disabled={isGenerating}
                      />
                    </div>
                  </div>
                  )}

                  {/* Feature Type Selector - Dynamic based on Category */}
                  <div className={`p-3 rounded-xl border ${
                    aiConfig.category === 'FAUNA' ? 'bg-amber-50/50 border-amber-100' :
                    aiConfig.category === 'OTHER' ? 'bg-purple-50/50 border-purple-100' :
                    'bg-emerald-50/50 border-emerald-100'
                  }`}>
                    <label className={`block text-xs font-bold uppercase mb-2 flex items-center gap-1 ${
                      aiConfig.category === 'FAUNA' ? 'text-amber-700' :
                      aiConfig.category === 'OTHER' ? 'text-purple-700' :
                      'text-emerald-700'
                    }`}>
                      {aiConfig.category === 'OTHER' ? '✨' : '🌿'} {strings.featureTypeLabel}
                    </label>
                    <p className={`text-xs mb-2 ${
                      aiConfig.category === 'FAUNA' ? 'text-amber-600/80' :
                      aiConfig.category === 'OTHER' ? 'text-purple-600/80' :
                      'text-emerald-600/80'
                    }`}>
                      {aiConfig.category === 'FAUNA' ? (language === 'pt' ? 'Focar em características morfológicas (corpo) ou comportamentais' : 'Focus on morphological (body) or behavioral features') :
                       aiConfig.category === 'OTHER' ? (language === 'pt' ? 'Focar em características visuais ou conceituais' : 'Focus on visual or conceptual features') :
                       strings.featureTypeDesc}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {aiConfig.category === 'FLORA' ? (
                        <>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'vegetative' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'vegetative'
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🌿 {strings.featureTypeVegetative}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'reproductive' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'reproductive'
                                ? 'bg-pink-500 text-white border-pink-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🌸 {strings.featureTypeReproductive}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'general' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'general'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🌱 {strings.featureTypeBoth}
                          </button>
                        </>
                      ) : aiConfig.category === 'FAUNA' ? (
                        <>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'vegetative' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'vegetative'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🦁 {language === 'pt' ? 'Morfológicas' : 'Morphological'}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'reproductive' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'reproductive'
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🐾 {language === 'pt' ? 'Comportamentais' : 'Behavioral'}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'general' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'general'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🌍 {language === 'pt' ? 'Geral + Habitat' : 'General + Habitat'}
                          </button>
                        </>
                      ) : (
                        /* OTHER */
                        <>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'vegetative' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'vegetative'
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                            }`}
                            disabled={isGenerating}
                          >
                            👁️ {language === 'pt' ? 'Visuais/Físicas' : 'Visual/Physical'}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'reproductive' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'reproductive'
                                ? 'bg-indigo-500 text-white border-indigo-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                            }`}
                            disabled={isGenerating}
                          >
                            🧠 {language === 'pt' ? 'Conceituais/Abstratas' : 'Conceptual/Abstract'}
                          </button>
                          <button
                            onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: 'general' }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              aiConfig.featureFocus === 'general'
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                            }`}
                            disabled={isGenerating}
                          >
                            ✨ {language === 'pt' ? 'Misto' : 'Mixed'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Required Species/Items List - Dynamic Label */}
                  <div className={`p-3 rounded-xl border ${
                    aiConfig.category === 'FAUNA' ? 'bg-amber-50/50 border-amber-100' :
                    aiConfig.category === 'OTHER' ? 'bg-purple-50/50 border-purple-100' :
                    'bg-emerald-50/50 border-emerald-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`block text-xs font-bold uppercase flex items-center gap-1 ${
                        aiConfig.category === 'FAUNA' ? 'text-amber-700' :
                        aiConfig.category === 'OTHER' ? 'text-purple-700' :
                        'text-emerald-700'
                      }`}>
                        <List size={12} /> 
                        {aiConfig.category === 'FAUNA' ? (language === 'pt' ? 'Lista de Espécies (Opcional)' : 'Required Species List') :
                         aiConfig.category === 'OTHER' ? (language === 'pt' ? 'Lista de Itens (Opcional)' : 'Required Items List') :
                         strings.requiredSpecies}
                      </label>
                      {requiredSpeciesText.trim() && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          aiConfig.category === 'FAUNA' ? 'text-amber-600 bg-amber-100' :
                          aiConfig.category === 'OTHER' ? 'text-purple-600 bg-purple-100' :
                          'text-emerald-600 bg-emerald-100'
                        }`}>
                          {requiredSpeciesText.split('\n').filter(s => s.trim()).length} {strings.speciesCount}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mb-2 ${
                      aiConfig.category === 'FAUNA' ? 'text-amber-600/80' :
                      aiConfig.category === 'OTHER' ? 'text-purple-600/80' :
                      'text-emerald-600/80'
                    }`}>{strings.requiredSpeciesDesc}</p>
                    
                    <textarea
                      value={requiredSpeciesText}
                      onChange={(e) => setRequiredSpeciesText(e.target.value)}
                      placeholder={
                        aiConfig.category === 'FAUNA' ? (language === 'pt' ? "ex: Panthera onca\nPanthera leo\nPuma concolor" : "e.g. Panthera onca\nPanthera leo") :
                        aiConfig.category === 'OTHER' ? (language === 'pt' ? "ex: O Iluminado\nAlien - O 8º Passageiro\nHalloween" : "e.g. The Shining\nAlien\nHalloween") :
                        strings.requiredSpeciesPlaceholder
                      }
                      className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 outline-none text-sm bg-white resize-none h-24 font-mono ${
                        aiConfig.category === 'FAUNA' ? 'focus:ring-amber-500' :
                        aiConfig.category === 'OTHER' ? 'focus:ring-purple-500' :
                        'focus:ring-emerald-500'
                      }`}
                      disabled={isGenerating}
                    />
                    
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <label className="cursor-pointer flex items-center gap-2 text-xs text-purple-600 hover:text-purple-800 transition-colors">
                        <Upload size={14} />
                        <span className="font-medium">{strings.importSpeciesList}</span>
                        <input
                          ref={speciesListInputRef}
                          type="file"
                          className="hidden"
                          accept=".txt,.csv,.json,.doc,.docx"
                          onChange={handleSpeciesListImport}
                          disabled={isGenerating}
                        />
                      </label>
                      {requiredSpeciesText.trim() && (
                        <button
                          onClick={() => setRequiredSpeciesText('')}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                          disabled={isGenerating}
                        >
                          <Trash2 size={12} /> {strings.clearList}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-purple-400 mt-1">{strings.importSpeciesFormats}</p>
                  </div>
                </>
              ) : aiMode === 'IMPORT' ? (
                /* IMPORT MODE INPUTS */
                <div className="flex flex-col gap-4">
                  <div className="text-center space-y-2 mb-2">
                    <h4 className="font-bold text-slate-800 text-lg">{strings.uploadLabel}</h4>
                    <p className="text-slate-500 text-sm">{strings.uploadDesc}</p>
                  </div>

                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${isDraggingFile ? 'border-amber-500 bg-amber-100 scale-[1.02]' : importedFile ? 'border-amber-500 bg-amber-50/30' : 'border-slate-300 hover:border-amber-400 bg-slate-50'}`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {importedFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileText size={48} className="text-amber-600" />
                        <span className="font-bold text-slate-800 text-sm text-center break-all">{importedFile.name}</span>
                        <span className="text-xs text-slate-400">{(importedFile.size / 1024).toFixed(1)} KB</span>
                        <button
                          onClick={() => setImportedFile(null)}
                          className="mt-2 text-red-500 text-xs font-bold hover:underline flex items-center gap-1 p-2"
                        >
                          <Trash2 size={12} /> {strings.removeFile}
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-3 w-full h-full">
                        <div className={`p-4 bg-white rounded-full shadow-sm transition-transform ${isDraggingFile ? 'scale-110' : ''}`}>
                          <Upload size={24} className={`${isDraggingFile ? 'text-amber-600' : 'text-amber-500'}`} />
                        </div>
                        <span className="font-bold text-slate-600">{isDraggingFile ? (language === 'pt' ? 'Solte o arquivo aqui!' : 'Drop file here!') : strings.dropFile}</span>
                        <span className="text-xs text-slate-400">{strings.supportedFormats}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.txt,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                        />
                      </label>
                    )}
                  </div>

                  {/* Nervura Import Option */}
                  <div className="mt-2 pt-4 border-t border-slate-200">
                    <label className="w-full flex items-center justify-center gap-2 p-3 rounded-xl cursor-pointer transition-colors border bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-700 border-emerald-200 hover:border-emerald-300">
                      <img src="./assets/nervura.png" alt="Nervura" className="w-5 h-5 object-contain" />
                      <span className="font-bold text-sm">
                        {language === 'pt' ? 'Ficha Morfológica NervuraColetora' : 'NervuraColetora Morphological Sheet'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".json"
                        onChange={handleNervuraImport}
                        disabled={isGenerating}
                      />
                    </label>
                    <p className="text-[10px] text-center text-slate-400 mt-2">
                      {language === 'pt' 
                        ? 'Selecione um arquivo JSON exportado do NervuraColetora.' 
                        : 'Select a JSON file exported from NervuraColetora.'}
                    </p>
                  </div>
                </div>
              ) : aiMode === 'REFINE' ? (
                /* REFINE MODE INPUTS */
                <div className="flex flex-col gap-4">
                  {/* Current Project Info */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
                    <h5 className="text-xs font-bold text-emerald-700 uppercase mb-2">{strings.currentProject}</h5>
                    {project.entities.length > 0 || project.features.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 truncate">{project.name}</p>
                          <p className="text-xs text-slate-500">
                            {project.entities.length} {strings.entitiesCount} • {project.features.length} {strings.featuresCount}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
                            {project.entities.length}
                          </span>
                          <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-1 rounded">
                            {project.features.length}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600 italic">{strings.noProjectLoaded}</p>
                    )}
                  </div>

                  {/* Action Selector */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setRefineAction('EXPAND')}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${refineAction === 'EXPAND' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${refineAction === 'EXPAND' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <ListPlus size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{strings.actionExpand}</p>
                          <p className="text-xs text-slate-500">{strings.actionExpandDesc}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setRefineAction('REFINE')}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${refineAction === 'REFINE' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${refineAction === 'REFINE' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Target size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{strings.actionRefine}</p>
                          <p className="text-xs text-slate-500">{strings.actionRefineDesc}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setRefineAction('CLEAN')}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${refineAction === 'CLEAN' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${refineAction === 'CLEAN' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Eraser size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{strings.actionClean}</p>
                          <p className="text-xs text-slate-500">{strings.actionCleanDesc}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setRefineAction('PHOTOS')}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${refineAction === 'PHOTOS' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${refineAction === 'PHOTOS' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Camera size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{strings.actionPhotos}</p>
                          <p className="text-xs text-slate-500">{strings.actionPhotosDesc}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setRefineAction('VALIDATE')}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${refineAction === 'VALIDATE' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${refineAction === 'VALIDATE' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <ShieldCheck size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{strings.actionValidate}</p>
                          <p className="text-xs text-slate-500">{strings.actionValidateDesc}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Action-specific options */}
                  {refineAction === 'EXPAND' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-semibold text-slate-500 uppercase">{strings.expandCount}</label>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{refineOptions.expandCount}</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="100"
                          step="5"
                          value={refineOptions.expandCount}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, expandCount: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          disabled={isGenerating}
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.keepExisting}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, keepExisting: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.keepExisting}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.addFeatures}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, addFeatures: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.addFeatures}</span>
                      </label>
                      
                      {/* Taxonomic & Geographic Filters for EXPAND */}
                      {/* Taxonomic & Geographic Filters - Only for FLORA and FAUNA */}
                      {(aiConfig.category === 'FLORA' || aiConfig.category === 'FAUNA') && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">{strings.expandFilters}</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{strings.expandFamily}</label>
                            <input
                              type="text"
                              value={refineOptions.expandFamily}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, expandFamily: e.target.value }))}
                              placeholder={aiConfig.category === 'FAUNA' ? "Felidae" : "Fabaceae"}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{strings.expandGenus}</label>
                            <input
                              type="text"
                              value={refineOptions.expandGenus}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, expandGenus: e.target.value }))}
                              placeholder={aiConfig.category === 'FAUNA' ? "Panthera" : "Inga"}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{strings.expandBiome}</label>
                            <select
                              value={refineOptions.expandBiome}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, expandBiome: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none bg-white"
                            >
                              <option value="">--</option>
                              <option value="Amazônia">Amazônia</option>
                              <option value="Mata Atlântica">Mata Atlântica</option>
                              <option value="Cerrado">Cerrado</option>
                              <option value="Caatinga">Caatinga</option>
                              <option value="Pantanal">Pantanal</option>
                              <option value="Pampa">Pampa</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{strings.expandStateUF}</label>
                            <select
                              value={refineOptions.expandStateUF}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, expandStateUF: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none bg-white"
                            >
                              <option value="">--</option>
                              <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
                              <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
                              <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
                              <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
                              <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
                              <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
                              <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
                              <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
                              <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <label className="block text-xs text-slate-500 mb-1">{strings.expandScope}</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRefineOptions(prev => ({ ...prev, expandScope: 'global' }))}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                                refineOptions.expandScope === 'global' 
                                  ? 'bg-amber-500 text-white shadow-sm' 
                                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              {strings.scopeGlobal}
                            </button>
                            <button
                              onClick={() => setRefineOptions(prev => ({ ...prev, expandScope: 'national' }))}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                                refineOptions.expandScope === 'national' 
                                  ? 'bg-amber-500 text-white shadow-sm' 
                                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              {strings.scopeNational}
                            </button>
                            <button
                              onClick={() => setRefineOptions(prev => ({ ...prev, expandScope: 'regional' }))}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                                refineOptions.expandScope === 'regional' 
                                  ? 'bg-amber-500 text-white shadow-sm' 
                                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              {strings.scopeRegional}
                            </button>
                          </div>
                        </div>
                      </div>
                      )}
                      
                      {/* Required Species to Add */}
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-amber-700 uppercase flex items-center gap-1">
                            <List size={12} /> {aiConfig.category === 'OTHER' ? (language === 'pt' ? 'Itens Obrigatórios' : 'Required Items') : strings.expandRequiredSpecies}
                          </label>
                          {refineOptions.expandRequiredSpecies.trim() && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                              {refineOptions.expandRequiredSpecies.split('\n').filter(s => s.trim()).length} {strings.speciesCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-600/80 mb-2">{strings.expandRequiredSpeciesDesc}</p>
                        <textarea
                          value={refineOptions.expandRequiredSpecies}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, expandRequiredSpecies: e.target.value }))}
                          placeholder={
                            aiConfig.category === 'FAUNA' ? (language === 'pt' ? "ex: Panthera onca\nPanthera leo" : "e.g. Panthera onca\nPanthera leo") :
                            aiConfig.category === 'OTHER' ? (language === 'pt' ? "ex: O Iluminado\nAlien" : "e.g. The Shining\nAlien") :
                            strings.expandRequiredSpeciesPlaceholder
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white resize-none h-20 font-mono"
                          disabled={isGenerating}
                        />
                        {refineOptions.expandRequiredSpecies.trim() && (
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, expandRequiredSpecies: '' }))}
                            className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                            disabled={isGenerating}
                          >
                            <Trash2 size={12} /> {strings.clearList}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {refineAction === 'REFINE' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      {/* Feature Type Selector - Dynamic */}
                      <div className="pb-3 border-b border-slate-200">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{strings.featureTypeLabel}</label>
                        <p className="text-xs text-slate-400 mb-2">
                          {aiConfig.category === 'FAUNA' ? (language === 'pt' ? 'Focar em características morfológicas ou comportamentais' : 'Focus on morphological or behavioral features') :
                           aiConfig.category === 'OTHER' ? (language === 'pt' ? 'Focar em características visuais ou conceituais' : 'Focus on visual or conceptual features') :
                           strings.featureTypeDesc}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {aiConfig.category === 'FLORA' ? (
                            <>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'vegetative' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'vegetative'
                                    ? 'bg-emerald-500 text-white border-emerald-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                }`}
                              >
                                🌿 {strings.featureTypeVegetative}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'reproductive' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'reproductive'
                                    ? 'bg-pink-500 text-white border-pink-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                                }`}
                              >
                                🌸 {strings.featureTypeReproductive}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'both' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'both'
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                }`}
                              >
                                🌱 {strings.featureTypeBoth}
                              </button>
                            </>
                          ) : aiConfig.category === 'FAUNA' ? (
                            <>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'vegetative' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'vegetative'
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                }`}
                              >
                                🦁 {language === 'pt' ? 'Morfológicas' : 'Morphological'}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'reproductive' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'reproductive'
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                                }`}
                              >
                                🐾 {language === 'pt' ? 'Comportamentais' : 'Behavioral'}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'both' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'both'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                }`}
                              >
                                🌍 {language === 'pt' ? 'Geral + Habitat' : 'General + Habitat'}
                              </button>
                            </>
                          ) : (
                            /* OTHER */
                            <>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'vegetative' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'vegetative'
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                }`}
                              >
                                👁️ {language === 'pt' ? 'Visuais/Físicas' : 'Visual/Physical'}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'reproductive' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'reproductive'
                                    ? 'bg-indigo-500 text-white border-indigo-500'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                }`}
                              >
                                🧠 {language === 'pt' ? 'Conceituais/Abstratas' : 'Conceptual/Abstract'}
                              </button>
                              <button
                                onClick={() => setRefineOptions(prev => ({ ...prev, featureType: 'both' }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                  refineOptions.featureType === 'both'
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                }`}
                              >
                                ✨ {language === 'pt' ? 'Misto' : 'Mixed'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.improveDescriptions}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, improveDescriptions: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.improveDescriptions}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.fillGaps}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, fillGaps: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.fillGaps}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.addFeatures}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, addFeatures: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.addFeatures}</span>
                      </label>
                      
                      {refineOptions.addFeatures && (
                        <div className="ml-6 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 font-medium">{language === 'pt' ? 'Nº de características a adicionar' : 'Number of features to add'}</span>
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{refineOptions.refineFeatureCount}</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={refineOptions.refineFeatureCount}
                            onChange={(e) => setRefineOptions(prev => ({ ...prev, refineFeatureCount: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      )}
                      
                      {/* Required Features Dropdown for REFINE */}
                      {refineOptions.addFeatures && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{strings.refineRequiredFeaturesTitle}</p>
                          <p className="text-xs text-slate-400 mb-3">{strings.refineRequiredFeaturesDesc}</p>
                          
                          {/* Selected features tags */}
                          {refineOptions.refineRequiredFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {refineOptions.refineRequiredFeatures.map((feat, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                                  {feat}
                                  <button
                                    onClick={() => setRefineOptions(prev => ({
                                      ...prev,
                                      refineRequiredFeatures: prev.refineRequiredFeatures.filter((_, i) => i !== idx)
                                    }))}
                                    className="hover:text-amber-600"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Dropdown for suggested features */}
                          <div className="relative">
                            <button
                              onClick={() => setShowRequiredFeaturesDropdown(!showRequiredFeaturesDropdown)}
                              className="w-full px-3 py-2 text-sm text-left border border-slate-200 rounded-lg bg-white hover:border-amber-400 focus:ring-2 focus:ring-amber-400 focus:outline-none flex justify-between items-center"
                            >
                              <span className="text-slate-500">{strings.addRequiredFeature}</span>
                              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showRequiredFeaturesDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showRequiredFeaturesDropdown && (
                              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {suggestedFeatures.map((category, catIdx) => (
                                  <div key={catIdx}>
                                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase sticky top-0">
                                      {category.category}
                                    </div>
                                    {category.items.map((item, itemIdx) => (
                                      <button
                                        key={itemIdx}
                                        onClick={() => {
                                          if (!refineOptions.refineRequiredFeatures.includes(item)) {
                                            setRefineOptions(prev => ({
                                              ...prev,
                                              refineRequiredFeatures: [...prev.refineRequiredFeatures, item]
                                            }));
                                          }
                                          setShowRequiredFeaturesDropdown(false);
                                        }}
                                        disabled={refineOptions.refineRequiredFeatures.includes(item)}
                                        className={`w-full px-3 py-2 text-sm text-left hover:bg-amber-50 ${
                                          refineOptions.refineRequiredFeatures.includes(item) ? 'text-slate-300' : 'text-slate-700'
                                        }`}
                                      >
                                        {item}
                                      </button>
                                    ))}
                                  </div>
                                ))}
                                
                                {/* Custom feature input */}
                                <div className="p-2 border-t border-slate-100">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={customFeatureInput}
                                      onChange={(e) => setCustomFeatureInput(e.target.value)}
                                      placeholder={strings.customFeature}
                                      className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customFeatureInput.trim()) {
                                          setRefineOptions(prev => ({
                                            ...prev,
                                            refineRequiredFeatures: [...prev.refineRequiredFeatures, customFeatureInput.trim()]
                                          }));
                                          setCustomFeatureInput('');
                                          setShowRequiredFeaturesDropdown(false);
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        if (customFeatureInput.trim()) {
                                          setRefineOptions(prev => ({
                                            ...prev,
                                            refineRequiredFeatures: [...prev.refineRequiredFeatures, customFeatureInput.trim()]
                                          }));
                                          setCustomFeatureInput('');
                                          setShowRequiredFeaturesDropdown(false);
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Direct text input for multiple features */}
                          <div className="mt-3">
                            <label className="block text-xs text-slate-400 mb-1">
                              {language === 'pt' ? 'Ou digite características manualmente (Enter para adicionar)' : 'Or type features manually (Enter to add)'}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customFeatureInput}
                                onChange={(e) => setCustomFeatureInput(e.target.value)}
                                placeholder={language === 'pt' ? 'ex: Tipo de tricoma, Forma do ovário...' : 'e.g. Trichome type, Ovary shape...'}
                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customFeatureInput.trim()) {
                                    // Support comma-separated input
                                    const features = customFeatureInput.split(',').map(f => f.trim()).filter(f => f.length > 0);
                                    setRefineOptions(prev => ({
                                      ...prev,
                                      refineRequiredFeatures: [...prev.refineRequiredFeatures, ...features.filter(f => !prev.refineRequiredFeatures.includes(f))]
                                    }));
                                    setCustomFeatureInput('');
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (customFeatureInput.trim()) {
                                    const features = customFeatureInput.split(',').map(f => f.trim()).filter(f => f.length > 0);
                                    setRefineOptions(prev => ({
                                      ...prev,
                                      refineRequiredFeatures: [...prev.refineRequiredFeatures, ...features.filter(f => !prev.refineRequiredFeatures.includes(f))]
                                    }));
                                    setCustomFeatureInput('');
                                  }
                                }}
                                className="px-3 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 font-bold"
                              >
                                +
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {language === 'pt' ? 'Dica: separe múltiplas características com vírgula' : 'Tip: separate multiple features with comma'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {refineAction === 'CLEAN' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.removeRedundant}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, removeRedundant: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.removeRedundant}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={refineOptions.fixInconsistencies}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, fixInconsistencies: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-slate-700">{strings.fixInconsistencies}</span>
                      </label>
                    </div>
                  )}

                  {refineAction === 'PHOTOS' && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 space-y-4">
                      {/* Target Selection */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-800">{strings.photosActionDesc}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, photoTarget: 'entities' }))}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                              refineOptions.photoTarget === 'entities' 
                                ? 'bg-blue-500 text-white shadow-sm' 
                                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            {strings.photoTargetEntities}
                          </button>
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, photoTarget: 'features' }))}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                              refineOptions.photoTarget === 'features' 
                                ? 'bg-blue-500 text-white shadow-sm' 
                                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            {strings.photoTargetFeatures}
                          </button>
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, photoTarget: 'both' }))}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                              refineOptions.photoTarget === 'both' 
                                ? 'bg-blue-500 text-white shadow-sm' 
                                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            {strings.photoTargetBoth}
                          </button>
                        </div>
                      </div>
                      
                      {/* Replace vs Expand Mode */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, photoMode: 'expand' }))}
                            className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                              refineOptions.photoMode === 'expand' 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            <div className="text-xs font-medium">{strings.photoModeExpand}</div>
                            <div className="text-[10px] opacity-80">{strings.photoModeExpandDesc}</div>
                          </button>
                          <button
                            onClick={() => setRefineOptions(prev => ({ ...prev, photoMode: 'replace' }))}
                            className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                              refineOptions.photoMode === 'replace' 
                                ? 'bg-orange-500 text-white shadow-sm' 
                                : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
                            }`}
                          >
                            <div className="text-xs font-medium">{strings.photoModeReplace}</div>
                            <div className="text-[10px] opacity-80">{strings.photoModeReplaceDesc}</div>
                          </button>
                        </div>
                      </div>
                      
                      {/* Custom Sources */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-700">{strings.photoCustomSources}</label>
                        <textarea
                          value={refineOptions.photoCustomSources || ''}
                          onChange={(e) => setRefineOptions(prev => ({ ...prev, photoCustomSources: e.target.value }))}
                          placeholder={strings.photoCustomSourcesPlaceholder}
                          className="w-full h-20 text-xs p-2 border border-blue-200 rounded-lg bg-white/50 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {refineAction === 'VALIDATE' && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200 space-y-4">
                      <p className="text-sm font-medium text-emerald-800">{strings.validateOptions}</p>
                      
                      {/* Reference Catalog Selection */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-emerald-700 uppercase">{strings.validateReference}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['floradobrasil', 'gbif', 'powo', 'custom'] as const).map((ref) => (
                            <button
                              key={ref}
                              onClick={() => setRefineOptions(prev => ({ ...prev, validateReference: ref }))}
                              className={`py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                                refineOptions.validateReference === ref 
                                  ? 'bg-emerald-600 text-white shadow-sm' 
                                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                              }`}
                            >
                              {ref === 'floradobrasil' ? strings.validateFloradobrasil :
                               ref === 'gbif' ? strings.validateGbif :
                               ref === 'powo' ? strings.validatePowo : strings.validateCustom}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Validation Checkboxes */}
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={refineOptions.validateFixNames}
                            onChange={(e) => setRefineOptions(prev => ({ ...prev, validateFixNames: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-500 mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800">{strings.validateFixNames}</span>
                            <p className="text-xs text-slate-500">{strings.validateFixNamesDesc}</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={refineOptions.validateMergeSynonyms}
                            onChange={(e) => setRefineOptions(prev => ({ ...prev, validateMergeSynonyms: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-500 mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800">{strings.validateMergeSynonyms}</span>
                            <p className="text-xs text-slate-500">{strings.validateMergeSynonymsDesc}</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={refineOptions.validateCheckGeography}
                            onChange={(e) => setRefineOptions(prev => ({ ...prev, validateCheckGeography: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-500 mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800">{strings.validateCheckGeography}</span>
                            <p className="text-xs text-slate-500">{strings.validateCheckGeographyDesc}</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={refineOptions.validateCheckTaxonomy}
                            onChange={(e) => setRefineOptions(prev => ({ ...prev, validateCheckTaxonomy: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-500 mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800">{strings.validateCheckTaxonomy}</span>
                            <p className="text-xs text-slate-500">{strings.validateCheckTaxonomyDesc}</p>
                          </div>
                        </label>
                      </div>

                      {/* Taxonomic Scope (for validation) */}
                      {refineOptions.validateCheckTaxonomy && (
                        <div className="bg-white/50 p-3 rounded-lg border border-emerald-200 space-y-3">
                          <label className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1">
                            <Leaf size={12} /> {strings.taxonomyFilters}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={refineOptions.validateFamily}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, validateFamily: e.target.value }))}
                              placeholder={strings.taxonomyFamily}
                              className="px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <input
                              value={refineOptions.validateGenus}
                              onChange={(e) => setRefineOptions(prev => ({ ...prev, validateGenus: e.target.value }))}
                              placeholder={strings.taxonomyGenus}
                              className="px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Geographic Scope (for validation) */}
                      {refineOptions.validateCheckGeography && (
                        <div className="bg-white/50 p-3 rounded-lg border border-emerald-200 space-y-3">
                          <label className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1">
                            <Globe size={12} /> {strings.geographyFilters}
                          </label>
                          
                          {/* Scope selector */}
                          <div className="flex gap-2">
                            {(['global', 'national', 'regional'] as const).map((scope) => (
                              <button
                                key={scope}
                                onClick={() => setRefineOptions(prev => ({ ...prev, validateScope: scope }))}
                                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors ${
                                  refineOptions.validateScope === scope 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-white text-slate-600 hover:bg-emerald-100 border border-slate-200'
                                }`}
                              >
                                {scope === 'global' ? strings.scopeGlobal : scope === 'national' ? strings.scopeNational : strings.scopeRegional}
                              </button>
                            ))}
                          </div>

                          {refineOptions.validateScope !== 'global' && (
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={refineOptions.validateBiome}
                                onChange={(e) => setRefineOptions(prev => ({ ...prev, validateBiome: e.target.value }))}
                                className="px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                              >
                                <option value="">{strings.biome}</option>
                                <option value="Amazônia">Amazônia</option>
                                <option value="Mata Atlântica">Mata Atlântica</option>
                                <option value="Cerrado">Cerrado</option>
                                <option value="Caatinga">Caatinga</option>
                                <option value="Pampa">Pampa</option>
                                <option value="Pantanal">Pantanal</option>
                              </select>
                              <select
                                value={refineOptions.validateStateUF}
                                onChange={(e) => setRefineOptions(prev => ({ ...prev, validateStateUF: e.target.value }))}
                                className="px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                              >
                                <option value="">{strings.stateUF}</option>
                                <option value="AC">Acre (AC)</option>
                                <option value="AL">Alagoas (AL)</option>
                                <option value="AP">Amapá (AP)</option>
                                <option value="AM">Amazonas (AM)</option>
                                <option value="BA">Bahia (BA)</option>
                                <option value="CE">Ceará (CE)</option>
                                <option value="DF">Distrito Federal (DF)</option>
                                <option value="ES">Espírito Santo (ES)</option>
                                <option value="GO">Goiás (GO)</option>
                                <option value="MA">Maranhão (MA)</option>
                                <option value="MT">Mato Grosso (MT)</option>
                                <option value="MS">Mato Grosso do Sul (MS)</option>
                                <option value="MG">Minas Gerais (MG)</option>
                                <option value="PA">Pará (PA)</option>
                                <option value="PB">Paraíba (PB)</option>
                                <option value="PR">Paraná (PR)</option>
                                <option value="PE">Pernambuco (PE)</option>
                                <option value="PI">Piauí (PI)</option>
                                <option value="RJ">Rio de Janeiro (RJ)</option>
                                <option value="RN">Rio Grande do Norte (RN)</option>
                                <option value="RS">Rio Grande do Sul (RS)</option>
                                <option value="RO">Rondônia (RO)</option>
                                <option value="RR">Roraima (RR)</option>
                                <option value="SC">Santa Catarina (SC)</option>
                                <option value="SP">São Paulo (SP)</option>
                                <option value="SE">Sergipe (SE)</option>
                                <option value="TO">Tocantins (TO)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              
              {aiMode === 'MERGE' && (
                /* MERGE MODE INPUTS */
                <div className="flex flex-col gap-4">
                  <div className="text-center space-y-2 mb-2">
                    <h4 className="font-bold text-slate-800 text-lg">{strings.mergeTitle}</h4>
                    <p className="text-slate-500 text-sm">{strings.mergeDesc}</p>
                  </div>

                  {/* Key 1 Upload */}
                  <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all ${mergeKey1 ? 'border-amber-500 bg-amber-50/30' : 'border-slate-300 hover:border-amber-400 bg-slate-50'}`}>
                    {mergeKey1 ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <FileText size={32} className="text-amber-600" />
                        <span className="font-bold text-slate-800 text-sm text-center">{mergeKey1.name || 'Key 1'}</span>
                        <span className="text-xs text-slate-500">{mergeKey1.entities?.length || 0} {strings.entities} • {mergeKey1.features?.length || 0} {strings.features}</span>
                        <button
                          onClick={() => setMergeKey1(null)}
                          className="text-xs text-red-500 hover:text-red-700 underline"
                        >
                          {strings.remove}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMergeKeyUpload(1)}
                        className="flex flex-col items-center gap-2 p-2 w-full"
                      >
                        <Upload size={32} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">{strings.uploadKey1}</span>
                      </button>
                    )}
                  </div>

                  {/* Key 2 Upload */}
                  <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all ${mergeKey2 ? 'border-amber-500 bg-amber-50/30' : 'border-slate-300 hover:border-amber-400 bg-slate-50'}`}>
                    {mergeKey2 ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <FileText size={32} className="text-amber-600" />
                        <span className="font-bold text-slate-800 text-sm text-center">{mergeKey2.name || 'Key 2'}</span>
                        <span className="text-xs text-slate-500">{mergeKey2.entities?.length || 0} {strings.entities} • {mergeKey2.features?.length || 0} {strings.features}</span>
                        <button
                          onClick={() => setMergeKey2(null)}
                          className="text-xs text-red-500 hover:text-red-700 underline"
                        >
                          {strings.remove}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMergeKeyUpload(2)}
                        className="flex flex-col items-center gap-2 p-2 w-full"
                      >
                        <Upload size={32} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">{strings.uploadKey2}</span>
                      </button>
                    )}
                  </div>

                  {/* Merge Strategy */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{strings.mergeStrategy}</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setMergeStrategy('union')}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${mergeStrategy === 'union' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                      >
                        <p className="font-bold text-slate-800 text-sm">{strings.strategyUnion}</p>
                        <p className="text-xs text-slate-500">{strings.strategyUnionDesc}</p>
                      </button>
                      <button
                        onClick={() => setMergeStrategy('intersection')}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${mergeStrategy === 'intersection' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                      >
                        <p className="font-bold text-slate-800 text-sm">{strings.strategyIntersection}</p>
                        <p className="text-xs text-slate-500">{strings.strategyIntersectionDesc}</p>
                      </button>
                      <button
                        onClick={() => setMergeStrategy('primary')}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${mergeStrategy === 'primary' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
                      >
                        <p className="font-bold text-slate-800 text-sm">{strings.strategyPrimary}</p>
                        <p className="text-xs text-slate-500">{strings.strategyPrimaryDesc}</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SHARED CONFIGURATION SECTION - Only for TOPIC and IMPORT modes */}
              {(aiMode === 'TOPIC' || aiMode === 'IMPORT') && (
              <div className="pt-4 border-t border-slate-100 space-y-5">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={12} /> {strings.configSettings}
                </h5>

                {/* Detail Level Slider */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Microscope size={14} /> {strings.detailLevel}
                    </label>
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">
                      {getDetailLabel(aiConfig.detailLevel)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={aiConfig.detailLevel}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, detailLevel: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 mb-2"
                    disabled={isGenerating}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                    <span className={`flex flex-col items-center gap-1 ${aiConfig.detailLevel === 1 ? 'text-amber-600' : ''}`}><Baby size={16} /> Simple</span>
                    <span className={`flex flex-col items-center gap-1 ${aiConfig.detailLevel === 2 ? 'text-amber-600' : ''}`}><Brain size={16} /> Bal.</span>
                    <span className={`flex flex-col items-center gap-1 ${aiConfig.detailLevel === 3 ? 'text-amber-600' : ''}`}><GraduationCap size={16} /> Expert</span>
                  </div>
                </div>

                {/* Focus Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{strings.featureFocus}</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['general', 'reproductive', 'vegetative'] as FeatureFocus[]).map(focus => (
                      <button
                        key={focus}
                        onClick={() => setAiConfig(prev => ({ ...prev, featureFocus: focus }))}
                        className={`flex-1 py-2 rounded-md text-[10px] md:text-xs font-medium transition-all ${aiConfig.featureFocus === focus
                          ? 'bg-white text-amber-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                          }`}
                        disabled={isGenerating}
                      >
                        {focus === 'general' ? strings.focusGeneral : focus === 'reproductive' ? strings.focusRepro : strings.focusVeg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders (Topic Only) */}
                {aiMode === 'TOPIC' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{strings.numEntities}</label>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{aiConfig.count}</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="100"
                        step="1"
                        value={aiConfig.count}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        disabled={isGenerating}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{strings.numFeatures}</label>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{aiConfig.featureCount}</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="20"
                        step="1"
                        value={aiConfig.featureCount}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, featureCount: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Required Features Dropdown */}
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{strings.requiredFeatures}</label>
                        {requiredFeatures.length > 0 && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {requiredFeatures.length} {strings.selectedFeatures}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRequiredFeaturesDropdown(!showRequiredFeaturesDropdown)}
                        className="w-full px-3 py-2 text-left text-sm bg-white border border-slate-200 rounded-lg hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-colors flex items-center justify-between"
                        disabled={isGenerating}
                      >
                        <span className={requiredFeatures.length > 0 ? 'text-slate-700' : 'text-slate-400'}>
                          {requiredFeatures.length > 0 
                            ? requiredFeatures.slice(0, 2).join(', ') + (requiredFeatures.length > 2 ? ` +${requiredFeatures.length - 2}` : '')
                            : strings.requiredFeaturesDesc}
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showRequiredFeaturesDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showRequiredFeaturesDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto custom-scrollbar">
                          {/* Custom input */}
                          <div className="sticky top-0 bg-white border-b p-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customFeatureInput}
                                onChange={(e) => setCustomFeatureInput(e.target.value)}
                                placeholder={strings.addCustomFeature}
                                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-amber-400"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customFeatureInput.trim()) {
                                    if (!requiredFeatures.includes(customFeatureInput.trim())) {
                                      setRequiredFeatures(prev => [...prev, customFeatureInput.trim()]);
                                    }
                                    setCustomFeatureInput('');
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (customFeatureInput.trim() && !requiredFeatures.includes(customFeatureInput.trim())) {
                                    setRequiredFeatures(prev => [...prev, customFeatureInput.trim()]);
                                    setCustomFeatureInput('');
                                  }
                                }}
                                className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {/* Selected features (removable) */}
                          {requiredFeatures.length > 0 && (
                            <div className="p-2 border-b bg-emerald-50/50">
                              <div className="text-xs font-semibold text-emerald-700 mb-1.5 uppercase">
                                {language === 'pt' ? 'Selecionadas' : 'Selected'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {requiredFeatures.map((feature, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full"
                                  >
                                    {feature}
                                    <button
                                      type="button"
                                      onClick={() => setRequiredFeatures(prev => prev.filter(f => f !== feature))}
                                      className="hover:text-red-500"
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Suggested features by category */}
                          {suggestedFeatures.map((category, catIdx) => (
                            <div key={catIdx}>
                              <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase sticky top-[52px]">
                                {category.category}
                              </div>
                              {category.items.map((item, itemIdx) => {
                                const isSelected = requiredFeatures.includes(item);
                                return (
                                  <button
                                    key={itemIdx}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setRequiredFeatures(prev => prev.filter(f => f !== item));
                                      } else {
                                        setRequiredFeatures(prev => [...prev, item]);
                                      }
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-amber-50 flex items-center justify-between transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}
                                  >
                                    <span>{item}</span>
                                    {isSelected && <Check size={14} className="text-emerald-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Image Toggles (Shared) */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span className="text-sm font-medium text-slate-700">{strings.fetchSpeciesImg}</span>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${aiConfig.includeSpeciesImages ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${aiConfig.includeSpeciesImages ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={aiConfig.includeSpeciesImages}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, includeSpeciesImages: e.target.checked }))}
                      disabled={isGenerating}
                    />
                  </label>
                  {/* Feature Images - Available for BOTH modes now */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <Settings2 size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span className="text-sm font-medium text-slate-700">{strings.fetchFeatureImg}</span>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${aiConfig.includeFeatureImages ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${aiConfig.includeFeatureImages ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={aiConfig.includeFeatureImages}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, includeFeatureImages: e.target.checked }))}
                      disabled={isGenerating}
                    />
                  </label>
                  {/* External Links Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <LinkIcon size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span className="text-sm font-medium text-slate-700">{strings.fetchLinks}</span>
                    </div>
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${aiConfig.includeLinks ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${aiConfig.includeLinks ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={aiConfig.includeLinks}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, includeLinks: e.target.checked }))}
                      disabled={isGenerating}
                    />
                  </label>
                </div>
              </div>
              )}

              {isGenerating && (
                <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> {generatingMessage || (aiMode === 'IMPORT' ? strings.analyzing : strings.generating)}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex gap-3 shrink-0 safe-area-bottom">
              <button
                onClick={handleCloseAiModal}
                className="flex-none w-16 md:w-20 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors text-center text-xs md:text-sm"
              >
                {strings.cancel}
              </button>

              <button
                onClick={handleOpenPromptEditor}
                className="w-auto px-3 py-2 text-xs bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-amber-400 hover:text-amber-600 shadow-sm transition-all flex items-center justify-center gap-2"
                disabled={isGenerating || (aiMode === 'TOPIC' && !aiConfig.topic) || (aiMode === 'IMPORT' && !importedFile) || (aiMode === 'REFINE' && project.entities.length === 0) || (aiMode === 'MERGE' && (!mergeKey1 || !mergeKey2))}
                title="View and edit the prompt before sending"
              >
                <Edit3 size={14} /> <span className="hidden sm:inline">View/Edit Prompt</span>
              </button>

              {aiMode === 'REFINE' ? (
              <button
                onClick={handleRefineGenerate}
                className={`flex-1 py-2.5 ${refineAction === 'VALIDATE' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-900/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20'} text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm`}
                disabled={isGenerating || project.entities.length === 0}
              >
                {refineAction === 'EXPAND' ? strings.actionExpand : refineAction === 'REFINE' ? strings.actionRefine : refineAction === 'CLEAN' ? strings.actionClean : refineAction === 'VALIDATE' ? strings.actionValidate : strings.actionPhotos} {refineAction === 'VALIDATE' ? <ShieldCheck size={16} className="opacity-70" /> : <Sparkles size={16} className="opacity-70" />}
              </button>
              ) : aiMode === 'MERGE' ? (
              <button
                onClick={handleMergeGenerate}
                className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                disabled={isGenerating || !mergeKey1 || !mergeKey2}
              >
                {strings.mergeAction} <Combine size={16} className="opacity-70" />
              </button>
              ) : (
              <button
                onClick={handleAiGenerate}
                className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                disabled={isGenerating || (aiMode === 'TOPIC' && !aiConfig.topic) || (aiMode === 'IMPORT' && !importedFile)}
              >
                {strings.generate} <Wand2 size={16} className="opacity-70" />
              </button>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Prompt Editor Modal */}
      {showPromptEditor && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col h-[80vh] max-h-[90vh] animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Edit3 size={18} className="text-amber-400" />
                Prompt Editor
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(manualPrompt);
                    alert(strings.promptCopied);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white"
                  disabled={isGenerating}
                >
                  <Copy size={12} /> {strings.copyPrompt}
                </button>
                <button onClick={handleClosePromptEditor} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-slate-100 min-h-0 flex flex-col gap-2">
              {/* Import Mode Toggle - Shown when pendingNervuraFile is present */}
              {pendingNervuraFile && !isGenerating && !pendingImportProject && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3 text-center">
                    {language === 'pt' ? 'Modo de Importação' : 'Import Mode'}
                  </p>
                  <div className="flex rounded-xl overflow-hidden border-2 border-slate-200">
                    <button
                      onClick={() => setOptimizeNervura(false)}
                      className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
                        !optimizeNervura 
                          ? 'bg-slate-800 text-white' 
                          : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <FileCode size={18} />
                      <div className="text-left">
                        <div className="font-bold text-sm">{language === 'pt' ? 'Fiel' : 'Faithful'}</div>
                        <div className="text-[10px] opacity-70">{language === 'pt' ? 'Sem alterações' : 'No changes'}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setOptimizeNervura(true)}
                      className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
                        optimizeNervura 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' 
                          : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Sparkles size={18} />
                      <div className="text-left">
                        <div className="font-bold text-sm">{language === 'pt' ? 'Otimizar' : 'Optimize'}</div>
                        <div className="text-[10px] opacity-70">{language === 'pt' ? 'IA padroniza' : 'AI cleans'}</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
              
              {/* AI Typing Effect Display - Shown during generation OR when showing import status */}
              {(isGenerating || pendingNervuraFile || pendingImportProject || aiTypingText) ? (
                <div 
                  ref={typingContainerRef}
                  className="w-full flex-1 p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200 font-mono text-sm rounded-lg overflow-auto custom-scrollbar border-2 border-amber-500/30"
                >
                  <div className="whitespace-pre-wrap">
                    {aiTypingText || (language === 'pt' ? 'Aguardando...' : 'Waiting...')}
                    {isGenerating && !aiTypingComplete && (
                      <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1 align-middle"></span>
                    )}
                  </div>
                </div>
              ) : (
                /* Prompt Textarea - Only shown when NOT in import mode */
                <textarea
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  className="w-full flex-1 p-4 bg-slate-900 text-slate-200 font-mono text-sm rounded-lg resize-none outline-none border-2 border-transparent focus:border-amber-500"
                  spellCheck="false"
                />
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 shrink-0 flex items-center justify-between gap-4">
              {/* Generation progress indicator */}
              {isGenerating && (
                <div className="flex items-center gap-2 text-amber-600">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm font-medium">{language === 'pt' ? 'IA processando...' : 'AI processing...'}</span>
                </div>
              )}
              
              <div className="flex items-center gap-4 ml-auto">
                <button
                  onClick={handleClosePromptEditor}
                  className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {strings.cancel}
                </button>
                
                {pendingImportProject ? (
                  <button
                    onClick={() => {
                      setProject(pendingImportProject);
                      setPendingImportProject(null);
                      setPendingNervuraFile(null);
                      setShowPromptEditor(false);
                      setShowAiModal(false);
                      
                      // Also save to localStorage logic if needed (copied from original import)
                      const saved = localStorage.getItem('nozesia_projects');
                      let projectsList: Project[] = [];
                      if (saved) { try { projectsList = JSON.parse(saved); } catch (err) {} }
                      const updatedList = [pendingImportProject, ...projectsList.filter((p: Project) => p.id !== pendingImportProject.id)];
                      localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));
                      if (onProjectImported) onProjectImported(pendingImportProject);
                      
                      alert(language === 'pt' ? 'Chave importada com sucesso!' : 'Key imported successfully!');
                    }}
                    className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 flex items-center gap-2"
                  >
                    {language === 'pt' ? 'Confirmar Importação' : 'Confirm Import'} <Check size={16} />
                  </button>
                ) : pendingNervuraFile ? (
                  <button
                    onClick={executeNervuraImport}
                    className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center gap-2"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <><Loader2 className="animate-spin" size={16} /> {language === 'pt' ? 'Processando...' : 'Processing...'}</>
                    ) : (
                      <>{optimizeNervura ? (language === 'pt' ? 'Otimizar e Importar' : 'Optimize & Import') : (language === 'pt' ? 'Importar Chave' : 'Import Key')} <Wand2 size={16} /></>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSendManualPrompt}
                    className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center gap-2"
                    disabled={isGenerating}
                  >
                    {isGenerating ? <><Loader2 className="animate-spin" size={16} /> {generatingMessage || strings.generating}</> : <>{strings.generate}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State Image Viewer Modal */}
      {expandedStateImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedStateImage(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative">
              <img 
                src={expandedStateImage.url} 
                alt={expandedStateImage.label}
                className="w-full max-h-[60vh] object-contain bg-slate-100"
              />
              <button 
                onClick={() => setExpandedStateImage(null)}
                className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-white">
              <h4 className="font-semibold text-slate-800">{expandedStateImage.label}</h4>
              <p className="text-sm text-slate-500">{expandedStateImage.featureName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Format Detection Modal */}
      {showFormatModal && detectedFormat && pendingSpreadsheetData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileSearch className="text-emerald-600" size={20} />
              {language === 'pt' ? 'Formato Detectado' : 'Format Detected'}
            </h3>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔍</span>
                <div>
                  <p className="font-semibold text-emerald-900">{detectedFormat.description}</p>
                  <p className="text-sm text-emerald-700">
                    {language === 'pt' ? 'Confiança' : 'Confidence'}: {Math.round(detectedFormat.confidence * 100)}%
                  </p>
                </div>
              </div>
            </div>

            {detectedFormat.format === 'linked_hub' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-900 mb-2">
                  <strong>🔗 {language === 'pt' ? 'Chave com Múltiplas Referências Detectada!' : 'Linked Key System Detected!'}</strong>
                </p>
                <p className="text-sm text-amber-800 mb-3">
                  {language === 'pt'
                    ? 'Esta chave referencia outras chaves (ex: Chave A, Chave B, etc). Para melhor experiência, recomendamos importar TODOS os arquivos relacionados.'
                    : 'This key references other keys (e.g., Key A, Key B, etc). For best experience, we recommend importing ALL related files.'}
                </p>
                <label className="block">
                  <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center hover:border-amber-400 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Upload className="mx-auto mb-2 text-amber-600" size={32} />
                    <p className="text-sm font-medium text-amber-900">
                      {language === 'pt' ? 'Selecionar Múltiplos Arquivos' : 'Select Multiple Files'}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {language === 'pt' ? 'Use Ctrl/Cmd para selecionar vários' : 'Use Ctrl/Cmd to select multiple'}
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv"
                    onChange={handleMultipleFiles}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <button
                onClick={async () => {
                  if (!aiConfig.model) {
                    alert(language === 'pt' ? 'Configure a API Key primeiro' : 'Configure API Key first');
                    return;
                  }
                  setShowFormatModal(false);
                  setIsConvertingWithAI(true);
                  try {
                    const project = await convertDichotomousKey(
                      aiConfig.model,
                      pendingSpreadsheetData.data,
                      pendingSpreadsheetData.fileName,
                      language
                    );
                    setProject(project);
                    const saved = localStorage.getItem('nozesia_projects');
                    let projectsList: Project[] = saved ? JSON.parse(saved) : [];
                    projectsList = [project, ...projectsList.filter(p => p.id !== project.id)];
                    localStorage.setItem('nozesia_projects', JSON.stringify(projectsList));
                    if (onProjectImported) onProjectImported(project);
                  } catch (error) {
                    alert(language === 'pt' ? 'Erro na conversão' : 'Conversion error');
                  } finally {
                    setIsConvertingWithAI(false);
                    setPendingSpreadsheetData(null);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
              >
                <Brain size={18} />
                {language === 'pt' ? 'Converter com IA (Somente este arquivo)' : 'Convert with AI (This file only)'}
              </button>

              <button
                onClick={() => {
                  setShowFormatModal(false);
                  setPendingSpreadsheetData(null);
                }}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Files Selection Modal */}
      {showMultiFileModal && multipleFiles.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Layers className="text-emerald-600" size={20} />
              {language === 'pt' ? 'Importar Chaves Interligadas' : 'Import Linked Keys'}
            </h3>

            <p className="text-sm text-slate-600 mb-4">
              {language === 'pt'
                ? `${multipleFiles.length} arquivos selecionados. Escolha qual é a chave principal (hub):`
                : `${multipleFiles.length} files selected. Choose which is the main key (hub):`}
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto mb-4 custom-scrollbar">
              {multipleFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="mainKey"
                    id={`file-${idx}`}
                    defaultChecked={idx === 0}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <label htmlFor={`file-${idx}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-slate-800 text-sm">{file.name}</div>
                    <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                  </label>
                  {file.name.toLowerCase().includes('geral') && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                      {language === 'pt' ? 'Sugerido' : 'Suggested'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-900">
                <strong>ℹ️ {language === 'pt' ? 'Como funciona:' : 'How it works:'}</strong>
                <br />
                {language === 'pt'
                  ? 'A IA irá processar cada chave e criar links automáticos entre elas. A chave principal será carregada no editor e as sub-chaves ficarão acessíveis via navegação.'
                  : 'AI will process each key and create automatic links between them. The main key will be loaded in the editor and sub-keys will be accessible via navigation.'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const selectedIndex = Array.from(document.querySelectorAll('input[name="mainKey"]'))
                    .findIndex((input: any) => input.checked);
                  processMultipleFilesWithAI(multipleFiles, selectedIndex);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                {language === 'pt' ? 'Processar com IA' : 'Process with AI'}
              </button>

              <button
                onClick={() => {
                  setShowMultiFileModal(false);
                  setMultipleFiles([]);
                }}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Project Modal (Global) */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FolderOpen className="text-emerald-600" size={20} />
              {strings.open}
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4 custom-scrollbar">
              {savedProjects.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">{strings.noSaved}</p>
              ) : (
                savedProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadFromLocal(p)}
                    className="w-full text-left p-3 hover:bg-emerald-50 rounded-lg border border-slate-100 hover:border-emerald-200 group transition-all"
                  >
                    <div className="font-medium text-slate-800 group-hover:text-emerald-700">{p.name}</div>
                    <div className="text-xs text-slate-400 truncate">{p.description || "No description"}</div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              {strings.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};