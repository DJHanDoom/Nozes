import React, { useState, useMemo } from 'react';
import { Project, Entity, Language } from '../types';
import { RotateCcw, Check, X, Filter, Image as ImageIcon, Eye, ArrowLeft, Info, BookOpen, Tag, Link as LinkIcon, ExternalLink, List, Grid, FolderOpen, Edit, Download, FileSpreadsheet, FileCode } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

// Generate standalone HTML file with embedded player
const generateStandaloneHTML = (project: Project, lang: Language): string => {
  const projectJSON = JSON.stringify(project);
  const isEn = lang === 'en';
  
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

interface PlayerProps {
  project: Project;
  onBack: () => void;
  language: Language;
  onOpenSaved?: () => void;
  onEditKey?: () => void;
}

const t = {
  en: {
    player: "PLAYER",
    restart: "Restart",
    exit: "Exit",
    features: "Features",
    selected: "selected",
    matches: "Matches",
    discarded: "Discarded",
    identified: "1 Entity identified",
    potential: "potential matches",
    excluded: "Excluded by selection",
    noMatches: "No matches found.",
    tryUnselecting: "Try unselecting some features.",
    speciesDetails: "Species Details",
    morphology: "Morphology & Traits",
    close: "Close",
    resources: "Resources",
    viewResults: "View Results",
    openSaved: "Open",
    editKey: "Edit",
    exportJson: "JSON",
    exportXlsx: "XLSX",
    exportHtml: "HTML"
  },
  pt: {
    player: "PLAYER",
    restart: "Reiniciar",
    exit: "Sair",
    features: "Características",
    selected: "selecionado(s)",
    matches: "Compatíveis",
    discarded: "Descartados",
    identified: "1 Entidade identificada",
    potential: "matches potenciais",
    excluded: "Excluído pela seleção",
    noMatches: "Nenhum resultado.",
    tryUnselecting: "Tente remover seleções.",
    speciesDetails: "Detalhes da Espécie",
    morphology: "Morfologia & Características",
    close: "Fechar",
    resources: "Recursos Adicionais",
    viewResults: "Ver Resultados",
    openSaved: "Abrir",
    editKey: "Editar",
    exportJson: "JSON",
    exportXlsx: "XLSX",
    exportHtml: "HTML"
  }
};

export const Player: React.FC<PlayerProps> = ({ project, onBack, language, onOpenSaved, onEditKey }) => {
  const strings = t[language];
  // Map of FeatureID -> Set of selected StateIDs
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [activeFeatureImage, setActiveFeatureImage] = useState<string | null>(null);
  const [viewingEntity, setViewingEntity] = useState<Entity | null>(null);
  
  // Mobile View State: 'FILTERS' (Features) or 'RESULTS' (Entities)
  const [mobileTab, setMobileTab] = useState<'FILTERS' | 'RESULTS'>('FILTERS');

  const toggleSelection = (featureId: string, stateId: string) => {
    setSelections(prev => {
      const currentStats = prev[featureId] || [];
      const isSelected = currentStats.includes(stateId);
      
      let newStates;
      if (isSelected) {
        newStates = currentStats.filter(id => id !== stateId);
      } else {
        newStates = [...currentStats, stateId];
      }

      if (newStates.length === 0) {
        const { [featureId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [featureId]: newStates };
    });
  };

  const resetKey = () => setSelections({});

  const { remaining, discarded } = useMemo(() => {
    const remainingEntities: Entity[] = [];
    const discardedEntities: Entity[] = [];

    project.entities.forEach(entity => {
      let isMatch = true;
      for (const [featureId, selectedStateIds] of Object.entries(selections)) {
        const entityStates = entity.traits[featureId] || [];
        const hasOverlap = (selectedStateIds as string[]).some(id => entityStates.includes(id));
        
        if (!hasOverlap) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) remainingEntities.push(entity);
      else discardedEntities.push(entity);
    });

    return { remaining: remainingEntities, discarded: discardedEntities };
  }, [project.entities, selections]);

  // Count total active selections
  const totalSelectionsCount = Object.values(selections).reduce((acc, curr) => acc + curr.length, 0);

  // Export project as JSON
  const exportJSON = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export project as XLSX
  const exportXLSX = () => {
    const featureMap = new Map(project.features.map(f => [f.id, f]));
    const headers = ['Entity', ...project.features.map(f => f.name)];
    
    const rows = project.entities.map(entity => {
      const row: string[] = [entity.name];
      project.features.forEach(feature => {
        const entityStateIds = entity.traits[feature.id] || [];
        const stateNames = entityStateIds
          .map(sid => feature.states.find(s => s.id === sid)?.label || '')
          .filter(Boolean)
          .join(', ');
        row.push(stateNames);
      });
      return row;
    });

    const wsData = [headers, ...rows];
    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Matrix');
    writeFile(wb, `${project.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Export project as standalone HTML
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

  return (
    <div className="flex flex-col h-full bg-slate-100 font-sans absolute inset-0">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button 
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="overflow-hidden">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
              <span className="hidden sm:inline-block bg-emerald-600 text-white text-xs px-2 py-1 rounded">{strings.player}</span>
              <span className="truncate">{project.name}</span>
            </h2>
          </div>
        </div>
        <div className="flex gap-1 sm:gap-2 shrink-0">
          {/* Open saved key button */}
          {onOpenSaved && (
            <button 
              onClick={onOpenSaved}
              className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title={strings.openSaved}
            >
              <FolderOpen size={18} /> <span className="hidden lg:inline">{strings.openSaved}</span>
            </button>
          )}
          {/* Edit key button */}
          {onEditKey && (
            <button 
              onClick={onEditKey}
              className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title={strings.editKey}
            >
              <Edit size={18} /> <span className="hidden lg:inline">{strings.editKey}</span>
            </button>
          )}
          {/* Export JSON */}
          <button 
            onClick={exportJSON}
            className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            title={strings.exportJson}
          >
            <Download size={18} /> <span className="hidden lg:inline">{strings.exportJson}</span>
          </button>
          {/* Export XLSX */}
          <button 
            onClick={exportXLSX}
            className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            title={strings.exportXlsx}
          >
            <FileSpreadsheet size={18} /> <span className="hidden lg:inline">{strings.exportXlsx}</span>
          </button>
          {/* Export HTML */}
          <button 
            onClick={exportHTML}
            className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            title={strings.exportHtml}
          >
            <FileCode size={18} /> <span className="hidden lg:inline">{strings.exportHtml}</span>
          </button>
          {/* Restart */}
          <button 
            onClick={resetKey}
            className="flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title={strings.restart}
          >
            <RotateCcw size={18} /> <span className="hidden lg:inline">{strings.restart}</span>
          </button>
          <button 
            onClick={onBack}
            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} /> {strings.exit}
          </button>
        </div>
      </header>

      {/* Mobile Tab Navigation (Visible only on small screens) */}
      <div className="md:hidden flex border-b bg-white z-20 shrink-0">
        <button 
          onClick={() => setMobileTab('FILTERS')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${
            mobileTab === 'FILTERS' ? 'text-emerald-600' : 'text-slate-500 bg-slate-50'
          }`}
        >
          <Filter size={16} /> 
          {strings.features}
          {totalSelectionsCount > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
              {totalSelectionsCount}
            </span>
          )}
          {mobileTab === 'FILTERS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"></div>}
        </button>
        <button 
          onClick={() => setMobileTab('RESULTS')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${
            mobileTab === 'RESULTS' ? 'text-emerald-600' : 'text-slate-500 bg-slate-50'
          }`}
        >
          <Grid size={16} /> 
          {strings.matches}
          <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {remaining.length}
          </span>
          {mobileTab === 'RESULTS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"></div>}
        </button>
      </div>

      {/* Main Content Area - Split View on Desktop, Swappable on Mobile */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Features Panel (Left on Desktop / Tab 1 on Mobile) */}
        <div className={`w-full md:w-1/3 lg:w-1/4 bg-white md:border-r flex flex-col h-full relative z-20 ${mobileTab === 'FILTERS' ? 'flex' : 'hidden md:flex'}`}>
          <div className="hidden md:block p-4 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Filter size={18} /> {strings.features}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:pb-4 custom-scrollbar">
            {project.features.map(feature => {
              const currentSelections = selections[feature.id] || [];
              const hasSelection = currentSelections.length > 0;

              return (
                <div key={feature.id} className="space-y-2 relative">
                  <div className="flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm py-1 z-10">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${hasSelection ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {feature.name}
                      </h4>
                      {feature.imageUrl && (
                         <>
                            <button 
                              className="text-slate-400 hover:text-emerald-500 transition-colors p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFeatureImage(activeFeatureImage === feature.id ? null : feature.id);
                              }}
                            >
                               <ImageIcon size={14} />
                            </button>
                         </>
                      )}
                    </div>
                    {hasSelection && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {currentSelections.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Inline Feature Image for Mobile/Desktop */}
                  {activeFeatureImage === feature.id && feature.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-slate-200 shadow-sm animate-in fade-in zoom-in-95">
                        <img src={feature.imageUrl} alt={feature.name} className="w-full h-32 object-cover" />
                        <div className="bg-slate-50 p-1 text-center">
                          <button onClick={() => setActiveFeatureImage(null)} className="text-xs text-slate-500 underline">Fechar</button>
                        </div>
                      </div>
                  )}

                  <div className="grid grid-cols-1 gap-1">
                    {feature.states.map(state => {
                      const isSelected = currentSelections.includes(state.id);
                      return (
                        <button
                          key={state.id}
                          onClick={() => toggleSelection(feature.id, state.id)}
                          className={`w-full text-left px-3 py-3 md:py-2 text-sm rounded-lg transition-all flex items-center justify-between group active:scale-[0.98] touch-manipulation ${
                            isSelected 
                              ? 'bg-emerald-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <span className="leading-tight">{state.label}</span>
                          {isSelected && <Check size={16} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Mobile Floating Button to Switch to Results */}
          <div className="md:hidden absolute bottom-4 left-4 right-4 z-30">
            <button 
               onClick={() => setMobileTab('RESULTS')}
               className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 animate-in slide-in-from-bottom-5"
            >
               {strings.viewResults} ({remaining.length})
            </button>
          </div>
        </div>

        {/* Entities Panel (Right on Desktop / Tab 2 on Mobile) */}
        <div className={`flex-1 bg-slate-100 flex-col h-full overflow-hidden ${mobileTab === 'RESULTS' ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-3 md:p-4 bg-white border-b flex justify-between items-center shadow-sm shrink-0">
            <div className="flex gap-2 md:gap-4 w-full md:w-auto bg-slate-100 p-1 rounded-lg">
              <button 
                className={`flex-1 md:flex-none text-xs md:text-sm font-medium px-3 py-1.5 rounded-md transition-all ${!showDiscarded ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setShowDiscarded(false)}
              >
                {strings.matches} ({remaining.length})
              </button>
              <button 
                className={`flex-1 md:flex-none text-xs md:text-sm font-medium px-3 py-1.5 rounded-md transition-all ${showDiscarded ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setShowDiscarded(true)}
              >
                {strings.discarded} ({discarded.length})
              </button>
            </div>
            <div className="text-xs text-slate-400 hidden sm:block">
              {remaining.length === 1 ? strings.identified : `${remaining.length} ${strings.potential}`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar" onClick={() => setActiveFeatureImage(null)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 md:pb-0">
              {(showDiscarded ? discarded : remaining).map(entity => (
                <div 
                  key={entity.id} 
                  onClick={() => setViewingEntity(entity)}
                  className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border cursor-pointer active:scale-[0.98] touch-manipulation ${showDiscarded ? 'opacity-60 grayscale' : ''}`}
                >
                  <div className="h-48 md:h-40 bg-slate-200 relative group">
                    <img 
                      src={entity.imageUrl || "https://picsum.photos/400/300"} 
                      alt={entity.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium">
                       <Eye size={20} /> <span className="hidden md:inline">Ver Detalhes</span>
                    </div>
                    {/* Mobile Only overlay icon */}
                    <div className="md:hidden absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full backdrop-blur-sm">
                      <Eye size={16} />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-800 text-lg mb-1 flex justify-between items-center">
                      {entity.name}
                      <Info size={16} className="text-slate-300" />
                    </h3>
                    <p className="text-slate-500 text-xs line-clamp-3">{entity.description}</p>
                    
                    {showDiscarded && (
                      <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-red-500 flex items-center gap-1">
                        <X size={12} /> {strings.excluded}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {!showDiscarded && remaining.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 px-4 text-center">
                  <Filter size={48} className="mb-4 opacity-50" />
                  <p className="text-lg font-medium text-slate-600">{strings.noMatches}</p>
                  <p className="text-sm">{strings.tryUnselecting}</p>
                  <button 
                    onClick={resetKey} 
                    className="mt-6 px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
                  >
                    {strings.restart}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Species Detail Modal */}
      {viewingEntity && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white md:rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col h-full md:h-auto md:max-h-[90vh] overflow-hidden">
            
            {/* Header / Image */}
            <div className="relative h-64 md:h-64 shrink-0 bg-slate-900">
               {viewingEntity.imageUrl ? (
                 <img src={viewingEntity.imageUrl} className="w-full h-full object-cover opacity-90" alt={viewingEntity.name} />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-200">
                    <ImageIcon size={48} />
                 </div>
               )}
               <button 
                  onClick={() => setViewingEntity(null)}
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors z-10 backdrop-blur-sm"
                >
                  <X size={24} />
               </button>
               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-12">
                  <h2 className="text-2xl md:text-3xl font-bold text-white shadow-sm leading-tight">{viewingEntity.name}</h2>
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white">
               
               {/* Description */}
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <BookOpen size={14} /> {strings.speciesDetails}
                  </h3>
                  <p className="text-slate-800 leading-relaxed text-base md:text-lg font-serif">
                    {viewingEntity.description}
                  </p>
               </div>
               
               {/* Additional Links */}
               {(viewingEntity.links && viewingEntity.links.length > 0) && (
                 <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <LinkIcon size={14} /> {strings.resources}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {viewingEntity.links.map((link, idx) => (
                        <a 
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 transition-all group active:scale-[0.98]"
                        >
                          <div className="bg-white p-2 rounded-md shadow-sm text-slate-400 group-hover:text-emerald-600">
                             <ExternalLink size={16} />
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 truncate flex-1">{link.label || link.url}</span>
                        </a>
                      ))}
                    </div>
                 </div>
               )}

               <div className="border-t border-slate-100"></div>

               {/* Compiled Traits */}
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Tag size={14} /> {strings.morphology}
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {project.features.map(feature => {
                      const entityStateIds = viewingEntity.traits[feature.id];
                      // Only show features that are defined for this entity
                      if (!entityStateIds || entityStateIds.length === 0) return null;

                      // Resolve state labels
                      const stateLabels = entityStateIds.map(id => {
                        const state = feature.states.find(s => s.id === id);
                        return state ? state.label : '?';
                      }).join(", ");

                      return (
                        <div key={feature.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{feature.name}</span>
                           <span className="text-sm font-semibold text-slate-800">{stateLabels}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {Object.keys(viewingEntity.traits).length === 0 && (
                     <p className="text-slate-400 text-sm italic">Nenhuma característica registrada.</p>
                  )}
               </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 shrink-0 safe-area-bottom">
               <button 
                 onClick={() => setViewingEntity(null)}
                 className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
               >
                 {strings.close}
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};