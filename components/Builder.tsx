import React, { useState, useEffect } from 'react';
import { Project, Entity, Feature, AIConfig, Language, FeatureFocus, ImportedFile } from '../types';
import { generateKeyFromTopic, buildPromptData, generateKeyFromCustomPrompt, fetchImagesForEntities } from '../services/geminiService';
import { Wand2, Plus, Trash2, Save, Grid, LayoutList, Box, Loader2, CheckSquare, X, Download, Upload, Image as ImageIcon, FolderOpen, Settings2, Brain, Microscope, Baby, GraduationCap, FileText, FileSearch, Copy, Link as LinkIcon, Edit3, ExternalLink, Menu, Play, FileSpreadsheet, Edit, ChevronLeft, ChevronRight, RefreshCw, Sparkles, ListPlus, Eraser, Target, Layers, Combine, Camera, KeyRound, FileCode } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

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
        createdWith: "Created with NOZESia", viewResults: "View Results", excluded: "Excluded by selection"
      },
      pt: {
        features: "Características", selected: "selecionado(s)", matches: "Compatíveis", discarded: "Descartados",
        restart: "Reiniciar", noMatches: "Nenhum resultado.", tryUnselecting: "Tente remover seleções.",
        potential: "matches potenciais", identified: "1 Entidade identificada", close: "Fechar",
        speciesDetails: "Detalhes da Espécie", morphology: "Morfologia & Características", resources: "Recursos Adicionais",
        createdWith: "Criado com NOZESia", viewResults: "Ver Resultados", excluded: "Excluído pela seleção"
      }
    };
    const strings = t[lang];
    
    let selections = {};
    let showDiscarded = false;
    let viewingEntity = null;
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
        entityModalHTML = \`
          <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeEntity()">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div class="relative h-48 sm:h-64 bg-slate-200 shrink-0">
                \${e.imageUrl ? \`<img src="\${e.imageUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">\` : '<div class="w-full h-full flex items-center justify-center text-slate-400 text-6xl">🌿</div>'}
                <button onclick="closeEntity()" class="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-2">✕</button>
              </div>
              <div class="p-6 overflow-y-auto custom-scrollbar">
                <h2 class="text-2xl font-bold text-slate-800 mb-1">\${e.name}</h2>
                \${e.description ? \`<p class="text-slate-600 mb-4">\${e.description}</p>\` : ''}
                <div class="mt-4"><h4 class="font-semibold text-slate-700 mb-2">\${strings.morphology}</h4><div class="text-sm">\${traitsHTML}</div></div>
                \${linksHTML}
              </div>
            </div>
          </div>
        \`;
      }
      
      const featuresHTML = project.features.map(f => {
        const selStates = selections[f.id] || [];
        return \`
          <div class="bg-slate-50 rounded-xl p-4">
            <h4 class="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              \${f.imageUrl ? \`<img src="\${f.imageUrl}" class="w-6 h-6 rounded object-cover">\` : ''}
              \${f.name}
              \${selStates.length > 0 ? \`<span class="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">\${selStates.length}</span>\` : ''}
            </h4>
            <div class="flex flex-wrap gap-2">
              \${f.states.map(s => {
                const isSel = selStates.includes(s.id);
                return \`<button onclick="toggleSelection('\${f.id}','\${s.id}')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all \${isSel ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">\${s.label}</button>\`;
              }).join('')}
            </div>
          </div>
        \`;
      }).join('');
      
      const entityCard = (e, isDiscarded = false) => \`
        <div onclick="viewEntity(project.entities.find(x=>x.id==='\${e.id}'))" class="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden border \${isDiscarded ? 'border-red-200 opacity-60' : 'border-slate-200 hover:border-emerald-300'}">
          <div class="h-32 bg-slate-100 relative">
            \${e.imageUrl ? \`<img src="\${e.imageUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\\\'w-full h-full flex items-center justify-center text-slate-300 text-4xl\\\\'>🌿</div>'">\` : '<div class="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🌿</div>'}
            \${isDiscarded ? '<div class="absolute inset-0 bg-red-500/20 flex items-center justify-center"><span class="bg-red-500 text-white text-xs px-2 py-1 rounded">✕</span></div>' : ''}
          </div>
          <div class="p-3">
            <h4 class="font-semibold text-slate-800 text-sm truncate">\${e.name}</h4>
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
type RefineAction = 'EXPAND' | 'REFINE' | 'CLEAN' | 'PHOTOS';

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
    topicPlace: "e.g. Freshwater Fishes, Garden Weeds",
    geography: "Geography / Biome",
    taxonomy: "Taxonomy Filter",
    numEntities: "Approx. # of Entities",
    numFeatures: "Approx. # of Features",
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
    improveDescriptions: "Improve descriptions",
    fillGaps: "Fill missing trait data",
    removeRedundant: "Remove redundant features",
    fixInconsistencies: "Fix inconsistencies",
    currentProject: "Current Project",
    noProjectLoaded: "No project loaded. Create or load a project first.",
    entitiesCount: "entities",
    featuresCount: "features",
    completePhotos: "Complete Photo Collection",
    completePhotosDesc: "Fill missing images with valid URLs",
    photoTargetEntities: "Entity Images",
    photoTargetFeatures: "Feature Images",
    photoTargetBoth: "Both",
    actionPhotos: "Complete Photos",
    actionPhotosDesc: "Fill all missing images with real URLs",
    photosActionDesc: "Select which images to complete with valid URLs",
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
    mergeLoaded: "loaded"
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
    topicPlace: "ex: Peixes de Água Doce, Ervas Daninhas",
    geography: "Geografia / Bioma",
    taxonomy: "Filtro Taxonômico",
    numEntities: "Aprox. # de Entidades",
    numFeatures: "Aprox. # de Características",
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
    improveDescriptions: "Melhorar descrições",
    fillGaps: "Preencher dados de características faltantes",
    removeRedundant: "Remover características redundantes",
    fixInconsistencies: "Corrigir inconsistências",
    currentProject: "Projeto Atual",
    noProjectLoaded: "Nenhum projeto carregado. Crie ou carregue um projeto primeiro.",
    entitiesCount: "entidades",
    featuresCount: "características",
    completePhotos: "Completar Acervo Fotográfico",
    completePhotosDesc: "Preencher imagens faltantes com URLs válidas",
    photoTargetEntities: "Imagens de Entidades",
    photoTargetFeatures: "Imagens de Características",
    photoTargetBoth: "Ambos",
    actionPhotos: "Completar Fotos",
    actionPhotosDesc: "Preencher todas as imagens faltantes com URLs reais",
    photosActionDesc: "Selecione quais imagens completar com URLs válidas",
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
    mergeLoaded: "carregado"
  }
};

export const Builder: React.FC<BuilderProps> = ({ initialProject, onSave, onCancel, language, defaultModel, apiKey, onOpenSettings, reopenAiModal, onAiModalOpened, onProjectImported }) => {
  const strings = t[language];
  // State
  const [project, setProject] = useState<Project>(initialProject || {
    id: Math.random().toString(36).substr(2, 9),
    name: language === 'pt' ? "Nova Chave" : "New Key",
    description: "",
    features: [],
    entities: []
  });
  const [activeTab, setActiveTab] = useState<Tab>('GENERAL');

  // AI Generation State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    topic: "",
    count: 10,
    featureCount: 5,
    geography: "",
    taxonomy: "",
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
  const [aiMode, setAiMode] = useState<AiMode>('TOPIC');
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Mobile Header Menu

  // Refine Mode State
  const [refineAction, setRefineAction] = useState<RefineAction>('EXPAND');
  const [refineOptions, setRefineOptions] = useState({
    expandCount: 10,
    keepExisting: true,
    addFeatures: true,
    improveDescriptions: true,
    fillGaps: true,
    removeRedundant: false,
    fixInconsistencies: true,
    completePhotos: false,
    photoTarget: 'both' as 'entities' | 'features' | 'both',
    photoMode: 'expand' as 'replace' | 'expand',
    photoCustomSources: ''
  });

  // Merge Mode State
  const [mergeKey1, setMergeKey1] = useState<Project | null>(null);
  const [mergeKey2, setMergeKey2] = useState<Project | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<'union' | 'intersection' | 'primary'>('union');

  // Prompt Editor State
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("");
  const [aiTypingText, setAiTypingText] = useState(""); // Simulated AI typing response
  const [aiTypingComplete, setAiTypingComplete] = useState(false); // Whether typing animation is complete
  const typingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const typingContainerRef = React.useRef<HTMLDivElement | null>(null); // Ref for auto-scroll

  // Entity Trait Editor State
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

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

  const saveToLocal = () => {
    const updatedList = [project, ...savedProjects.filter(p => p.id !== project.id)];
    setSavedProjects(updatedList);
    localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));
    alert(strings.savedMsg);
  };

  const loadFromLocal = (p: Project) => {
    setProject(p);
    setShowLoadModal(false);
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${project.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportXLSX = () => {
    const workbook = utils.book_new();

    // 1. Entities Sheet
    const entityRows = project.entities.map(e => ({
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
    const featureRows = project.features.map(f => ({
      ID: f.id,
      Name: f.name,
      ImageURL: f.imageUrl,
      States: f.states.map(s => s.label).join("; ")
    }));
    const wsFeatures = utils.json_to_sheet(featureRows);
    utils.book_append_sheet(workbook, wsFeatures, "Features");

    // 3. Matrix Sheet
    const matrixRows = project.entities.map(entity => {
      const row: any = { Entity: entity.name };
      project.features.forEach(feature => {
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
      Name: project.name,
      Description: project.description,
      ExportDate: new Date().toISOString().split('T')[0],
      TotalEntities: project.entities.length,
      TotalFeatures: project.features.length
    }];
    const wsProject = utils.json_to_sheet(projectRows);
    utils.book_append_sheet(workbook, wsProject, "Project Info");

    // Save file
    writeFile(workbook, `${project.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Export as standalone HTML
  const exportHTML = () => {
    const htmlContent = generateStandaloneHTML(project, language);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
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
            alert("Invalid project file format.");
          }
        } catch (error) {
          alert("Error parsing JSON file.");
        }
      };
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportedFile(event.target.files[0]);
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
                ? `\n🌱 "${entity.name}": ${entity.description.substring(0, 150)}${entity.description.length > 150 ? '...' : ''}`
                : `\n🌱 "${entity.name}": ${entity.description.substring(0, 150)}${entity.description.length > 150 ? '...' : ''}`;
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
      
      const summaryMsg = language === 'pt'
        ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ANÁLISE CONCLUÍDA!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Resumo da Geração:\n\n   🌿 Entidades: ${entitiesCount}\n   🔬 Características: ${featuresCount}\n   📋 Estados totais: ${statesCount}\n   📷 Com fotos: ${withPhotos}/${entitiesCount}\n   🔗 Com links: ${withLinks}/${entitiesCount}\n\n🎉 Sua chave de identificação está pronta!`
        : `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ANALYSIS COMPLETE!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Generation Summary:\n\n   🌿 Entities: ${entitiesCount}\n   🔬 Features: ${featuresCount}\n   📋 Total states: ${statesCount}\n   📷 With photos: ${withPhotos}/${entitiesCount}\n   🔗 With links: ${withLinks}/${entitiesCount}\n\n🎉 Your identification key is ready!`;
      
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
      let config = { ...aiConfig };

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
    const projectJson = JSON.stringify({
      name: project.name,
      description: project.description,
      features: project.features.map(f => ({
        name: f.name,
        imageUrl: f.imageUrl || '',
        states: f.states.map(s => s.label)
      })),
      entities: project.entities.map(e => ({
        name: e.name,
        description: e.description,
        imageUrl: e.imageUrl || '',
        traits: Object.entries(e.traits).map(([fid, sids]) => {
          const feature = project.features.find(f => f.id === fid);
          return sids.map(sid => {
            const state = feature?.states.find(s => s.id === sid);
            return { featureName: feature?.name || '', stateValue: state?.label || '' };
          });
        }).flat()
      }))
    }, null, 2);

    let refinePrompt = '';
    
    // PHOTOS action - dedicated photo completion prompt (optimized: send only names, not full JSON)
    if (refineAction === 'PHOTOS') {
      const targetEntities = refineOptions.photoTarget === 'entities' || refineOptions.photoTarget === 'both';
      const targetFeatures = refineOptions.photoTarget === 'features' || refineOptions.photoTarget === 'both';
      const replaceMode = refineOptions.photoMode === 'replace';
      const customSources = refineOptions.photoCustomSources?.trim();
      
      // Build compact data: only names and optionally current URLs
      let photoData: any = { name: project.name };
      
      if (targetEntities) {
        photoData.entities = project.entities.map(e => ({
          name: e.name,
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
${sourceInstructions}
1. **iNaturalist** - Search: https://www.inaturalist.org/taxa/search?q=[species_name]
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

## FALLBACK (only if no real photo found):
Use placeholder: https://placehold.co/400x300/e2e8f0/64748b?text=[URL-encoded-name]

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
      refinePrompt = `
