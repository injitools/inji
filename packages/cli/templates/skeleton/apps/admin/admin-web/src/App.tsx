import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";

import {AuthProvider} from "./auth";
import {ProtectedRoute} from "@/components/ProtectedRoute";
import {Layout} from "@/components/Layout";
import {Toaster} from "@/components/ui/sonner";
import {LoginPage} from "@/pages/LoginPage";
import {UsersPage} from "@/pages/UsersPage";
import {NewsListPage} from "@/pages/NewsListPage";
import {NewsEditPage} from "@/pages/NewsEditPage";

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/" element={<Navigate to="/news" replace />} />
                        <Route path="/news" element={<NewsListPage />} />
                        <Route path="/news/new" element={<NewsEditPage />} />
                        <Route path="/news/:id/edit" element={<NewsEditPage />} />
                        <Route path="/users" element={<UsersPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/news" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster />
        </AuthProvider>
    );
}
