import {BrowserRouter, Routes, Route, Link, Navigate} from "react-router-dom";

import {AuthProvider, useAuth} from "./auth";
import {Button} from "@/components/ui/button";
import {Toaster} from "@/components/ui/sonner";
import {LoginPage} from "@/pages/LoginPage";
import {RegisterPage} from "@/pages/RegisterPage";
import {NewsPage} from "@/pages/NewsPage";

function Header() {
    const {user, logout} = useAuth();
    return (
        <header className="border-border bg-card flex items-center justify-between border-b px-6 py-3.5">
            <Link to="/" className="text-lg font-bold">__PROJECT_NAME__</Link>
            <nav className="flex items-center gap-3">
                {user ? (
                    <>
                        <span className="text-muted-foreground text-sm">Hi, {user.name}</span>
                        <Button variant="outline" size="sm" onClick={() => logout()}>Sign out</Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/login">Sign in</Link>
                        </Button>
                        <Button size="sm" asChild>
                            <Link to="/register">Sign up</Link>
                        </Button>
                    </>
                )}
            </nav>
        </header>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Header />
                <main className="mx-auto max-w-3xl px-6 py-8">
                    <Routes>
                        <Route path="/" element={<NewsPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </BrowserRouter>
            <Toaster />
        </AuthProvider>
    );
}