You are an expert taxonomist. I have an existing identification key that I want to EXPAND with more entities.

CURRENT KEY (JSON):
${projectJson}

TASK: Add ${refineOptions.expandCount} NEW entities (species/taxa) to this key.

CRITICAL RULES:
1. DO NOT repeat any of the existing ${project.entities.length} entities. Each new entity MUST be unique.
2. New entities should be taxonomically related or similar to existing ones (same family/genus/habitat).
3. ${refineOptions.keepExisting ? 'PRESERVE all existing entities in the output.' : 'Replace existing entities with new ones.'}
4. ${refineOptions.addFeatures ? 'You MAY add 1-3 new discriminating features if needed to distinguish new species.' : 'Use ONLY the existing features.'}
5. For each new entity, assign appropriate trait values using the existing feature states.
6. Maintain the same level of detail and language (${language === 'pt' ? 'Portuguese' : 'English'}).

OUTPUT: Return a complete JSON with the expanded key including all entities (existing + new).
`;
    } else if (refineAction === 'REFINE') {
      refinePrompt = `
You are an expert taxonomist. I have an existing identification key that I want to REFINE and improve.

CURRENT KEY (JSON):
${projectJson}

TASK: Improve and refine this identification key.

IMPROVEMENTS TO MAKE:
${refineOptions.improveDescriptions ? '- Improve entity descriptions with more accurate biological information.' : ''}
${refineOptions.fillGaps ? '- Fill in missing trait data where entities lack assignments.' : ''}
${refineOptions.addFeatures ? '- Add 2-4 new discriminating features that help better distinguish between entities.' : ''}

