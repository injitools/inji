import {createContext, useContext, useEffect, useState, type ReactNode} from "react";

import {authApi, ApiError} from "./api";
import type {AuthUserDto} from "./api/schema.gen";

type AuthState = {
    user: AuthUserDto | null;
    loading: boolean;
    login: (login: string, password: string) => Promise<AuthUserDto>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
    const [user, setUser] = useState<AuthUserDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authApi.me()
            .then(setUser)
            .catch((e) => {
                if (!(e instanceof ApiError)) console.error(e);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (login: string, password: string) => {
        const u = await authApi.login({login, password});
        setUser(u);
        return u;
    };

    const logout = async () => {
        await authApi.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{user, loading, login, logout}}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}
