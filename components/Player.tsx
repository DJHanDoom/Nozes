import React, { useState, useMemo } from 'react';
import { Project, Entity, Language } from '../types';
import { RotateCcw, Check, X, Filter, Image as ImageIcon, Eye, ArrowLeft, Info, BookOpen, Tag, Link as LinkIcon, ExternalLink } from 'lucide-react';

interface PlayerProps {
  project: Project;
  onBack: () => void;
  language: Language;
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
    resources: "Resources"
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
    resources: "Recursos Adicionais"
  }
};

export const Player: React.FC<PlayerProps> = ({ project, onBack, language }) => {
  const strings = t[language];
  // Map of FeatureID -> Set of selected StateIDs
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [activeFeatureImage, setActiveFeatureImage] = useState<string | null>(null);
  const [viewingEntity, setViewingEntity] = useState<Entity | null>(null);

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

  return (
    <div className="flex flex-col h-full bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded">{strings.player}</span>
            {project.name}
          </h2>
          <p className="text-sm text-slate-500 truncate max-w-md">{project.description}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={resetKey}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw size={16} /> <span className="hidden sm:inline">{strings.restart}</span>
          </button>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} /> {strings.exit}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Features Panel (Left) */}
        <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r flex flex-col h-1/2 md:h-full relative z-20">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Filter size={18} /> {strings.features}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
            {project.features.map(feature => {
              const currentSelections = selections[feature.id] || [];
              const hasSelection = currentSelections.length > 0;

              return (
                <div key={feature.id} className="space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${hasSelection ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {feature.name}
                      </h4>
                      {feature.imageUrl && (
                         <>
                            <button 
                              className="text-slate-400 hover:text-emerald-500 transition-colors p-1"
                              onMouseEnter={() => setActiveFeatureImage(feature.id)}
                              onMouseLeave={() => setActiveFeatureImage(null)}
                              onClick={() => setActiveFeatureImage(activeFeatureImage === feature.id ? null : feature.id)}
                            >
                               <ImageIcon size={14} />
                            </button>
                            {/* Fixed Position Modal to escape overflow clipping */}
                            {activeFeatureImage === feature.id && (
                              <div 
                                className="fixed z-50 w-64 p-3 bg-white rounded-xl shadow-2xl border border-slate-200 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                                style={{ 
                                  left: '340px', // Approximate width of sidebar + margin
                                  top: '20%',
                                }}
                              >
                                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2">
                                  <img src={feature.imageUrl} alt={feature.name} className="w-full h-full object-cover" />
                                </div>
                                <p className="text-xs font-semibold text-slate-700 text-center">{feature.name}</p>
                              </div>
                            )}
                         </>
                      )}
                    </div>
                    {hasSelection && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {currentSelections.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {feature.states.map(state => {
                      const isSelected = currentSelections.includes(state.id);
                      return (
                        <button
                          key={state.id}
                          onClick={() => toggleSelection(feature.id, state.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center justify-between group ${
                            isSelected 
                              ? 'bg-emerald-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                          }`}
                        >
                          <span>{state.label}</span>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Entities Panel (Right) */}
        <div className="flex-1 bg-slate-100 flex flex-col h-1/2 md:h-full overflow-hidden">
          <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
            <div className="flex gap-4">
              <button 
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${!showDiscarded ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => setShowDiscarded(false)}
              >
                {strings.matches} ({remaining.length})
              </button>
              <button 
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${showDiscarded ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => setShowDiscarded(true)}
              >
                {strings.discarded} ({discarded.length})
              </button>
            </div>
            <div className="text-xs text-slate-400 hidden sm:block">
              {remaining.length === 1 ? strings.identified : `${remaining.length} ${strings.potential}`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6" onClick={() => setActiveFeatureImage(null)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(showDiscarded ? discarded : remaining).map(entity => (
                <div 
                  key={entity.id} 
                  onClick={() => setViewingEntity(entity)}
                  className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all border cursor-pointer ${showDiscarded ? 'opacity-60 grayscale' : ''}`}
                >
                  <div className="h-40 bg-slate-200 relative group">
                    <img 
                      src={entity.imageUrl || "https://picsum.photos/400/300"} 
                      alt={entity.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium">
                       <Eye size={20} /> Ver Detalhes
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
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                  <Filter size={48} className="mb-4 opacity-50" />
                  <p className="text-lg">{strings.noMatches}</p>
                  <p className="text-sm">{strings.tryUnselecting}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Species Detail Modal */}
      {viewingEntity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 overflow-hidden">
            
            {/* Header / Image */}
            <div className="relative h-48 sm:h-64 shrink-0 bg-slate-800">
               {viewingEntity.imageUrl ? (
                 <img src={viewingEntity.imageUrl} className="w-full h-full object-cover opacity-90" alt={viewingEntity.name} />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-200">
                    <ImageIcon size={48} />
                 </div>
               )}
               <button 
                  onClick={() => setViewingEntity(null)}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                >
                  <X size={20} />
               </button>
               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <h2 className="text-3xl font-bold text-white shadow-sm">{viewingEntity.name}</h2>
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
               
               {/* Description */}
               <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2 mb-2">
                    <BookOpen size={16} /> {strings.speciesDetails}
                  </h3>
                  <p className="text-slate-700 leading-relaxed text-lg">
                    {viewingEntity.description}
                  </p>
               </div>
               
               {/* Additional Links */}
               {(viewingEntity.links && viewingEntity.links.length > 0) && (
                 <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2 mb-3">
                      <LinkIcon size={16} /> {strings.resources}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {viewingEntity.links.map((link, idx) => (
                        <a 
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 transition-all group"
                        >
                          <div className="bg-white p-2 rounded-md shadow-sm text-slate-400 group-hover:text-emerald-600">
                             <ExternalLink size={16} />
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 truncate">{link.label || link.url}</span>
                        </a>
                      ))}
                    </div>
                 </div>
               )}

               <div className="border-t border-slate-100 my-4"></div>

               {/* Compiled Traits */}
               <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2 mb-4">
                    <Tag size={16} /> {strings.morphology}
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
                           <span className="text-xs font-semibold text-slate-500 uppercase mb-1">{feature.name}</span>
                           <span className="text-sm font-medium text-slate-900">{stateLabels}</span>
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
            <div className="p-4 border-t bg-slate-50 shrink-0">
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