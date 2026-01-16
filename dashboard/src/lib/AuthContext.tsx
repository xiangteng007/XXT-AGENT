'use client';

/**
 * AuthContext wrapper - re-exports from components/auth-context
 * with additional helpers
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigValid } from '@/lib/firebase-client';

interface AdminInfo {
    uid: string;
    role: 'owner' | 'admin' | 'viewer';
    enabled: boolean;
    email: string;
    allowTenants?: string[];
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isConfigured: boolean;
    adminInfo: AdminInfo | null;
    isOwner: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    getIdToken: () => Promise<string | null>;
    setAdminInfo: (info: AdminInfo | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

    useEffect(() => {
        // Skip auth subscription if Firebase is not configured
        if (!auth || !isFirebaseConfigValid) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
            if (!user) {
                setAdminInfo(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (!auth || !googleProvider) {
            console.warn('Firebase auth not configured');
            return;
        }
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    };

    const logout = async () => {
        if (!auth) {
            console.warn('Firebase auth not configured');
            return;
        }
        try {
            await firebaseSignOut(auth);
            setAdminInfo(null);
        } catch (error) {
            console.error('Sign-out error:', error);
            throw error;
        }
    };

    const getIdToken = async (): Promise<string | null> => {
        if (!user) return null;
        return user.getIdToken();
    };

    const isOwner = adminInfo?.role === 'owner';
    const isAdmin = adminInfo?.role === 'owner' || adminInfo?.role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isConfigured: isFirebaseConfigValid,
            adminInfo,
            isOwner,
            isAdmin,
            signInWithGoogle,
            logout,
            getIdToken,
            setAdminInfo,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthProvider;
