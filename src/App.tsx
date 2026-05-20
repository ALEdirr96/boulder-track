/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  getDoc,
  where,
  getDocs,
  setDoc,
  limit
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { db, auth, firebaseConfigExport } from './firebase';
import { Block, BlockStatus, UserProfile } from './types';
import { Layout } from './components/Layout';
import { BlockCard } from './components/BlockCard';
import { BlockDetail } from './components/BlockDetail';
import { BlockForm } from './components/BlockForm';
import { MapView } from './components/MapView';
import { Compass } from './components/Compass';
import { UserManagement } from './components/UserManagement';
import { Logo } from './components/Logo';
import { useLocation } from './hooks/useLocation';
import { 
  Loader2, LogIn, Mountain, Filter, 
  CheckCircle, Star, AlertCircle, X,
  ArrowLeft, Search, UserPlus, Shield, Info, ExternalLink, Clock
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return JSON.stringify(errInfo);
}

type View = 'list' | 'map' | 'detail' | 'form' | 'guide' | 'profile' | 'admin';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'profile' | 'admin'>('home');
  const [filter, setFilter] = useState<BlockStatus | 'all' | 'favorite' | 'visited'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth form state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const { location, error: locationError, needsCompassPermission, requestCompassPermission } = useLocation();

  // Auth Listener - Non-blocking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      console.log("Auth state changed:", fbUser?.email);
      setUser(fbUser);
      setAuthReady(true);
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Profile Fetcher - Handles background logic
  useEffect(() => {
    if (!user) return;


    const syncProfile = async () => {
      setLoading(true);
      try {
        const userEmail = user.email?.toLowerCase();
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (profileDoc.exists()) {
          const data = profileDoc.data() as UserProfile;
          setProfile({ uid: user.uid, ...data });
        } else {
          const isSuperAdmin = userEmail === 'asdadmin@scalamasino.com' || userEmail === 'videoclipalessandrosangiorgio@gmail.com';
          const newProfile = {
            email: userEmail || '',
            displayName: userEmail === 'asdadmin@scalamasino.com' ? 'Admin Scalamasino' : (userEmail === 'videoclipalessandrosangiorgio@gmail.com' ? 'Alessandro Sangiorgio' : (user.displayName || userEmail?.split('@')[0] || 'Utente')),
            role: isSuperAdmin ? 'admin' : 'user',
            status: isSuperAdmin ? 'active' : 'pending',
            createdAt: serverTimestamp(),
            photoURL: user.photoURL || null
          };
          
          try {
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile({ uid: user.uid, ...newProfile } as any);
          } catch (e: any) {
            console.error("Profile creation error:", e);
            setAuthError("Errore creazione profilo: " + e.message);
          }
        }
      } catch (err: any) {
        console.error("Profile sync error:", err);
        setAuthError("Errore sincronizzazione profilo.");
      } finally {
        setLoading(false);
      }
    };

    syncProfile();
  }, [user]);

  // Blocks Listener
  useEffect(() => {
    if (!user || !profile || profile.status !== 'active') return;

    setLoading(true);
    const q = query(collection(db, 'blocks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const blocksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Block[];
      setBlocks(blocksData);
      setLoading(false);
    }, (error) => {
      console.error("Blocks snapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, profile]);

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError("Inserisci la tua email per reimpostare la password.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Email di ripristino password inviata! Controlla la tua casella di posta.");
      setAuthError(null);
    } catch (error: any) {
      console.error("Reset Error:", error);
      setAuthError("Errore nell'invio dell'email: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError("L'accesso con Email/Password non è abilitato nella console Firebase.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("Questa email è già registrata. Prova ad accedere.");
      } else if (error.code === 'auth/weak-password') {
        setAuthError("La password deve avere almeno 6 caratteri.");
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError("Credenziali non valide. Controlla email e password.");
      } else {
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentView('list');
      setActiveTab('home');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Wrapper for Firestore operations with error handling
  const executeFirestore = async (op: () => Promise<any>, operationType: OperationType, path: string | null, friendlyMsg: string) => {
    try {
      return await op();
    } catch (error) {
      console.error(error);
      const detailedError = handleFirestoreError(error, operationType, path);
      alert(`${friendlyMsg}\n\nDettagli tecnici: ${detailedError}`);
    }
  };

  const handleAddBlock = async (data: Partial<Block>) => {
    if (!user || !profile) return;
    await executeFirestore(async () => {
      await addDoc(collection(db, 'blocks'), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email,
        createdByDisplayName: profile.displayName,
        visited: false,
        favorite: false,
      });
      setCurrentView('list');
    }, OperationType.CREATE, 'blocks', "Errore nel salvataggio del blocco. Potresti non avere i permessi necessari.");
  };

  const handleUpdateBlock = async (data: Partial<Block>) => {
    if (!user || !selectedBlock) return;
    await executeFirestore(async () => {
      const blockRef = doc(db, 'blocks', selectedBlock.id);
      await updateDoc(blockRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setSelectedBlock({ ...selectedBlock, ...data });
      setCurrentView('detail');
    }, OperationType.UPDATE, `blocks/${selectedBlock.id}`, "Errore nell'aggiornamento. Permesso negato.");
  };

  const handleDeleteBlock = async (id: string) => {
    if (!user) return;
    await executeFirestore(async () => {
      await deleteDoc(doc(db, 'blocks', id));
      setCurrentView('list');
      setSelectedBlock(null);
    }, OperationType.DELETE, `blocks/${id}`, "Errore nell'eliminazione.");
  };

  const handleToggleFavorite = async (block: Block) => {
    if (!user) return;
    await executeFirestore(async () => {
      await updateDoc(doc(db, 'blocks', block.id), {
        favorite: !block.favorite
      });
    }, OperationType.UPDATE, `blocks/${block.id}`, "Errore aggiornamento preferite.");
  };

  const handleToggleVisited = async (block: Block) => {
    if (!user) return;
    await executeFirestore(async () => {
      await updateDoc(doc(db, 'blocks', block.id), {
        visited: !block.visited
      });
    }, OperationType.UPDATE, `blocks/${block.id}`, "Errore aggiornamento visita.");
  };

  const handleUpdateProfile = async (newName: string) => {
    if (!user || !profile) return;
    await executeFirestore(async () => {
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, {
        displayName: newName
      });
      setProfile({ ...profile, displayName: newName });
    }, OperationType.UPDATE, `users/${user.uid}`, "Errore nell'aggiornamento del profilo.");
  };

  const filteredBlocks = useMemo(() => {
    return blocks.filter(b => {
      const matchesFilter = (() => {
        if (filter === 'all') return true;
        if (filter === 'favorite') return b.favorite;
        if (filter === 'visited') return b.visited;
        return b.status === filter;
      })();

      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.area.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [blocks, filter, searchQuery]);

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs">Caricamento Scalamasino...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-stone-900 p-8 text-center overflow-y-auto">
        <div className="mb-12">
          <Logo className="scale-150" showText={false} />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter italic">Boulder Tracker</h1>
        <p className="text-emerald-500/80 font-bold uppercase tracking-widest text-[10px] mb-8">
          Partner ASD Scalamasino
        </p>
        
        <div className="w-full max-w-sm bg-stone-800 p-6 rounded-3xl border border-stone-700 shadow-xl">
          <h2 className="text-white font-bold mb-6 text-left flex items-center gap-2">
            {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isLogin ? 'Accedi allo strumento' : 'Registra nuovo profilo'}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-stone-900 border border-stone-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-stone-900 border border-stone-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
            />
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {authError}
                </div>
                {authError.includes("console Firebase") && (
                  <a 
                    href={`https://console.firebase.google.com/project/${firebaseConfigExport.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] underline font-bold uppercase tracking-widest text-emerald-500"
                  >
                    Apri Console Firebase
                  </a>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-900/20 font-black uppercase tracking-widest italic disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Entra' : 'Registrati')}
            </button>
          </form>

          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="w-full mt-4 text-[10px] font-bold text-stone-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              Password dimenticata?
            </button>
          )}

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="mt-12 text-stone-400 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
          >
            {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
        </div>

        <div className="mt-12 space-y-4 max-w-xs">
          <p className="text-stone-500 text-[10px] leading-relaxed uppercase font-bold">
            Strumento riservato ai soci per il tracciamento delle pulizie e l'esplorazione della Val Masino.
          </p>
          <div className="pt-4 border-t border-stone-800">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-stone-600 italic">
              Created by Alessandro Sangiorgio for ASD Scalamasino
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 text-stone-600">
             <Shield className="w-6 h-6 opacity-30" />
             <div className="w-px h-6 bg-stone-800" />
             <Mountain className="w-6 h-6 opacity-30" />
          </div>
        </div>
      </div>
    );
  }

  // Pending/Blocked Screens
  if (profile.status === 'blocked') {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <Shield className="w-16 h-16 text-red-500 mb-6 opacity-50" />
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Accesso Negato</h1>
        <p className="text-stone-400 text-sm max-w-xs mb-8">Il tuo account è stato bloccato dall'amministratore.</p>
        <button 
          onClick={handleLogout}
          className="px-8 py-3 bg-stone-800 rounded-2xl font-black uppercase tracking-widest text-[10px]"
        >
          Esci
        </button>
      </div>
    );
  }

  if (profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6 text-center text-white overflow-y-auto">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Account In Attesa</h1>
        <p className="text-stone-400 text-sm max-w-xs mb-8">
          La tua registrazione è stata ricevuta. Un amministratore deve approvare il tuo profilo prima che tu possa accedere ai dati.
        </p>
        <div className="p-4 bg-stone-800 border border-stone-700 rounded-2xl text-left mb-8 w-full max-w-sm mx-auto">
           <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Membro</p>
           <p className="text-sm font-bold text-white">{profile.displayName}</p>
           <p className="text-[10px] text-stone-400 mt-2 italic">{profile.email}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="px-8 py-3 bg-stone-800 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-700 transition-colors"
        >
          Esci e Torna più tardi
        </button>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'list':
        return (
          <div className="flex flex-col h-full bg-stone-900">
            <header className="p-6 pb-2 bg-stone-900 sticky top-0 z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Logo className="scale-75 origin-left" showText={false} />
                  <div>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">I Blocchi</h1>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                      ASD Scalamasino Explorer
                    </p>
                  </div>
                </div>
                <div onClick={() => setCurrentView('profile')} className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center border-2 border-emerald-500 cursor-pointer overflow-hidden shadow-lg shadow-emerald-500/10">
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
              </div>

              {/* Search Bar */}
              <div className="bg-stone-800 border border-stone-700 rounded-2xl px-4 py-3 flex items-center gap-3 mb-6">
                <Search className="w-4 h-4 text-stone-500" />
                <input
                  type="text"
                  placeholder="Cerca per nome o area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-stone-600 font-bold"
                />
                {searchQuery && (
                  <X 
                    className="w-4 h-4 text-stone-500 cursor-pointer" 
                    onClick={() => setSearchQuery('')} 
                  />
                )}
              </div>

              {/* Stats Card */}
              <div className="p-4 bg-stone-800 rounded-3xl border border-stone-700 mb-6 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-xl font-black text-white italic">{blocks.length}</p>
                  <p className="text-[10px] font-bold text-stone-500 uppercase">Totali</p>
                </div>
                <div className="w-px h-8 bg-stone-700" />
                <div className="text-center">
                   <p className="text-xl font-black text-emerald-500 italic">{blocks.filter(b => b.status === 'clean').length}</p>
                   <p className="text-[10px] font-bold text-stone-500 uppercase">Puliti</p>
                </div>
                <div className="w-px h-8 bg-stone-700" />
                <div className="text-center">
                   <p className="text-xl font-black text-amber-500 italic">{blocks.filter(b => b.status === 'to_clean').length}</p>
                   <p className="text-[10px] font-bold text-stone-500 uppercase">Da Pulire</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-black italic uppercase tracking-wider transition-all border-2",
                    filter === 'all' ? "bg-emerald-600 text-white border-emerald-500" : "bg-stone-800 text-stone-500 border-stone-700"
                  )}
                >
                  Tutti
                </button>
                <button
                  onClick={() => setFilter('new')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-black italic uppercase tracking-wider transition-all border-2",
                    filter === 'new' ? "bg-blue-600 text-white border-blue-500" : "bg-stone-800 text-stone-500 border-stone-700"
                  )}
                >
                  Nuovi
                </button>
                <button
                  onClick={() => setFilter('clean')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-black italic uppercase tracking-wider transition-all border-2",
                    filter === 'clean' ? "bg-emerald-600 text-white border-emerald-500" : "bg-stone-800 text-stone-500 border-stone-700"
                  )}
                >
                  Puliti
                </button>
                <button
                  onClick={() => setFilter('to_clean')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-black italic uppercase tracking-wider transition-all border-2",
                    filter === 'to_clean' ? "bg-amber-600 text-white border-amber-500" : "bg-stone-800 text-stone-500 border-stone-700"
                  )}
                >
                  Da Pulire
                </button>
                <button
                  onClick={() => setFilter('favorite')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-black italic uppercase tracking-wider flex items-center gap-2 transition-all border-2",
                    filter === 'favorite' ? "bg-pink-600 text-white border-pink-500" : "bg-stone-800 text-stone-500 border-stone-700"
                  )}
                >
                  <Star className="w-3 h-3 fill-current" /> Preferiti
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-32">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-stone-700" />
                </div>
              ) : filteredBlocks.length > 0 ? (
                filteredBlocks.map(block => (
                   <div key={block.id} className="relative">
                      <BlockCard
                        block={block}
                        onClick={() => {
                          setSelectedBlock(block);
                          setCurrentView('detail');
                        }}
                      />
                   </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mb-4 border border-stone-700">
                    <Filter className="w-8 h-8 text-stone-600" />
                  </div>
                  <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Nessun blocco trovato</p>
                </div>
              )}
              
              {/* Partner Footer */}
              <div className="pt-12 pb-8 flex flex-col items-center gap-4">
                 <div className="w-16 h-1 bg-stone-800 rounded-full" />
                 <p className="text-[10px] font-black text-stone-600 uppercase tracking-widest italic text-center">
                   Created by Alessandro Sangiorgio for ASD Scalamasino
                 </p>
              </div>
            </div>
          </div>
        );

      case 'map':
        return (
          <div className="h-full relative">
            <MapView
              blocks={blocks}
              userLocation={location ? { lat: location.lat, lng: location.lng } : undefined}
              onBlockClick={(block) => {
                setSelectedBlock(block);
                setCurrentView('detail');
              }}
              onMapLongClick={(lat, lng) => {
                setEditingBlock({ lat, lng } as any);
                setCurrentView('form');
              }}
            />
            <div className="absolute top-4 left-4 right-4 flex flex-col gap-2">
              <div className="bg-stone-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3">
                <Search className="w-5 h-5 text-emerald-500" />
                <input
                  type="text"
                  placeholder="Cerca area o blocco..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-stone-600 font-bold"
                />
                {searchQuery && (
                  <X 
                    className="w-4 h-4 text-emerald-500 cursor-pointer" 
                    onClick={() => setSearchQuery('')} 
                  />
                )}
              </div>
              <div className="flex gap-2">
                 <div className="px-3 py-1.5 bg-emerald-600/90 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase italic shadow-lg border border-emerald-500">
                    Val Masino 3D
                 </div>
                 {profile.role === 'admin' && (
                   <button 
                     onClick={() => {
                       setCurrentView('admin');
                       setActiveTab('admin');
                     }}
                     className="px-3 py-1.5 bg-stone-900/90 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase italic shadow-lg border border-stone-700 flex items-center gap-1"
                   >
                     <Shield className="w-3 h-3 text-emerald-500" /> Admin
                   </button>
                 )}
              </div>
            </div>
          </div>
        );

      case 'detail':
        return selectedBlock ? (
          <BlockDetail
            block={selectedBlock}
            onBack={() => setCurrentView(activeTab === 'map' ? 'map' : 'list')}
            onEdit={() => {
              setEditingBlock(selectedBlock);
              setCurrentView('form');
            }}
            onDelete={() => handleDeleteBlock(selectedBlock.id)}
            onGuide={() => setCurrentView('guide')}
            onToggleFavorite={() => handleToggleFavorite(selectedBlock)}
            onToggleVisited={() => handleToggleVisited(selectedBlock)}
            isAdmin={profile?.role === 'admin'}
            isOwner={profile?.uid === selectedBlock.createdBy}
          />
        ) : null;

      case 'form':
        return (
          <BlockForm
            initialData={editingBlock || {}}
            blocks={blocks}
            onSubmit={editingBlock?.id ? handleUpdateBlock : handleAddBlock}
            onCancel={() => {
              setCurrentView(editingBlock?.id ? 'detail' : 'list');
              setEditingBlock(null);
            }}
            isLoading={loading}
          />
        );

      case 'guide':
        return selectedBlock && location ? (
          <div className="h-full flex flex-col bg-stone-50">
            <header className="p-4 bg-white border-b border-stone-200 flex items-center gap-4">
              <button onClick={() => setCurrentView('detail')} className="p-2 text-stone-400">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="font-black text-stone-900 italic uppercase tracking-tight">{selectedBlock.name}</h2>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{selectedBlock.area}</p>
              </div>
            </header>
            <Compass
              targetLat={selectedBlock.lat}
              targetLng={selectedBlock.lng}
              userLat={location.lat}
              userLng={location.lng}
              userHeading={location.heading}
              needsCompassPermission={needsCompassPermission}
              requestCompassPermission={requestCompassPermission}
              onOpenInMaps={() => {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBlock.lat},${selectedBlock.lng}&travelmode=walking`);
              }}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-stone-900 border-t border-stone-800">
            <div className="w-32 h-32 bg-stone-800 rounded-full flex items-center justify-center border-2 border-emerald-500/20">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white italic uppercase mb-2">Recupero Posizione...</h3>
              <p className="text-stone-500 text-xs font-bold leading-relaxed max-w-xs">
                Assicurati che il GPS sia attivo e di aver concesso i permessi al browser.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-emerald-900/20"
              >
                Riprova
              </button>
              <button
                onClick={() => setCurrentView('detail')}
                className="px-6 py-4 bg-stone-800 text-stone-400 rounded-2xl font-black uppercase tracking-widest italic"
              >
                Torna Indietro
              </button>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="flex flex-col h-full bg-stone-900 p-8 pt-16">
            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-28 h-28 rounded-3xl bg-stone-800 flex items-center justify-center border-4 border-emerald-500 mb-6 shadow-2xl shadow-emerald-500/20 transform rotate-3 relative group">
                 <span className="text-4xl font-black text-white italic transform -rotate-3">
                   {profile.displayName.slice(0, 1).toUpperCase()}
                 </span>
              </div>
              
              <div className="space-y-2 w-full max-w-xs mx-auto">
                <div className="relative group">
                  <input
                    type="text"
                    defaultValue={profile.displayName}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value !== profile.displayName) {
                        handleUpdateProfile(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-transparent text-2xl font-black text-white italic uppercase tracking-tighter text-center outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[8px] font-black uppercase text-stone-500 tracking-widest">
                    Clicca per rinominare
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-2">
                   <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                     PROFILO {profile.role.toUpperCase()}
                   </div>
                   {profile.role === 'admin' && (
                     <button 
                       onClick={() => {
                         setCurrentView('admin');
                         setActiveTab('admin');
                       }}
                       className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"
                     >
                       <Shield className="w-3 h-3" /> Gestisci
                     </button>
                   )}
                </div>
                {profile.displayName.toLowerCase() !== 'alessandro sangiorgio' && (
                  <button 
                    onClick={() => handleUpdateProfile('Alessandro Sangiorgio')}
                    className="mt-2 text-[10px] font-black text-stone-500 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                  >
                    Imposta come "Alessandro Sangiorgio"
                  </button>
                )}
              </div>
              <p className="text-stone-500 text-xs mt-3 font-bold">{profile.email}</p>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pb-24">
              <div className="p-6 bg-stone-800 border border-stone-700 rounded-3xl shadow-xl">
                <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-6 border-b border-stone-700 pb-2 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Info Membro ASD Scalamasino
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-bold uppercase tracking-wider italic">ID Membro</span>
                    <span className="text-white font-mono">{profile.uid.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-bold uppercase tracking-wider italic">Partner</span>
                    <span className="text-emerald-500 font-black italic">ASD Scalamasino</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => alert("Scopo app: Tracciamento pulizia boulder Val Masino. Non distribuire a terzi.")}
                  className="w-full p-5 bg-stone-800 border border-stone-700 rounded-3xl text-white font-black uppercase tracking-widest italic flex items-center justify-between"
                >
                  Informazioni App <ExternalLink className="w-4 h-4 text-emerald-500" />
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full p-5 bg-stone-800 border border-stone-700 rounded-3xl text-red-500 font-black uppercase tracking-widest italic flex items-center justify-between"
                >
                  Esci dall'Account <LogIn className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="text-center mt-auto pt-8 border-t border-stone-800/50">
               <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest italic mb-2">Created by Alessandro Sangiorgio for ASD Scalamasino</p>
               <p className="text-[8px] font-black text-stone-800 uppercase tracking-widest">Boulder Tracker v1.2</p>
            </div>
          </div>
        );

      case 'admin':
        return profile.role === 'admin' ? (
          <UserManagement onClose={() => { setCurrentView('list'); setActiveTab('home'); }} />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={(tab) => {
        if (tab === 'admin' && profile?.role !== 'admin') {
          setActiveTab('home');
          setCurrentView('list');
          return;
        }
        
        setActiveTab(tab);
        if (tab === 'home') {
          setCurrentView('list');
        } else if (tab === 'admin') {
          setCurrentView('admin');
        } else {
          setCurrentView(tab);
        }
      }}
      onAddClick={() => {
        if (profile) {
          setEditingBlock(null);
          setCurrentView('form');
        }
      }}
      isAdmin={profile?.role === 'admin'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="h-full"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
