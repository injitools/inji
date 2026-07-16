import type {ReactNode} from "react";
import {Navigate} from "react-router-dom";

import {useAuth} from "@/auth";

/** Allows only a signed-in admin through; otherwise redirects to /login. */
export function ProtectedRoute({children}: {children: ReactNode}) {
    const {user, loading} = useAuth();

    if (loading) {
        return <div className="text-muted-foreground p-8">Loading…</div>;
    }
    if (!user || user.role !== "admin") {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}
