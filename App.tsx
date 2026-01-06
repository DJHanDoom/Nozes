import React, { useState, useEffect } from 'react';
import { ViewMode, Project, Language } from './types';
import { Player } from './components/Player';
import { Builder } from './components/Builder';
import { Hammer, Play, Bug, Upload, FolderOpen, Globe, Leaf, Sprout, Flower2, Settings, X, Save, Brain, HelpCircle, Info, KeyRound, ExternalLink, Trash2, FileCode, Wand2, AlertTriangle, Layers } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [language, setLanguage] = useState<Language>('pt');
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [returnToAiModal, setReturnToAiModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'ABOUT' | 'HELP'>('ABOUT');
  const [aiModel, setAiModel] = useState<string>("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [openAiModalOnMount, setOpenAiModalOnMount] = useState(false);

  useEffect(() => {
    // Load settings on mount only
    const savedSettings = localStorage.getItem('nozesia_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.model) setAiModel(settings.model);
        if (settings.apiKey) setApiKey(settings.apiKey);
      } catch (e) { console.error("Failed to load settings"); }
    }
  }, []);

  // Reload projects whenever view changes to HOME or PLAYER (or on mount)
  useEffect(() => {
    if (view === 'HOME' || view === 'PLAYER') {
      const saved = localStorage.getItem('nozesia_projects');
      if (saved) {
        try {
          setSavedProjects(JSON.parse(saved));
        } catch (e) { console.error("Failed to load local projects"); }
      }
    }
  }, [view]);

  const saveSettings = () => {
    const trimmedModel = aiModel.trim();
    const trimmedKey = apiKey.trim();
    localStorage.setItem('nozesia_settings', JSON.stringify({ model: trimmedModel, apiKey: trimmedKey }));
    setShowSettingsModal(false);
    // returnToAiModal is handled automatically by the reopenAiModal prop
  };

  // Sample seed data
  const demoProject: Project = {
    id: 'demo-1',
    name: 'Exemplo: Grandes Felinos',
    description: 'Identifique espécies comuns de grandes felinos.',
    features: [
      { id: 'f1', name: 'Padrão da Pelagem', states: [{ id: 's1', label: 'Listras' }, { id: 's2', label: 'Manchas' }, { id: 's3', label: 'Liso' }] },
      { id: 'f2', name: 'Habitat', states: [{ id: 's4', label: 'Selva' }, { id: 's5', label: 'Savana' }] }
    ],
    entities: [
      { id: 'e1', name: 'Tigre', description: 'O maior dos felinos.', imageUrl: 'https://picsum.photos/id/237/400/300', links: [], traits: { 'f1': ['s1'], 'f2': ['s4'] } },
      { id: 'e2', name: 'Leão', description: 'O rei da selva.', imageUrl: 'https://picsum.photos/id/1003/400/300', links: [], traits: { 'f1': ['s3'], 'f2': ['s5'] } },
      { id: 'e3', name: 'Leopardo', description: 'Escalador especialista.', imageUrl: 'https://picsum.photos/id/1074/400/300', links: [], traits: { 'f1': ['s2'], 'f2': ['s4', 's5'] } }
    ]
  };

  const strings = {
    en: {
      subtitle: "v2.1 Tropical",
      tagline: "Biological Identification AI",
      desc: "Create and share professional matrix identification keys. Powered by Gemini AI for instant taxonomy generation.",
      createNew: "Create / Edit Key",
      openSaved: "Open Saved",
      importJson: "Import Project",
      demo: "Try Demo",
      savedProj: "Saved Projects",
      close: "Close",
      noSaved: "No saved projects found.",
      invalid: "Invalid project file.",
      settings: "Settings",
      aiModel: "AI Model",
      apiKey: "Gemini API Key",
      getKey: "Get Key",
      save: "Save",
      apiKeyNotice: "Your API Key is stored locally in your browser and used only to communicate with Google.",
      help: "About & Help",
      helpContent: {
        intro: "NOZES is an intelligent platform for creating and using matrix identification keys, designed for biologists, students, and nature enthusiasts.",
        step1Title: "1. NUTS AI Wizard",
        step1Desc: "Use the 'Nuts AI' button in the builder to automatically generate a key. You can describe a topic (e.g., 'Brazilian Cerrado Trees') OR upload a PDF/Image reference. The AI will study the material and create species, features, and the scoring matrix for you.",
        step2Title: "2. The Builder",
        step2Desc: "Refine your key manually. You can add new features, upload images for species, and adjust the matrix relationships between taxa and traits. Use the 'Export Project' button to save your work as a JSON file, which is essential for backups.",
        step3Title: "3. The Player",
        step3Desc: "This is the end-user view. Select observed features to filter down the list of species until you identify your specimen.",
        importExportTitle: "4. Import & Export",
        importExportDesc: "Always save your work by clicking 'Export Project'. This downloads a .json file. To resume work later or on another device, use 'Import Project' and select that file. You can also export to Excel (XLSX) for spreadsheets.",
        htmlExportTitle: "5. HTML Export",
        htmlExportDesc: "Export your key as a standalone HTML file that works offline! Click 'HTML' in the builder to generate a complete, self-contained webpage with all images embedded. Perfect for sharing with colleagues, publishing on websites, or using in field work without internet. The exported file includes the full Player interface with all filtering functionality.",
        aiToolsTitle: "6. Expand, Refine & Combine",
        aiToolsDesc: "Use the 'Expand/Refine' tab in the AI modal to enhance your keys: EXPAND adds new species to an existing list; REFINE improves descriptions and fills gaps; PHOTOS automatically searches for images; VALIDATE checks names against taxonomic catalogs. You can also MERGE keys by importing a new JSON, combining species from multiple projects into one.",
        warningTitle: "⚠️ Important Warning",
        warningDesc: "AI-generated data may contain inaccuracies, outdated names, or incorrect trait assignments. ALWAYS review and verify all information before using or distributing identification keys. Cross-check scientific names with official catalogs (Flora do Brasil, GBIF, POWO) and validate geographic distributions. The user assumes full responsibility for the accuracy of the final content."
      }
    },
    pt: {
      subtitle: "v2.1 Tropical",
      tagline: "Inteligência para Identificação Biológica",
      desc: "Crie e compartilhe chaves de identificação matriciais profissionais. Poder da Gemini AI para geração instantânea de taxonomia.",
      createNew: "Criar / Editar Chave",
      openSaved: "Abrir Chave",
      importJson: "Importar Projeto",
      demo: "Ver Demo",
      savedProj: "Projetos Salvos",
      close: "Fechar",
      noSaved: "Nenhum projeto salvo.",
      invalid: "Arquivo inválido.",
      settings: "Configurações",
      aiModel: "Modelo IA",
      apiKey: "Chave API Gemini",
      getKey: "Obter Chave",
      save: "Salvar",
      apiKeyNotice: "Sua API Key é salva localmente no navegador e usada apenas para comunicar com o Google.",
      help: "Sobre e Ajuda",
      helpContent: {
        intro: "O NOZES é uma plataforma inteligente para criação e uso de chaves de identificação matriciais, projetada para biólogos, estudantes e entusiastas da natureza.",
        step1Title: "1. Assistente Nozes IA",
        step1Desc: "Use o botão 'Nozes IA' no construtor para gerar uma chave automaticamente. Você pode descrever um tópico (ex: 'Árvores do Cerrado') OU fazer upload de um PDF/Imagem de referência. A IA estudará o material e criará espécies, características e a matriz para você.",
        step2Title: "2. O Construtor",
        step2Desc: "Refine sua chave manualmente. Adicione novas características, insira imagens e ajuste a matriz. Use o botão 'Exportar Projeto' para salvar seu trabalho em arquivo JSON (backup essencial).",
        step3Title: "3. O Player",
        step3Desc: "Esta é a visão do usuário final. Selecione as características observadas para filtrar a lista de espécies até identificar seu espécime.",
        importExportTitle: "4. Importar & Exportar",
        importExportDesc: "Sempre salve seu trabalho clicando em 'Exportar Projeto'. Isso baixa um arquivo .json. Para continuar depois ou em outro dispositivo, use 'Importar Projeto' e selecione esse arquivo. Você também pode exportar para Excel (XLSX).",
        htmlExportTitle: "5. Exportação HTML",
        htmlExportDesc: "Exporte sua chave como um arquivo HTML autônomo que funciona offline! Clique em 'HTML' no construtor para gerar uma página web completa e independente com todas as imagens embutidas. Perfeito para compartilhar com colegas, publicar em sites ou usar em trabalho de campo sem internet. O arquivo exportado inclui a interface completa do Player com toda a funcionalidade de filtragem.",
        aiToolsTitle: "6. Expandir, Refinar & Combinar",
        aiToolsDesc: "Use a aba 'Expandir/Refinar' no modal de IA para aprimorar suas chaves: EXPANDIR adiciona novas espécies a uma lista existente; REFINAR melhora descrições e preenche lacunas; FOTOS busca imagens automaticamente; VALIDAR confere nomes com catálogos taxonômicos. Você também pode COMBINAR chaves importando um novo JSON, mesclando espécies de múltiplos projetos em um só.",
        warningTitle: "⚠️ Aviso Importante",
        warningDesc: "Dados gerados por IA podem conter imprecisões, nomes desatualizados ou atribuições incorretas de características. SEMPRE revise e verifique todas as informações antes de usar ou distribuir chaves de identificação. Confira nomes científicos em catálogos oficiais (Flora do Brasil, GBIF, POWO) e valide distribuições geográficas. O usuário assume total responsabilidade pela precisão do conteúdo final."
      }
    }
  }[language];

  const handleStartBuilder = () => {
    setOpenAiModalOnMount(false);
    setCurrentProject(null); // Reset to blank key
    setView('BUILDER');
  };

  const handleStartAiWizard = () => {
    setOpenAiModalOnMount(true);
    setCurrentProject(null);
    setView('BUILDER');
  };

  const handleStartDemo = () => {
    setCurrentProject(demoProject);
    setView('PLAYER');
  };

  const handleSaveProject = (project: Project) => {
    // 1. Persist to localStorage
    const saved = localStorage.getItem('nozesia_projects');
    let projectsList: Project[] = [];
    if (saved) {
      try {
        projectsList = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }

    // Remove existing version of this project if exists, and add new one to top
    const updatedList = [project, ...projectsList.filter(p => p.id !== project.id)];
    localStorage.setItem('nozesia_projects', JSON.stringify(updatedList));

    // 2. Update State
    setSavedProjects(updatedList);
    setCurrentProject(project);
    setView('PLAYER');
  };

  const loadFromLocal = (p: Project) => {
    setCurrentProject(p);
    setView('PLAYER');
    setShowLoadModal(false);
  };

  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.name && parsed.features && parsed.entities) {
            setCurrentProject(parsed);
            setView('PLAYER');
          } else {
            alert(strings.invalid);
          }
        } catch (error) {
          alert(strings.invalid);
        }
      };
    }
  };

  // Render Settings Modal globally (available in all views)
  const renderSettingsModal = () => showSettingsModal && (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-emerald-600" size={20} />
            {strings.settings}
          </h3>
          <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-slate-700">{strings.apiKey}</label>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="AIzaSy..."
              />
            </div>
            {/* Highlighted link to get API key */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-bold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              <ExternalLink size={16} />
              {strings.getKey} - Google AI Studio
            </a>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{strings.aiModel}</label>
            <input
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="gemini-2.0-flash"
            />
            <p className="text-xs text-slate-400 mt-1">
              Default: gemini-2.0-flash
            </p>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <p className="text-xs text-amber-700">
              {strings.apiKeyNotice}
            </p>
          </div>
        </div>

        <button
          onClick={saveSettings}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
        >
          <Save size={16} /> {strings.save}
        </button>
      </div>
    </div>
  );

  // Render Load Modal globally (available in all views)
  const renderLoadModal = () => showLoadModal && (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="text-emerald-600" size={20} />
            {strings.openSaved}
          </h3>
          <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4 custom-scrollbar">
          {savedProjects.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">{strings.noSaved}</p>
          ) : (
            savedProjects.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(language === 'pt' ? `Excluir "${p.name}"?` : `Delete "${p.name}"?`)) {
                      const updated = savedProjects.filter(proj => proj.id !== p.id);
                      setSavedProjects(updated);
                      localStorage.setItem('nozesia_projects', JSON.stringify(updated));
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title={language === 'pt' ? 'Excluir' : 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => loadFromLocal(p)}
                  className="flex-1 text-left p-3 hover:bg-emerald-50 rounded-lg border border-slate-100 hover:border-emerald-200 group transition-all min-w-0"
                >
                  <div className="font-medium text-slate-800 group-hover:text-emerald-700 truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 truncate">{p.description || (language === 'pt' ? "Sem descrição" : "No description")}</div>
                </button>
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setShowLoadModal(false)}
          className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
        >
          {strings.close}
        </button>
      </div>
    </div>
  );

  if (view === 'PLAYER' && currentProject) {
    return (
      <>
        <Player
          project={currentProject}
          onBack={() => setView('HOME')}
          language={language}
          onOpenSaved={() => setShowLoadModal(true)}
          onEditKey={() => setView('BUILDER')}
        />
        {renderSettingsModal()}
        {renderLoadModal()}
      </>
    );
  }

  if (view === 'BUILDER') {
    return (
      <>
        <Builder
          initialProject={currentProject}
          onSave={handleSaveProject}
          onCancel={() => setView('HOME')}
          language={language}
          defaultModel={aiModel}
          apiKey={apiKey}
          openAiModalOnMount={openAiModalOnMount}
          onOpenSettings={(returnToAi) => {
            setReturnToAiModal(returnToAi || false);
            setShowSettingsModal(true);
          }}
          onProjectImported={(project) => {
            // Update savedProjects state so load modals show the imported project
            setSavedProjects(prev => [project, ...prev.filter(p => p.id !== project.id)]);
          }}
        />
        {renderSettingsModal()}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2e24] flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">

      {/* Tropical Background Elements - Reduced on mobile for performance/readability */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-emerald-600/20 rounded-full blur-[80px] md:blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-teal-500/20 rounded-full blur-[80px] md:blur-[100px]"></div>

        <Leaf className="absolute top-[10%] right-[15%] text-emerald-800/20 w-20 h-20 md:w-32 md:h-32 rotate-12" />
        <Sprout className="absolute bottom-[20%] left-[10%] text-emerald-800/20 w-32 h-32 md:w-48 md:h-48 -rotate-12" />
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center z-10">

        {/* Left Content */}
        <div className="text-white space-y-6 md:space-y-8">
          <div className="flex justify-between items-start">
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 text-emerald-300 px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold tracking-wider uppercase border border-emerald-500/30 backdrop-blur-sm">
              {strings.subtitle}
            </div>

            <div className="flex gap-2">
              {/* Language Selector */}
              <div className="flex bg-emerald-900/50 rounded-lg p-1 border border-emerald-500/30 backdrop-blur-sm">
                <button
                  onClick={() => setLanguage('pt')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${language === 'pt' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:text-white'}`}
                >
                  PT
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${language === 'en' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:text-white'}`}
                >
                  EN
                </button>
              </div>

              {/* Help Button */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="bg-emerald-900/50 rounded-lg p-1.5 border border-emerald-500/30 backdrop-blur-sm text-emerald-400 hover:text-white hover:bg-emerald-800/50 transition-colors"
                title={strings.help}
              >
                <HelpCircle size={20} />
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`bg-emerald-900/50 rounded-lg p-1.5 border backdrop-blur-sm transition-colors ${!apiKey ? 'border-amber-500 text-amber-500 animate-pulse' : 'border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-800/50'}`}
                title={strings.settings}
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 md:gap-4 mb-2">
              <div className="bg-amber-800/20 p-2 md:p-3 rounded-2xl border-2 border-amber-600/30 backdrop-blur-md shadow-[0_0_30px_rgba(217,119,6,0.2)]">
                {/* Using Brain as proxy for the Walnut/Brain mascot */}
                <Brain className="text-amber-500 w-12 h-12 md:w-20 md:h-20" strokeWidth={1.5} />
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-amber-500 to-orange-400 drop-shadow-sm">
                NOZES
              </h1>
            </div>
            <h2 className="text-lg md:text-2xl text-emerald-100/80 font-light pl-2">{strings.tagline}</h2>
          </div>

          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-lg border-l-4 border-amber-500/50 pl-4 md:pl-6">
            {strings.desc}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pt-2">
            {/* Nozes IA Button - Golden/Amber */}
            <button
              onClick={handleStartAiWizard}
              className="col-span-1 sm:col-span-2 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold transition-all shadow-xl shadow-amber-900/50 hover:scale-[1.02] text-lg border-t border-amber-300/30 active:scale-95 animate-pulse hover:animate-none"
            >
              <Brain className="w-6 h-6" />
              {language === 'pt' ? 'Nozes IA' : 'NUTS AI'}
            </button>

            <button
              onClick={handleStartBuilder}
              className="col-span-1 sm:col-span-2 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all shadow-xl shadow-emerald-900/50 hover:scale-[1.02] text-lg border-t border-emerald-400/20 active:scale-95"
            >
              <Hammer className="w-5 h-5" />
              {strings.createNew}
            </button>

            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-100 rounded-xl font-medium transition-all border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              {strings.openSaved}
            </button>

            <label className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-100 rounded-xl font-medium transition-all border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm cursor-pointer active:scale-95">
              <Upload className="w-4 h-4" />
              {strings.importJson}
              <input type="file" accept=".json" onChange={importJSON} className="hidden" />
            </label>

            <button
              onClick={handleStartDemo}
              className="col-span-1 sm:col-span-2 mt-2 text-sm text-emerald-400 hover:text-emerald-200 flex items-center justify-center gap-2 font-medium py-2"
            >
              <Play className="w-3 h-3" />
              {strings.demo}
            </button>
          </div>
        </div>

        {/* Right Visual (Abstract Card) - Hidden on Mobile, Visible on Large Screens */}
        <div className="relative hidden lg:block transform perspective-1000 hover:rotate-y-2 transition-transform duration-700">
          <div className="relative bg-gradient-to-br from-emerald-900/80 to-teal-900/80 backdrop-blur-md border border-emerald-500/20 p-8 rounded-3xl shadow-2xl">
            <div className="absolute -top-10 -right-10 text-emerald-400/10">
              <Flower2 size={200} />
            </div>

            <div className="flex items-center gap-3 mb-8 border-b border-emerald-500/20 pb-6">
              <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
              <div className="ml-auto text-xs text-amber-500/80 font-mono tracking-widest font-bold">NOZES.IA-v2</div>
            </div>

            {/* Abstract UI Representation */}
            <div className="space-y-6 opacity-90">
              <div className="flex gap-6">
                {/* Sidebar Abstract */}
                <div className="w-1/3 space-y-3">
                  <div className="h-2 bg-emerald-700/50 rounded w-1/2 mb-4"></div>
                  <div className="h-10 bg-emerald-500/20 border-l-2 border-emerald-400 rounded-r flex items-center px-3 text-emerald-200 text-xs gap-2">
                    <Leaf size={12} /> Folhas
                  </div>
                  <div className="h-10 bg-emerald-900/30 rounded flex items-center px-3 text-emerald-600/50 text-xs">Flores</div>
                  <div className="h-10 bg-emerald-900/30 rounded flex items-center px-3 text-emerald-600/50 text-xs">Caule</div>
                </div>

                {/* Grid Abstract */}
                <div className="w-2/3 grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-emerald-950/50 rounded-lg p-3 border border-emerald-500/10 flex flex-col gap-2">
                      <div className="aspect-video bg-emerald-900/50 rounded flex items-center justify-center">
                        <Bug className="text-emerald-700/50" size={20} />
                      </div>
                      <div className="h-1.5 bg-emerald-800/50 rounded w-3/4"></div>
                      <div className="h-1.5 bg-emerald-800/30 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-emerald-500/20 flex justify-between items-center text-emerald-400/40 text-xs">
              <span>Gemini 2.5 Flash Integrated</span>
              <span>100% Client-Side</span>
            </div>

          </div>
        </div>

      </div>

      {/* Settings Modal - uses the shared renderSettingsModal function */}
      {renderSettingsModal()}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-0 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="p-4 md:p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="flex gap-4 items-center">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Info className="text-emerald-600" size={24} />
                  {strings.help}
                </h3>
                <div className="flex bg-slate-200/50 p-1 rounded-lg">
                  <button
                    onClick={() => setHelpTab('ABOUT')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${helpTab === 'ABOUT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Sobre
                  </button>
                  <button
                    onClick={() => setHelpTab('HELP')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${helpTab === 'HELP' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Ajuda
                  </button>
                </div>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600 p-2">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
              {helpTab === 'ABOUT' ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-800">👨‍💻 Sobre o Criador</h2>
                  <div className="creator-info space-y-4 text-slate-700">
                    <div>
                      <h3 className="text-xl font-semibold text-emerald-700">Diogo Bueno Kanoute</h3>
                      <p className="font-medium">Parabotânico e Dendrólogo em Inventário Florestal</p>
                      <p className="text-sm md:text-base mt-2">Desenvolvedor especializado em Tecnologias de Inteligência Artificial e Banco de Dados para Inventário Florestal, Ecologia, Botânica, Dendrometria e Dendrologia.</p>
                    </div>

                    <h4 className="text-lg font-bold text-slate-800 mt-8 border-t pt-4">🔗 Links e Contatos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-emerald-400 transition-colors col-span-full">
                        <strong className="block text-sm text-emerald-400 mb-1">🐙 Projeto no GitHub</strong>
                        <a href="https://github.com/DJHanDoom/Nozes" target="_blank" rel="noopener noreferrer" className="text-white hover:text-emerald-300 font-medium flex items-center gap-2">
                          github.com/DJHanDoom/Nozes
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">🌿Identificação Botânica</strong>
                        <a href="https://go.hotmart.com/G103222293V" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">Curso Online na Hotmart</a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">📸 Fototeca DBK no SPLink</strong>
                        <a href="https://specieslink.net/col/FDBK" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">specieslink.net/col/FDBK</a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">📱 Instagram Científico</strong>
                        <a href="https://instagram.com/fotografandomato" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">@fotografandomato</a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">📚 Biblioteca Botânica</strong>
                        <a href="https://drive.google.com/drive/folders/0B4wGMi_KVTvOWm51UzNnNVJjaEk?resourcekey=0-8e69zvcLn2zMXuphNmC56A&usp=drive_link" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">PDFs e Material de Referência</a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">📧 E-mail</strong>
                        <a href="mailto:diogokanoute@gmail.com" className="text-emerald-600 hover:underline font-medium">diogokanoute@gmail.com</a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors">
                        <strong className="block text-sm text-emerald-600 mb-1">💬 WhatsApp Científico</strong>
                        <a href="https://wa.me/5521998501623" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">+55 21 998501623</a>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 italic mt-6 bg-amber-50 p-4 rounded-lg border border-amber-100">
                      Entre em contato para dúvidas sobre o app, cursos de Identificação Botânica, tecnologias de IA aplicadas à Dendrologia ou serviços de Inventário Florestal (Mata Atlântica, Cerrado, Amazônia e Caatinga).
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-slate-700 leading-relaxed text-sm md:text-base">
                    {strings.helpContent.intro}
                  </div>

                  <div className="grid gap-6">
                    <div className="flex gap-4">
                      <div className="bg-amber-100 p-3 rounded-full h-fit text-amber-600 shrink-0"><Brain size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.step1Title}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.step1Desc}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-blue-100 p-3 rounded-full h-fit text-blue-600 shrink-0"><Hammer size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.step2Title}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.step2Desc}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-emerald-100 p-3 rounded-full h-fit text-emerald-600 shrink-0"><Play size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.step3Title}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.step3Desc}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-purple-100 p-3 rounded-full h-fit text-purple-600 shrink-0"><Save size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.importExportTitle}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.importExportDesc}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-rose-100 p-3 rounded-full h-fit text-rose-600 shrink-0"><FileCode size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.htmlExportTitle}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.htmlExportDesc}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-indigo-100 p-3 rounded-full h-fit text-indigo-600 shrink-0"><Layers size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base md:text-lg mb-1">{strings.helpContent.aiToolsTitle}</h4>
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{strings.helpContent.aiToolsDesc}</p>
                      </div>
                    </div>

                    <div className="mt-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                      <div className="flex gap-4">
                        <div className="bg-amber-200 p-3 rounded-full h-fit text-amber-700 shrink-0"><AlertTriangle size={24} /></div>
                        <div>
                          <h4 className="font-bold text-amber-800 text-base md:text-lg mb-1">{strings.helpContent.warningTitle}</h4>
                          <p className="text-amber-700 text-xs md:text-sm leading-relaxed">{strings.helpContent.warningDesc}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors"
              >
                {strings.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Project Modal - uses the shared renderLoadModal function */}
      {renderLoadModal()}

    </div>
  );
};

export default App;