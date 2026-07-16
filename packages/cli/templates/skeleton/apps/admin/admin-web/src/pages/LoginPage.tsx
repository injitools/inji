import {useState, type FormEvent} from "react";
import {useNavigate} from "react-router-dom";
import {toast} from "sonner";

import {useAuth} from "@/auth";
import {ApiError} from "@/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Card, CardHeader, CardTitle, CardDescription, CardContent} from "@/components/ui/card";

export function LoginPage() {
    const {login} = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({login: "admin", password: ""});
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const user = await login(form.login, form.password);
            if (user.role !== "admin") {
                toast.error("Administrators only");
                return;
            }
            navigate("/news");
        } catch (err) {
            const msg = err instanceof ApiError
                ? (err.body?.message ?? "Failed to sign in")
                : "Network unavailable";
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Admin sign in</CardTitle>
                    <CardDescription>__PROJECT_NAME__</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={submit}>
                        <div className="grid gap-2">
                            <Label htmlFor="login">Login</Label>
                            <Input id="login" value={form.login} autoComplete="username"
                                   onChange={e => setForm({...form, login: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={form.password} autoComplete="current-password"
                                   onChange={e => setForm({...form, password: e.target.value})} />
                        </div>
                        <Button type="submit" disabled={busy}>{busy ? "…" : "Sign in"}</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
