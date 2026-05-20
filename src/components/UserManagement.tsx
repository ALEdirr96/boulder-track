import React, { useState } from 'react';
import { User as UserIcon, Plus, Trash2, Mail, Shield, X, Loader2, Camera, Lock, Check, Ban, UserX, UserCheck, Clock, KeyRound, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';

interface UserManagementProps {
  onClose: () => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  const message = error instanceof Error ? error.message : String(error);
  alert(`Errore (${operationType}): ${message}`);
  throw new Error(JSON.stringify(errInfo));
};

export const UserManagement: React.FC<UserManagementProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  
  // Security confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<{type: 'single' | 'bulk', uid?: string, name?: string} | null>(null);
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const [reAuthError, setReAuthError] = useState<string | null>(null);
  
  const currentAuth = getAuth();
  const isSuperAdmin = currentUserEmail?.trim().toLowerCase() === 'asdadmin@scalamasino.com' || 
                      currentUserEmail?.trim().toLowerCase() === 'videoclipalessandrosangiorgio@gmail.com';
  
  React.useEffect(() => {
    const authUnsubscribe = currentAuth.onAuthStateChanged((user) => {
      setCurrentUserEmail(user?.email || null);
    });

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      unsubUsers();
    };
  }, []);

  const handleUpdateStatus = async (uid: string, status: 'active' | 'pending' | 'blocked') => {
    setUpdatingUid(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleToggleRole = async (uid: string, currentRole: 'admin' | 'user') => {
    if (uid === currentAuth.currentUser?.uid) {
      alert("Non puoi cambiare il tuo stesso ruolo.");
      return;
    }
    setUpdatingUid(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { 
        role: currentRole === 'admin' ? 'user' : 'admin' 
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleDeleteUser = (uid: string, name: string) => {
    if (uid === currentAuth.currentUser?.uid) {
      alert("Non puoi eliminare il tuo stesso account.");
      return;
    }
    setConfirmingAction({ type: 'single', uid, name });
    setConfirmPassword('');
    setReAuthError(null);
    setShowConfirmModal(true);
  };

  const handleDeleteNonAdmins = () => {
    const nonAdmins = users.filter(u => u.role !== 'admin' && u.uid !== currentAuth.currentUser?.uid);
    if (nonAdmins.length === 0) {
      alert("Nessun utente non-admin da eliminare.");
      return;
    }
    setConfirmingAction({ type: 'bulk' });
    setConfirmPassword('');
    setReAuthError(null);
    setShowConfirmModal(true);
  };

  const executeConfirmedAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingAction || !currentAuth.currentUser || !currentAuth.currentUser.email) return;

    setReAuthLoading(true);
    setReAuthError(null);

    try {
      // 1. Re-authenticate to verify security clearance
      const credential = EmailAuthProvider.credential(currentAuth.currentUser.email, confirmPassword);
      await reauthenticateWithCredential(currentAuth.currentUser, credential);

      // 2. Execute deletion logic
      if (confirmingAction.type === 'single' && confirmingAction.uid) {
        setDeletingUid(confirmingAction.uid);
        await deleteDoc(doc(db, 'users', confirmingAction.uid));
      } else if (confirmingAction.type === 'bulk') {
        setLoading(true);
        const nonAdmins = users.filter(u => u.role !== 'admin' && u.uid !== currentAuth.currentUser?.uid);
        const deletePromises = nonAdmins.map(u => deleteDoc(doc(db, 'users', u.uid)));
        await Promise.all(deletePromises);
        alert(`${nonAdmins.length} utenti eliminati con successo.`);
      }

      // 3. Success cleanup
      setShowConfirmModal(false);
      setConfirmingAction(null);
      setConfirmPassword('');
    } catch (error: any) {
      console.error("Security Verification Failed:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setReAuthError("Password non corretta. Riprova.");
      } else {
        setReAuthError("Errore di verifica: " + error.message);
      }
    } finally {
      setReAuthLoading(false);
      setDeletingUid(null);
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'all') return true;
    return u.status === filter;
  }).sort((a, b) => {
    // Sort by status primarily (pending first)
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full bg-stone-100">
      <header className="p-6 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h2 className="text-xl font-black text-stone-900 uppercase italic">Gestione Team</h2>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Controllo Accessi ASD Scalamasino</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={handleDeleteNonAdmins}
              className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors flex items-center gap-2"
              title="Elimina tutti i non-admin"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Pulisci Team</span>
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-3 bg-stone-100 text-stone-500 rounded-2xl hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="p-4 border-b border-stone-200 bg-white/80 backdrop-blur-md flex gap-2 overflow-x-auto">
        {(['all', 'pending', 'active', 'blocked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              filter === f ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 hover:text-stone-600'
            }`}
          >
            {f === 'all' ? 'Tutti' : f === 'pending' ? 'In Attesa' : f === 'active' ? 'Attivi' : 'Bloccati'}
            {users.filter(u => u.status === f).length > 0 && ` (${users.filter(u => u.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Caricamento membri...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 text-stone-400 uppercase font-black text-[10px] tracking-widest">
            Nessun membro trovato con questo filtro
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.uid} className="bg-white border-2 border-stone-100 rounded-[2rem] overflow-hidden shadow-sm hover:border-stone-200 transition-all">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center overflow-hidden border border-stone-100 shadow-inner">
                      {user.photoURL ? (
                        <img src={user.photoURL} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-stone-300" />
                      )}
                    </div>
                    {user.status === 'active' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-white shadow-sm"><Check className="w-3 h-3 text-white" /></div>}
                    {user.status === 'pending' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-lg flex items-center justify-center border-2 border-white shadow-sm"><Clock className="w-3 h-3 text-white" /></div>}
                    {user.status === 'blocked' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-lg flex items-center justify-center border-2 border-white shadow-sm"><UserX className="w-3 h-3 text-white" /></div>}
                  </div>
                  <div>
                    <div className="font-black text-stone-900 flex items-center gap-2">
                      {user.displayName}
                      {user.role === 'admin' && <Shield className="w-3 h-3 text-emerald-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">{user.email}</div>
                    <div className={`text-[8px] font-black uppercase tracking-widest mt-1 ${
                      user.status === 'active' ? 'text-emerald-500' : user.status === 'pending' ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {user.status === 'active' ? 'Account Abilitato' : user.status === 'pending' ? 'Richiesta di Accesso' : 'Accesso Negato'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(user.uid, 'active')}
                      disabled={updatingUid === user.uid}
                      className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      title="Approva Membro"
                    >
                      {updatingUid === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                    </button>
                  )}

                  {user.status === 'active' && user.uid !== currentAuth.currentUser?.uid && (
                    <button
                      onClick={() => handleUpdateStatus(user.uid, 'blocked')}
                      disabled={updatingUid === user.uid}
                      className="p-3 bg-stone-100 text-stone-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                      title="Blocca Accesso"
                    >
                      {updatingUid === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ban className="w-5 h-5" />}
                    </button>
                  )}

                  {user.status === 'blocked' && (
                    <button
                      onClick={() => handleUpdateStatus(user.uid, 'active')}
                      disabled={updatingUid === user.uid}
                      className="p-3 bg-stone-100 text-stone-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-500 transition-all disabled:opacity-50"
                      title="Riabilita Accesso"
                    >
                      {updatingUid === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                    </button>
                  )}

                  {user.uid !== currentAuth.currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteUser(user.uid, user.displayName)}
                      disabled={deletingUid === user.uid}
                      className="p-3 bg-stone-100 text-stone-400 rounded-2xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                      title="Elimina Definitivamente"
                    >
                      {deletingUid === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Advanced Actions for Super Admin */}
              {isSuperAdmin && user.status === 'active' && user.uid !== currentAuth.currentUser?.uid && (
                <div className="px-5 pb-5 pt-0 flex gap-2">
                  <button
                    onClick={() => handleToggleRole(user.uid, user.role)}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                      user.role === 'admin' 
                        ? 'bg-emerald-500 text-white border-emerald-500' 
                        : 'bg-white text-stone-400 border-stone-100 hover:border-stone-200'
                    }`}
                  >
                    {user.role === 'admin' ? 'Privilegi Admin: SI' : 'Promuovi ad Admin'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="p-6 bg-stone-900 text-white flex flex-col gap-1 items-center text-center">
        <Shield className="w-4 h-4 text-emerald-500 mb-1" />
        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed italic">
          Partner ASD Scalamasino Member Cloud
        </p>
        <span className="text-[8px] text-stone-500 uppercase font-black">Supervisore: {currentAuth.currentUser?.email}</span>
      </div>

      {/* Security Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-black text-stone-900 uppercase italic mb-2">Conferma Sicurezza</h3>
            <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-6">
              {confirmingAction?.type === 'bulk' 
                ? "Stai eliminando TUTTI i membri non-amministratori. Inserisci la tua password per confermare."
                : `Stai eliminando definitamente ${confirmingAction?.name}. Inserisci la tua password per confermare.`
              }
            </p>

            <form onSubmit={executeConfirmedAction} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  placeholder="La tua password admin"
                  required
                  autoFocus
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl text-sm outline-none focus:border-red-500/50 transition-all font-bold"
                />
              </div>

              {reAuthError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 italic">
                  {reAuthError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmingAction(null);
                  }}
                  className="py-4 bg-stone-100 text-stone-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={reAuthLoading || !confirmPassword}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {reAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Elimina Ora"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
