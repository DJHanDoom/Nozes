import React, { useState, useEffect } from 'react';
import { Project, Entity, Feature, AIConfig, Language, FeatureFocus, ImportedFile } from '../types';
import { generateKeyFromTopic, buildPromptData, generateKeyFromCustomPrompt } from '../services/geminiService';
import { Wand2, Plus, Trash2, Save, Grid, LayoutList, Box, Loader2, CheckSquare, X, Download, Upload, Image as ImageIcon, FolderOpen, Settings2, Brain, Microscope, Baby, GraduationCap, FileText, FileSearch, Copy, Link as LinkIcon, Edit3, ExternalLink, Menu, Play, FileSpreadsheet, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface BuilderProps {
  initialProject: Project | null;
  onSave: (project: Project) => void;
  onCancel: () => void;
  language: Language;
  defaultModel: string;
  apiKey: string;
}

type Tab = 'GENERAL' | 'FEATURES' | 'ENTITIES' | 'MATRIX';
type AiMode = 'TOPIC' | 'IMPORT';

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
    missingKey: "Missing API Key. Please configure it in the main menu Settings."
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
    missingKey: "Falta a Chave da API. Configure-a nas Configurações do menu principal."
  }
};

export const Builder: React.FC<BuilderProps> = ({ initialProject, onSave, onCancel, language, defaultModel, apiKey }) => {
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
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('TOPIC');
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Mobile Header Menu

  // Prompt Editor State
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("");

  // Entity Trait Editor State
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

  // Matrix Feature Expansion State
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(
    project.features.length > 0 ? project.features[0].id : null
  );
  const matrixScrollRef = React.useRef<HTMLDivElement>(null);
  const [isMatrixScrolled, setIsMatrixScrolled] = useState(false);

  const toggleFeatureExpansion = (featureId: string) => {
    setExpandedFeatureId(prev => prev === featureId ? null : featureId);

    // Scroll to center the expanded feature after a brief delay
    setTimeout(() => {
      const featureElement = document.querySelector(`[data-feature-id="${featureId}"]`);
      if (featureElement && matrixScrollRef.current) {
        const container = matrixScrollRef.current;
        const elementRect = featureElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const scrollLeft = featureElement.getBoundingClientRect().left - containerRect.left + container.scrollLeft - (containerRect.width / 2) + (elementRect.width / 2);

        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }, 50);
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
    const saved = localStorage.getItem('lucidgen_projects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) { console.error("Failed to load local projects"); }
    }
  }, []);

  // Handlers
  const updateProject = (updates: Partial<Project>) => setProject(p => ({ ...p, ...updates }));

  const saveToLocal = () => {
    const updatedList = [project, ...savedProjects.filter(p => p.id !== project.id)];
    setSavedProjects(updatedList);
    localStorage.setItem('lucidgen_projects', JSON.stringify(updatedList));
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

  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.name && parsed.features && parsed.entities) {
            setProject(parsed);
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

  const handleAiGenerate = async () => {
    if (!apiKey) {
      alert(strings.missingKey);
      return;
    }
    setIsGenerating(true);
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

      // Pass callback to receive prompt text and copy it
      const generatedProject = await generateKeyFromTopic(config, apiKey, (fullPrompt) => {
        navigator.clipboard.writeText(fullPrompt).then(() => {
          // Optional: You could show a small toast here if desired
          console.log("Prompt copied");
        }).catch(err => console.error("Could not copy prompt", err));
      });

      setProject(generatedProject);
      setShowAiModal(false);
      setActiveTab('MATRIX');
      // Removed automatic alert here to be less intrusive since copying happens on button too
    } catch (e) {
      console.error(e);
      alert(strings.errGen);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenPromptEditor = async () => {
    try {
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
      setShowAiModal(false); // Close wizard, open editor
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
    setShowPromptEditor(false);

    try {
      const generatedProject = await generateKeyFromCustomPrompt(manualPrompt, apiKey, aiConfig.model);
      setProject(generatedProject);
      setActiveTab('MATRIX');
    } catch (e) {
      console.error(e);
      alert(strings.errGen);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClosePromptEditor = () => {
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
        <div className="md:hidden bg-slate-800 text-slate-200 border-b border-slate-700 p-2 grid grid-cols-4 gap-2 text-xs font-medium z-20">
          <button onClick={() => { saveToLocal(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <Save size={18} /> {strings.save}
          </button>
          <button onClick={() => { setShowLoadModal(true); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <FolderOpen size={18} /> {strings.open}
          </button>
          <button onClick={() => { exportJSON(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <Download size={18} /> {strings.export}
          </button>
          <button onClick={() => { exportXLSX(); setShowMobileMenu(false) }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded">
            <FileSpreadsheet size={18} /> {strings.exportXLSX}
          </button>
          <label className="flex flex-col items-center gap-1 p-2 hover:bg-slate-700 rounded cursor-pointer">
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
                  <h3 className="text-lg font-semibold text-slate-800">{strings.definedFeatures}</h3>
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
                  <h3 className="text-lg font-semibold text-slate-800">{strings.manageEntities}</h3>
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
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-200/50">
                {/* Sticky Header Row */}
                <div className="sticky top-0 z-40 bg-slate-800 shadow-lg border-b-2 border-slate-700 flex-shrink-0">
                  <div className="flex" style={{
                    gridTemplateColumns: `minmax(150px, 220px) ${project.features.map(f =>
                      expandedFeatureId === f.id
                        ? `repeat(${f.states.length}, 80px)`
                        : '60px'
                    ).join(' ')}`
                  }}>
                    {/* Corner Cell */}
                    <div className="flex-shrink-0 text-white p-3 font-bold border-r border-slate-700 flex items-end text-xs" style={{ width: '220px' }}>
                      <span className="line-clamp-2 leading-tight">{strings.taxaFeatures}</span>
                    </div>

                    {/* Feature Headers */}
                    <div className="flex flex-1">
                      {project.features.map((feature, featureIdx) => {
                        const isExpanded = expandedFeatureId === feature.id;
                        const width = isExpanded ? `${feature.states.length * 80}px` : '60px';

                        return (
                          <div
                            key={feature.id}
                            data-feature-id={feature.id}
                            className={`flex-shrink-0 text-white border-r transition-all duration-300 ${
                              isExpanded
                                ? 'bg-emerald-700 border-emerald-800'
                                : 'bg-slate-700 hover:bg-slate-600 cursor-pointer border-slate-700'
                            }`}
                            style={{ width }}
                            onClick={() => !isExpanded && toggleFeatureExpansion(feature.id)}
                          >
                            {/* Feature Name - Top Row */}
                            <div className={`p-2 border-b font-semibold min-h-[2.5rem] flex items-center justify-center gap-2 ${
                              isExpanded ? 'border-emerald-600 bg-emerald-800/50' : 'border-slate-600 bg-slate-800/50'
                            }`}>
                              {isExpanded && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFeatureId(null);
                                  }}
                                  className="p-1 hover:bg-emerald-600 rounded transition-colors"
                                  title="Colapsar"
                                >
                                  <X size={14} />
                                </button>
                              )}
                              <div className={`leading-tight text-center ${isExpanded ? 'text-[10px] line-clamp-2' : 'text-[9px] line-clamp-3'}`} title={feature.name}>
                                {feature.name}
                              </div>
                              {!isExpanded && (
                                <div className="text-[8px] text-slate-400 mt-0.5">
                                  ({feature.states.length})
                                </div>
                              )}
                            </div>

                            {/* State Labels */}
                            {isExpanded ? (
                              <div className="flex">
                                {feature.states.map((state, stateIdx) => (
                                  <div key={state.id} className="flex-1 border-r border-emerald-600 last:border-0 relative group/state" style={{ width: '80px' }}>
                                    <div className="p-1.5 min-h-[4rem] max-h-[6rem] flex items-center justify-center">
                                      <div
                                        className="text-[9px] leading-snug text-emerald-100 font-medium text-center break-words hyphens-auto line-clamp-4"
                                        style={{ wordBreak: 'break-word' }}
                                        title={state.label}
                                      >
                                        {state.label}
                                      </div>
                                    </div>
                                    {/* Tooltip */}
                                    <div className="fixed z-50 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-2xl opacity-0 invisible group-hover/state:opacity-100 group-hover/state:visible transition-all duration-200 pointer-events-none max-w-xs"
                                         style={{
                                           transform: 'translate(-50%, -100%)',
                                           marginTop: '-0.5rem'
                                         }}
                                         onMouseEnter={(e) => {
                                           const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                           if (rect) {
                                             e.currentTarget.style.left = `${rect.left + rect.width / 2}px`;
                                             e.currentTarget.style.top = `${rect.top}px`;
                                           }
                                         }}>
                                      {state.label}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="min-h-[4rem] flex items-center justify-center p-2 bg-slate-800/30">
                                <div className="text-[8px] text-slate-400 text-center">
                                  Clique para expandir
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scrollable Body */}
                <div ref={matrixScrollRef} className="flex-1 overflow-auto custom-scrollbar">
                  <div className="inline-block min-w-full align-top">
                    <div className="grid" style={{
                      gridTemplateColumns: `minmax(150px, 220px) ${project.features.map(f =>
                        expandedFeatureId === f.id
                          ? `repeat(${f.states.length}, 80px)`
                          : '60px'
                      ).join(' ')}`
                    }}>

                    {/* Header Row - Frozen/Sticky */}
                    <div className="matrix-sticky-header sticky top-0 left-0 z-40 bg-slate-800 text-white p-3 font-bold border-r border-b-2 border-slate-700 shadow-lg flex items-end text-xs">
                      <span className="line-clamp-2 leading-tight">{strings.taxaFeatures}</span>
                    </div>
                    {project.features.map((feature, featureIdx) => {
                      const isExpanded = expandedFeatureId === feature.id;
                      const colSpan = isExpanded ? feature.states.length : 1;

                      return (
                        <div
                          key={feature.id}
                          data-feature-id={feature.id}
                          className={`matrix-sticky-header sticky top-0 z-30 text-white border-r border-b-2 shadow-lg transition-all duration-300 ${
                            isExpanded
                              ? 'bg-emerald-700 border-emerald-800'
                              : 'bg-slate-700 hover:bg-slate-600 cursor-pointer border-slate-700'
                          }`}
                          style={{ gridColumn: `span ${colSpan}` }}
                          onClick={() => !isExpanded && toggleFeatureExpansion(feature.id)}
                        >
                          {/* Feature Name - Top Row */}
                          <div className={`p-2 border-b font-semibold min-h-[2.5rem] flex items-center justify-center gap-2 ${
                            isExpanded ? 'border-emerald-600 bg-emerald-800/50' : 'border-slate-600 bg-slate-800/50'
                          }`}>
                            {isExpanded && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedFeatureId(null);
                                }}
                                className="p-1 hover:bg-emerald-600 rounded transition-colors"
                                title="Colapsar"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <div className={`leading-tight text-center ${isExpanded ? 'text-[10px] line-clamp-2' : 'text-[9px] line-clamp-3'}`} title={feature.name}>
                              {feature.name}
                            </div>
                            {!isExpanded && (
                              <div className="text-[8px] text-slate-400 mt-0.5">
                                ({feature.states.length})
                              </div>
                            )}
                          </div>

                          {/* State Labels - Only show if expanded */}
                          {isExpanded ? (
                            <div className="flex">
                              {feature.states.map((state, stateIdx) => (
                                <div key={state.id} className="flex-1 border-r border-emerald-600 last:border-0 relative group/state w-20">
                                  <div className="p-1.5 min-h-[4rem] max-h-[6rem] flex items-center justify-center">
                                    <div
                                      className="text-[9px] leading-snug text-emerald-100 font-medium text-center break-words hyphens-auto line-clamp-4"
                                      style={{ wordBreak: 'break-word' }}
                                      title={state.label}
                                    >
                                      {state.label}
                                    </div>
                                  </div>
                                  {/* Tooltip on hover */}
                                  <div className="fixed z-50 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-2xl opacity-0 invisible group-hover/state:opacity-100 group-hover/state:visible transition-all duration-200 pointer-events-none max-w-xs"
                                       style={{
                                         transform: 'translate(-50%, -100%)',
                                         marginTop: '-0.5rem'
                                       }}
                                       onMouseEnter={(e) => {
                                         const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                         if (rect) {
                                           e.currentTarget.style.left = `${rect.left + rect.width / 2}px`;
                                           e.currentTarget.style.top = `${rect.top}px`;
                                         }
                                       }}>
                                    {state.label}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="min-h-[4rem] flex items-center justify-center p-2 bg-slate-800/30">
                              <div className="text-[8px] text-slate-400 text-center">
                                Clique para expandir
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Body Rows */}
                    {project.entities.map((entity, idx) => (
                      <React.Fragment key={entity.id}>
                        {/* Entity Name Column - Frozen Left */}
                        <div className={`sticky left-0 z-20 p-2.5 border-r-2 border-b border-slate-200 flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] hover:bg-slate-50 group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded bg-slate-200 overflow-hidden flex-shrink-0">
                            {entity.imageUrl && <img src={entity.imageUrl} className="w-full h-full object-cover" alt="" />}
                          </div>
                          <span className="font-medium text-slate-700 text-xs leading-tight group-hover:text-emerald-600 transition-colors line-clamp-2" title={entity.name}>
                            {entity.name}
                          </span>
                        </div>

                        {/* Feature Cells - Collapsed or Expanded */}
                        {project.features.map(feature => {
                          const isExpanded = expandedFeatureId === feature.id;
                          const entityTraits = entity.traits[feature.id] || [];
                          const selectedCount = entityTraits.length;

                          if (isExpanded) {
                            // Show all state checkboxes for expanded feature
                            return feature.states.map(state => {
                              const isChecked = entityTraits.includes(state.id);
                              return (
                                <div key={`${entity.id}-${state.id}`} className={`border-b border-r border-slate-100 flex items-center justify-center p-1.5 hover:bg-emerald-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                  <button
                                    onClick={() => toggleTrait(entity.id, feature.id, state.id)}
                                    className={`w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-all duration-200 transform active:scale-95 touch-manipulation ${isChecked
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                      }`}
                                    aria-label={`${entity.name} - ${feature.name}: ${state.label}`}
                                  >
                                    {isChecked && <CheckSquare size={16} strokeWidth={3} />}
                                  </button>
                                </div>
                              );
                            });
                          } else {
                            // Show summary indicator for collapsed feature
                            return (
                              <div
                                key={`${entity.id}-${feature.id}-collapsed`}
                                className={`border-b border-r border-slate-200 flex items-center justify-center p-2 cursor-pointer hover:bg-slate-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                onClick={() => toggleFeatureExpansion(feature.id)}
                                title={`${feature.name}: ${selectedCount} de ${feature.states.length} selecionado(s)`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    selectedCount > 0
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {selectedCount}
                                  </div>
                                  <div className="text-[7px] text-slate-400">
                                    /{feature.states.length}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </React.Fragment>
                    ))}

                  </div>
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
                <h3 className="text-xl md:text-2xl font-bold">{strings.aiTitle}</h3>
              </div>
              <p className="text-amber-50 text-xs md:text-sm font-medium drop-shadow-sm">
                {strings.aiDesc}
              </p>
            </div>

            {/* AI Mode Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => setAiMode('TOPIC')}
                className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${aiMode === 'TOPIC' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-2"><Wand2 size={16} /> {strings.modeTopic}</span>
              </button>
              <button
                onClick={() => setAiMode('IMPORT')}
                className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${aiMode === 'IMPORT' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
              >
                <span className="flex items-center justify-center gap-2"><FileSearch size={16} /> {strings.modeImport}</span>
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
              ) : (
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
              )}

              {/* SHARED CONFIGURATION SECTION */}
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

              {isGenerating && (
                <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> {aiMode === 'IMPORT' ? strings.analyzing : strings.generating}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex gap-3 shrink-0 safe-area-bottom">
              <button
                onClick={() => setShowAiModal(false)}
                className="flex-none w-16 md:w-20 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors text-center text-xs md:text-sm"
                disabled={isGenerating}
              >
                {strings.cancel}
              </button>

              <button
                onClick={handleOpenPromptEditor}
                className="w-auto px-3 py-2 text-xs bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-amber-400 hover:text-amber-600 shadow-sm transition-all flex items-center justify-center gap-2"
                disabled={isGenerating || (aiMode === 'TOPIC' && !aiConfig.topic) || (aiMode === 'IMPORT' && !importedFile)}
                title="View and edit the prompt before sending"
              >
                <Edit3 size={14} /> <span className="hidden sm:inline">View/Edit Prompt</span>
              </button>

              <button
                onClick={handleAiGenerate}
                className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
                disabled={isGenerating || (aiMode === 'TOPIC' && !aiConfig.topic) || (aiMode === 'IMPORT' && !importedFile)}
              >
                {strings.generate} <Wand2 size={16} className="opacity-70" />
              </button>
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
                >
                  <Copy size={12} /> {strings.copyPrompt}
                </button>
                <button onClick={handleClosePromptEditor} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-slate-100 min-h-0">
              <textarea
                value={manualPrompt}
                onChange={(e) => setManualPrompt(e.target.value)}
                className="w-full h-full p-4 bg-slate-900 text-slate-200 font-mono text-sm rounded-lg resize-none outline-none border-2 border-transparent focus:border-amber-500"
                spellCheck="false"
              />
            </div>

            <div className="p-4 border-t bg-slate-50 shrink-0 flex items-center justify-end gap-4">
              <button
                onClick={handleClosePromptEditor}
                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                disabled={isGenerating}
              >
                {strings.cancel}
              </button>
              <button
                onClick={handleSendManualPrompt}
                className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center gap-2"
                disabled={isGenerating}
              >
                {isGenerating ? <><Loader2 className="animate-spin" size={16} /> {strings.generating}</> : <>{strings.generate}</>}
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