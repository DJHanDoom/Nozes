import React, { useState, useEffect } from 'react';
import { ViewMode, Project, Language } from './types';
import { Player } from './components/Player';
import { Builder } from './components/Builder';
import { Hammer, Play, Bug, Upload, FolderOpen, Globe, Leaf, Sprout, Flower2, Settings, X, Save, Brain, HelpCircle, Info, KeyRound } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [language, setLanguage] = useState<Language>('pt');
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [aiModel, setAiModel] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    // Load projects for modal
    const saved = localStorage.getItem('lucidgen_projects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) { console.error("Failed to load local projects"); }
    }

    // Load settings
    const savedSettings = localStorage.getItem('lucidgen_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.model) setAiModel(settings.model);
        if (settings.apiKey) setApiKey(settings.apiKey);
      } catch(e) { console.error("Failed to load settings"); }
    }
  }, []);

  const saveSettings = () => {
    const trimmedModel = aiModel.trim();
    const trimmedKey = apiKey.trim();
    localStorage.setItem('lucidgen_settings', JSON.stringify({ model: trimmedModel, apiKey: trimmedKey }));
    setShowSettingsModal(false);
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
      importJson: "Import JSON",
      demo: "Try Demo",
      savedProj: "Saved Projects",
      close: "Close",
      noSaved: "No saved projects found.",
      invalid: "Invalid project file.",
      settings: "Settings",
      aiModel: "AI Model",
      apiKey: "Gemini API Key",
      save: "Save",
      apiKeyNotice: "Your API Key is stored locally in your browser and used only to communicate with Google.",
      help: "About & Help",
      helpContent: {
        intro: "NOZES is an intelligent platform for creating and using matrix identification keys, designed for biologists, students, and nature enthusiasts.",
        step1Title: "1. Nozes AI Wizard",
        step1Desc: "Use the 'Nuts AI' button in the builder to automatically generate a key. Just describe a topic (e.g., 'Brazilian Cerrado Trees'), and the AI will create species, features, and the scoring matrix for you.",
        step2Title: "2. The Builder",
        step2Desc: "Refine your key manually. You can add new features, upload images for species, and adjust the matrix relationships between taxa and traits.",
        step3Title: "3. The Player",
        step3Desc: "This is the end-user view. Select observed features to filter down the list of species until you identify your specimen."
      }
    },
    pt: {
      subtitle: "v2.1 Tropical",
      tagline: "Inteligência para Identificação Biológica",
      desc: "Crie e compartilhe chaves de identificação matriciais profissionais. Poder da Gemini AI para geração instantânea de taxonomia.",
      createNew: "Criar / Editar Chave",
      openSaved: "Abrir Salva",
      importJson: "Importar JSON",
      demo: "Ver Demo",
      savedProj: "Projetos Salvos",
      close: "Fechar",
      noSaved: "Nenhum projeto salvo.",
      invalid: "Arquivo inválido.",
      settings: "Configurações",
      aiModel: "Modelo IA",
      apiKey: "Chave API Gemini",
      save: "Salvar",
      apiKeyNotice: "Sua API Key é salva localmente no navegador e usada apenas para comunicar com o Google.",
      help: "Sobre e Ajuda",
      helpContent: {
        intro: "O NOZES é uma plataforma inteligente para criação e uso de chaves de identificação matriciais, projetada para biólogos, estudantes e entusiastas da natureza.",
        step1Title: "1. Assistente Nozes IA",
        step1Desc: "Use o botão 'Nozes IA' no construtor para gerar uma chave automaticamente. Basta descrever um tópico (ex: 'Árvores do Cerrado'), e a IA criará espécies, características e a matriz de pontuação para você.",
        step2Title: "2. O Construtor",
        step2Desc: "Refine sua chave manualmente. Você pode adicionar novas características, inserir imagens para as espécies e ajustar a matriz de relação entre táxons e atributos.",
        step3Title: "3. O Player",
        step3Desc: "Esta é a visão do usuário final. Selecione as características observadas para filtrar a lista de espécies até identificar seu espécime."
      }
    }
  }[language];

  const handleStartBuilder = () => {
    setView('BUILDER');
  };

  const handleStartDemo = () => {
    setCurrentProject(demoProject);
    setView('PLAYER');
  };

  const handleSaveProject = (project: Project) => {
    // 1. Persist to localStorage
    const saved = localStorage.getItem('lucidgen_projects');
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
    localStorage.setItem('lucidgen_projects', JSON.stringify(updatedList));

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

  if (view === 'PLAYER' && currentProject) {
    return <Player project={currentProject} onBack={() => setView('HOME')} language={language} />;
  }

  if (view === 'BUILDER') {
    return (
      <Builder 
        initialProject={currentProject} 
        onSave={handleSaveProject} 
        onCancel={() => setView('HOME')}
        language={language}
        defaultModel={aiModel}
        apiKey={apiKey}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2e24] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Tropical Background Elements */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[100px]"></div>
         
         {/* Decorative Leaves/Shapes */}
         <Leaf className="absolute top-[10%] right-[15%] text-emerald-800/20 w-32 h-32 rotate-12" />
         <Sprout className="absolute bottom-[20%] left-[10%] text-emerald-800/20 w-48 h-48 -rotate-12" />
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
        
        {/* Left Content */}
        <div className="text-white space-y-8">
          <div className="flex justify-between items-start">
            <div className="inline-flex items-center gap-2 bg-emerald-900/50 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border border-emerald-500/30 backdrop-blur-sm">
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
             <div className="flex items-center gap-4 mb-2">
                <div className="bg-amber-800/20 p-3 rounded-2xl border-2 border-amber-600/30 backdrop-blur-md shadow-[0_0_30px_rgba(217,119,6,0.2)]">
                  {/* Using Brain as proxy for the Walnut/Brain mascot */}
                  <Brain className="text-amber-500 w-16 h-16 sm:w-20 sm:h-20" strokeWidth={1.5} />
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-amber-500 to-orange-400 drop-shadow-sm">
                 NOZES
                </h1>
             </div>
             <h2 className="text-xl md:text-2xl text-emerald-100/80 font-light pl-2">{strings.tagline}</h2>
          </div>

          <p className="text-slate-300 text-lg leading-relaxed max-w-lg border-l-4 border-amber-500/50 pl-6">
            {strings.desc}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
             <button 
               onClick={handleStartBuilder}
               className="col-span-1 sm:col-span-2 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all shadow-xl shadow-emerald-900/50 hover:scale-[1.02] text-lg border-t border-emerald-400/20"
             >
               <Hammer className="w-5 h-5" />
               {strings.createNew}
             </button>
             
             <button 
               onClick={() => setShowLoadModal(true)}
               className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-100 rounded-xl font-medium transition-all border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm"
             >
               <FolderOpen className="w-4 h-4" />
               {strings.openSaved}
             </button>
             
             <label className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-100 rounded-xl font-medium transition-all border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm cursor-pointer">
               <Upload className="w-4 h-4" />
               {strings.importJson}
               <input type="file" accept=".json" onChange={importJSON} className="hidden" />
             </label>

             <button 
               onClick={handleStartDemo}
               className="col-span-1 sm:col-span-2 mt-2 text-sm text-emerald-400 hover:text-emerald-200 flex items-center justify-center gap-2 font-medium"
             >
               <Play className="w-3 h-3" />
               {strings.demo}
             </button>
          </div>
        </div>

        {/* Right Visual (Abstract Card) */}
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
                    {[1,2,3,4].map(i => (
                      <div key={i} className="bg-emerald-950/50 rounded-lg p-3 border border-emerald-500/10 flex flex-col gap-2">
                        <div className="aspect-video bg-emerald-900/50 rounded flex items-center justify-center">
                           <Bug className="text-emerald-700/50" size={20}/>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="text-emerald-600" size={20} />
                    {strings.settings}
                 </h3>
                 <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{strings.apiKey}</label>
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
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{strings.aiModel}</label>
                    <input 
                      value={aiModel} 
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="gemini-2.5-flash"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Default: gemini-2.5-flash
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
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={16} /> {strings.save}
              </button>
           </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-0 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Info className="text-emerald-600" size={24} />
                    {strings.help}
                 </h3>
                 <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                 </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-slate-700 leading-relaxed">
                    {strings.helpContent.intro}
                 </div>

                 <div className="grid gap-6">
                    <div className="flex gap-4">
                       <div className="bg-amber-100 p-3 rounded-full h-fit text-amber-600"><Brain size={24}/></div>
                       <div>
                          <h4 className="font-bold text-slate-900 text-lg mb-1">{strings.helpContent.step1Title}</h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{strings.helpContent.step1Desc}</p>
                       </div>
                    </div>

                    <div className="flex gap-4">
                       <div className="bg-blue-100 p-3 rounded-full h-fit text-blue-600"><Hammer size={24}/></div>
                       <div>
                          <h4 className="font-bold text-slate-900 text-lg mb-1">{strings.helpContent.step2Title}</h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{strings.helpContent.step2Desc}</p>
                       </div>
                    </div>

                    <div className="flex gap-4">
                       <div className="bg-emerald-100 p-3 rounded-full h-fit text-emerald-600"><Play size={24}/></div>
                       <div>
                          <h4 className="font-bold text-slate-900 text-lg mb-1">{strings.helpContent.step3Title}</h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{strings.helpContent.step3Desc}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-slate-50 border-t">
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors"
                >
                  {strings.close}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Load Project Modal (Global) */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <FolderOpen className="text-emerald-600" size={20} />
                 {strings.openSaved}
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

export default App;