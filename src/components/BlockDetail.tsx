import React from 'react';
import { 
  MapPin, Star, Calendar, User, Info, Navigation, 
  Edit2, Trash2, CheckCircle, ArrowLeft, 
  ExternalLink, Ruler, Mountain, Sun, AlertTriangle,
  Clock, ShieldAlert, Shield
} from 'lucide-react';
import { Block, BlockStatus } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BlockDetailProps {
  block: Block;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGuide: () => void;
  onToggleFavorite: () => void;
  onToggleVisited: () => void;
  isAdmin?: boolean;
  isOwner?: boolean;
}

const STATUS_COLORS: Record<BlockStatus, string> = {
  new: 'bg-blue-500',
  clean: 'bg-emerald-500',
  to_clean: 'bg-amber-500',
  project: 'bg-purple-500',
};

const STATUS_LABELS: Record<BlockStatus, string> = {
  new: 'Nuovo',
  clean: 'Pulito',
  to_clean: 'Da Pulire',
  project: 'Progetto',
};

export const BlockDetail: React.FC<BlockDetailProps> = ({
  block,
  onBack,
  onEdit,
  onDelete,
  onGuide,
  onToggleFavorite,
  onToggleVisited,
  isAdmin = false,
  isOwner = false,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const date = block.createdAt?.toDate ? block.createdAt.toDate() : new Date(block.createdAt);

  const canEdit = isOwner || isAdmin;

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Header Image */}
      <div className="relative h-72 bg-stone-200">
        {block.photos?.[0] ? (
          <img
            src={block.photos[0]}
            alt={block.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <MapPin className="w-16 h-16" />
          </div>
        )}
        
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent">
          <button onClick={onBack} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onToggleFavorite} className={cn(
              "p-2 bg-white/20 backdrop-blur-md rounded-full",
              block.favorite ? "text-amber-400" : "text-white"
            )}>
              <Star className={cn("w-6 h-6", block.favorite && "fill-current")} />
            </button>
            {canEdit && (
              <button onClick={onEdit} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
                <Edit2 className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className={cn(
            "inline-block px-2 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider mb-2",
            STATUS_COLORS[block.status]
          )}>
            {STATUS_LABELS[block.status]}
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">{block.name}</h1>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <MapPin className="w-4 h-4" />
            {block.area}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-px bg-stone-200 border-b border-stone-200">
          <div className="bg-white p-3 flex flex-col items-center justify-center text-center">
            <Ruler className="w-4 h-4 text-stone-400 mb-1" />
            <span className="text-[10px] font-black text-stone-800">{block.height || '---'}m</span>
            <span className="text-[8px] text-stone-400 uppercase tracking-wider">Altezza</span>
          </div>
          <div className="bg-white p-3 flex flex-col items-center justify-center text-center">
            <Sun className="w-4 h-4 text-stone-400 mb-1" />
            <span className="text-[10px] font-black text-stone-800">{block.exposure || '---'}</span>
            <span className="text-[8px] text-stone-400 uppercase tracking-wider">Sole</span>
          </div>
          <div className={cn(
            "p-3 flex flex-col items-center justify-center text-center",
            block.riskLevel === 'Danger' ? "bg-red-50" : block.riskLevel === 'Loose' ? "bg-amber-50" : "bg-white"
          )}>
            {block.riskLevel === 'Danger' ? (
              <ShieldAlert className="w-4 h-4 text-red-500 mb-1" />
            ) : block.riskLevel === 'Loose' ? (
              <AlertTriangle className="w-4 h-4 text-amber-500 mb-1" />
            ) : (
              <Shield className="w-4 h-4 text-emerald-500 mb-1" />
            )}
            <span className={cn(
              "text-[10px] font-black uppercase tracking-tighter opacity-80 italic",
              block.riskLevel === 'Danger' ? "text-red-600" : block.riskLevel === 'Loose' ? "text-amber-600" : "text-emerald-600"
            )}>
              {block.riskLevel === 'Danger' ? 'PERICOLO' : block.riskLevel === 'Loose' ? 'INSTABILE' : 'SOLIDO'}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onGuide}
              className="flex items-center justify-center gap-2 p-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition-transform"
            >
              <Navigation className="w-5 h-5" />
              Guidami
            </button>
            <button
              onClick={onToggleVisited}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-2xl font-bold border-2 active:scale-95 transition-transform",
                block.visited 
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                  : "bg-white border-stone-200 text-stone-600"
              )}
            >
              <CheckCircle className={cn("w-5 h-5", block.visited && "fill-current")} />
              {block.visited ? 'Visitato' : 'Visita'}
            </button>
          </div>

          {/* Lines Table */}
          {block.lines && block.lines.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Linee / Boulder ({block.lines.length})</h3>
              <div className="bg-white border border-stone-100 rounded-3xl overflow-hidden shadow-sm">
                {block.lines.map((line, idx) => (
                  <div key={line.id || idx} className="p-4 flex items-center justify-between border-b last:border-0 border-stone-50">
                    <div className="flex items-center gap-3">
                      {line.number && (
                        <div className="w-7 h-7 flex items-center justify-center bg-emerald-600 rounded-lg text-xs font-black text-white shadow-sm shrink-0">
                          {line.number}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-stone-800">{line.name || `Linea ${idx + 1}`}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tight italic">
                            {line.status === 'clean' ? 'Pulito' : line.status === 'project' ? 'Progetto' : 'Nuovo'}
                          </span>
                          {line.opener && (
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest before:content-['•'] before:mr-2 before:text-stone-300">
                              {line.opener}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-stone-900 text-white rounded-lg text-[10px] font-black italic">
                      {line.grade || '---'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Details */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Informazioni</h3>
            
            <div className="space-y-4">
              {block.style && (
                <div className="flex gap-4">
                  <Info className="w-5 h-5 text-stone-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">Stile / Appigli</p>
                    <p className="text-sm text-stone-500">{block.style}</p>
                  </div>
                </div>
              )}
              
              {block.accessNotes && (
                <div className="flex gap-4">
                  <Clock className="w-5 h-5 text-stone-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">Accesso</p>
                    <p className="text-sm text-stone-500">{block.accessNotes}</p>
                  </div>
                </div>
              )}

              {block.landingNotes && (
                <div className="flex gap-4">
                  <ShieldAlert className="w-5 h-5 text-stone-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">Atterraggio</p>
                    <p className="text-sm text-stone-500">{block.landingNotes}</p>
                  </div>
                </div>
              )}

              {block.riskLevel && (
                <div className="flex gap-4">
                  <AlertTriangle className="w-5 h-5 text-stone-300 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">Pericolosità</p>
                    <p className="text-sm text-stone-500">{block.riskLevel}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Photo Gallery */}
          {block.photos && block.photos.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Galleria Foto</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {block.photos.map((photo, idx) => (
                  <div key={idx} className="w-64 aspect-video bg-stone-100 rounded-3xl overflow-hidden shrink-0 shadow-lg border-4 border-white">
                    <img src={photo} alt={`Block detail ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Metadata */}
          <div className="pt-6 border-t border-stone-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Calendar className="w-3 h-3" />
              Inserito il {format(date, 'd MMMM yyyy', { locale: it })}
            </div>
            <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest bg-amber-50 self-start px-3 py-1 rounded-xl border border-amber-100">
              <User className="w-3 h-3" />
              Progetto di: {block.projectOwner || block.createdByDisplayName || block.createdByEmail || 'Anonimo'}
            </div>
          </div>

          {canEdit && (
            <div className="pt-4">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-black uppercase tracking-widest italic border-2 border-red-500/10 rounded-2xl active:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  Elimina Blocco
                </button>
              ) : (
                <div className="p-6 bg-red-50 rounded-3xl border-2 border-red-100 space-y-4">
                  <p className="text-red-700 text-sm font-bold text-center">
                    Sei sicuro di voler eliminare definitivamente questo blocco? Questa azione non è reversibile.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={onDelete}
                      className="flex-1 p-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest italic shadow-lg shadow-red-900/20"
                    >
                      Sì, Elimina
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 p-4 bg-white text-stone-500 rounded-2xl font-black uppercase tracking-widest italic border border-stone-200"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
