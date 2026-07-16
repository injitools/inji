import {createContext, useContext, useEffect, useState, type ReactNode} from "react";

import {authApi, ApiError} from "./api";
import type {AuthUserDto} from "./api/schema.gen";

type AuthState = {
    user: AuthUserDto | null;
    loading: boolean;
    login: (login: string, password: string) => Promise<void>;
    register: (login: string, name: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
    const [user, setUser] = useState<AuthUserDto | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore the session from the cookie on load (401 = simply not logged in).
    useEffect(() => {
        authApi.me()
            .then(setUser)
            .catch((e) => {
                if (!(e instanceof ApiError)) console.error(e);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (login: string, password: string) => {
        setUser(await authApi.login({login, password}));
    };

    const register = async (login: string, name: string, password: string) => {
        setUser(await authApi.register({login, name, password}));
    };

    const logout = async () => {
        await authApi.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{user, loading, login, register, logout}}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