RULES:
1. Keep all existing entities.
2. Maintain the same language (${language === 'pt' ? 'Portuguese' : 'English'}).
3. Ensure scientific accuracy.
4. Make features more discriminating (each state should ideally apply to different subsets of entities).

OUTPUT: Return the improved JSON key.
`;
    } else { // CLEAN
      refinePrompt = `
You are an expert taxonomist. I have an existing identification key that I want to CLEAN and optimize.

CURRENT KEY (JSON):
${projectJson}

TASK: Clean and optimize this identification key.

OPTIMIZATIONS TO MAKE:
${refineOptions.removeRedundant ? '- Remove redundant features (features where all entities have the same state).' : ''}
${refineOptions.fixInconsistencies ? '- Fix any inconsistencies in trait assignments.' : ''}
- Ensure each feature has meaningful variation across entities.
- Remove empty or meaningless states.

RULES:
1. Keep all entities.
2. Maintain the same language (${language === 'pt' ? 'Portuguese' : 'English'}).
3. Only remove features that provide no discriminating value.

OUTPUT: Return the cleaned JSON key.
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
    setIsGenerating(true);
    try {
      const mergePrompt = buildMergePrompt();
      const generatedProject = await generateKeyFromCustomPrompt(mergePrompt, apiKey, aiConfig.model);
      
      setProject(generatedProject);
      setShowAiModal(false);
      setActiveTab('MATRIX');
    } catch (e) {
      console.error(e);
      alert(strings.errGen);
    } finally {
      setIsGenerating(false);
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
    setIsGenerating(true);
    setGeneratingMessage('');
    try {
      // PHOTOS action - Use direct API fetching instead of Gemini (much more reliable!)
      if (refineAction === 'PHOTOS') {
        const targetEntities = refineOptions.photoTarget === 'entities' || refineOptions.photoTarget === 'both';
        const targetFeatures = refineOptions.photoTarget === 'features' || refineOptions.photoTarget === 'both';
        const replaceMode = refineOptions.photoMode === 'replace';
        
        let updatedProject = { ...project };
        
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
              }
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
        // For now, we skip feature image fetching via API (would need specific image sources)
        if (targetFeatures) {
          setGeneratingMessage(language === 'pt' 
            ? '⚠️ Imagens de características não suportadas via API automática'
            : '⚠️ Feature images not supported via automatic API');
          await new Promise(r => setTimeout(r, 1500));
        }
        
        setProject(updatedProject);
        setShowAiModal(false);
        setActiveTab('ENTITIES');
        
        const foundCount = targetEntities 
          ? updatedProject.entities.filter(e => e.imageUrl && !e.imageUrl.includes('picsum.photos')).length
          : 0;
        const totalCount = targetEntities ? project.entities.length : 0;
        
        alert(language === 'pt' 
          ? `✅ Busca concluída! ${foundCount}/${totalCount} imagens encontradas via iNaturalist/Wikipedia.`
          : `✅ Search complete! ${foundCount}/${totalCount} images found via iNaturalist/Wikipedia.`);
        
        return;
      }

      // Other refine actions use Gemini
      const refinePrompt = buildRefinePrompt();

      const generatedProject = await generateKeyFromCustomPrompt(refinePrompt, apiKey, aiConfig.model);
      
      setProject(generatedProject);
      setShowAiModal(false);
      setActiveTab('MATRIX');
    } catch (e) {
      console.error(e);
      alert(strings.errGen);
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
      const generatedProject = await generateKeyFromCustomPrompt(manualPrompt, apiKey, aiConfig.model);
      
      // Stop typing effect and show summary
      stopTypingEffect(generatedProject);
      
      // Wait a moment so user can see the summary
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProject(generatedProject);
      setActiveTab('MATRIX');
      setShowPromptEditor(false);
    } catch (e) {
      console.error(e);
      // Stop typing and show error
      stopTypingEffect();
      setAiTypingText(prev => prev + (language === 'pt' 
        ? "\n\n❌ ERRO: Não foi possível gerar a chave. Por favor, tente novamente."
        : "\n\n❌ ERROR: Could not generate the key. Please try again."));
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(strings.errGen);
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
    setShowAiModal(true);
  };

  const addFeature = () => {
    const newFeature: Feature = {
      id: Math.random().toString(36).substr(2, 9),
      name: language === 'pt' ? "Nova Característica" : "New Feature",
      imageUrl: "",
      states: [{ id: Math.random().toString(36).substr(2, 9), label: language === 'pt' ? "Estado 1" : "State 1" }]
    };
    setProject(p => ({ ...p, features: [...p.features, newFeature] }));
  };

  const addEntity = () => {
    const newEntity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      name: language === 'pt' ? "Nova Entidade" : "New Entity",
      description: "...",
      links: [],
      traits: {}
    };
    setProject(p => ({ ...p, entities: [...p.entities, newEntity] }));
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
              <input type="file" accept=".json" onChange={importJSON} className="hidden" />
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
            <input type="file" accept=".json" onChange={importJSON} className="hidden" />
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
                      {feature.states.map((state, sIdx) => (
                        <div key={state.id} className="flex items-center gap-2 group/state">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-focus-within/state:bg-emerald-400"></div>
                          <input
                            value={state.label}
                            onChange={(e) => {
                              const newFeatures = [...project.features];
                              newFeatures[fIdx].states[sIdx].label = e.target.value;
                              setProject(p => ({ ...p, features: newFeatures }));
                            }}
                            className="text-sm bg-transparent outline-none w-full text-slate-600 focus:text-slate-900 focus:font-medium"
                          />
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
                      ))}
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
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{strings.manageEntities}</h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                      {project.entities.length} {language === 'pt' ? 'entidades' : 'entities'}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-500">{strings.manageEntitiesDesc}</p>
                </div>
                <button onClick={addEntity} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow-md transition-all">
                  <Plus size={16} /> <span className="hidden sm:inline">{strings.addEntity}</span>
                </button>
              </div>
              <div className="space-y-4">
                {project.entities.map((entity, eIdx) => (
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
                ))}
              </div>
            </div>
          )}

          {activeTab === 'MATRIX' && (
            <div className="flex flex-col h-full bg-slate-50 min-h-[500px]">
              <div className="p-4 border-b bg-white">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-700">{strings.scoringMatrix}</h3>
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
                      {project.entities.map((entity, idx) => (
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Yellow/Gold Header */}
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4 md:p-6 text-white shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Brain size={24} className="text-white" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold flex-1">{strings.aiTitle}</h3>
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
              <p className="text-amber-50 text-xs md:text-sm font-medium drop-shadow-sm">
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
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'TOPIC' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><Wand2 size={14} /> <span className="hidden sm:inline">{strings.modeTopic}</span><span className="sm:hidden">Gerar</span></span>
              </button>
              <button
                onClick={() => setAiMode('IMPORT')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'IMPORT' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><FileSearch size={14} /> <span className="hidden sm:inline">{strings.modeImport}</span><span className="sm:hidden">Importar</span></span>
              </button>
              <button
                onClick={() => setAiMode('REFINE')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'REFINE' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-1"><Sparkles size={14} /> <span className="hidden sm:inline">{strings.modeRefine}</span><span className="sm:hidden">Refinar</span></span>
              </button>
              <button
                onClick={() => setAiMode('MERGE')}
                className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${aiMode === 'MERGE' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
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
                      placeholder={strings.topicPlace}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-base md:text-lg"
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{strings.geography}</label>
                      <input
                        value={aiConfig.geography}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, geography: e.target.value }))}
                        placeholder="e.g. Amazon"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                        disabled={isGenerating}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{strings.taxonomy}</label>
                      <input
                        value={aiConfig.taxonomy}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, taxonomy: e.target.value }))}
                        placeholder="e.g. Felidae"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                        disabled={isGenerating}
                      />
                    </div>
                  </div>
                </>
              ) : aiMode === 'IMPORT' ? (
                /* IMPORT MODE INPUTS */
                <div className="flex flex-col gap-4">
                  <div className="text-center space-y-2 mb-2">
                    <h4 className="font-bold text-slate-800 text-lg">{strings.uploadLabel}</h4>
                    <p className="text-slate-500 text-sm">{strings.uploadDesc}</p>
                  </div>

                  <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all bg-slate-50 ${importedFile ? 'border-amber-500 bg-amber-50/30' : 'border-slate-300 hover:border-amber-400'}`}>
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
                        <div className="p-4 bg-white rounded-full shadow-sm">
                          <Upload size={24} className="text-amber-500" />
                        </div>
                        <span className="font-bold text-slate-600">{strings.dropFile}</span>
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
                          max="50"
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
                    </div>
                  )}

                  {refineAction === 'REFINE' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
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

                  {/* Photo Completion Option - Available for EXPAND, REFINE, CLEAN actions */}
                  {refineAction !== 'PHOTOS' && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={refineOptions.completePhotos}
                        onChange={(e) => setRefineOptions(prev => ({ ...prev, completePhotos: e.target.checked }))}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-blue-800">{strings.completePhotos}</span>
                        <p className="text-xs text-blue-600">{strings.completePhotosDesc}</p>
                      </div>
                      <ImageIcon size={20} className="text-blue-400" />
                    </label>
                    
                    {refineOptions.completePhotos && (
                      <div className="flex gap-2 pl-6">
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
                        max="30"
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
                        max="10"
                        step="1"
                        value={aiConfig.featureCount}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, featureCount: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        disabled={isGenerating}
                      />
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
                className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                disabled={isGenerating || project.entities.length === 0}
              >
                {refineAction === 'EXPAND' ? strings.actionExpand : refineAction === 'REFINE' ? strings.actionRefine : refineAction === 'CLEAN' ? strings.actionClean : strings.actionPhotos} <Sparkles size={16} className="opacity-70" />
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
              {/* Prompt Textarea - Hidden during generation */}
              {!isGenerating && (
                <textarea
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  className="w-full flex-1 p-4 bg-slate-900 text-slate-200 font-mono text-sm rounded-lg resize-none outline-none border-2 border-transparent focus:border-amber-500"
                  spellCheck="false"
                />
              )}
              
              {/* AI Typing Effect Display - Shown during generation */}
              {isGenerating && (
                <div 
                  ref={typingContainerRef}
                  className="w-full flex-1 p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200 font-mono text-sm rounded-lg overflow-auto custom-scrollbar border-2 border-amber-500/30"
                >
                  <div className="whitespace-pre-wrap">
                    {aiTypingText}
                    {!aiTypingComplete && (
                      <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1 align-middle"></span>
                    )}
                  </div>
                </div>
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
                <button
                  onClick={handleSendManualPrompt}
                  className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center gap-2"
                  disabled={isGenerating}
                >
                  {isGenerating ? <><Loader2 className="animate-spin" size={16} /> {generatingMessage || strings.generating}</> : <>{strings.generate}</>}
                </button>
              </div>
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