import {useState, type FormEvent} from "react";
import {useNavigate, Link} from "react-router-dom";
import {toast} from "sonner";

import {useAuth} from "@/auth";
import {ApiError} from "@/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Card, CardHeader, CardTitle, CardContent, CardFooter} from "@/components/ui/card";

export function LoginPage() {
    const {login} = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({login: "", password: ""});
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await login(form.login, form.password);
            navigate("/");
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
        <Card className="mx-auto mt-12 w-full max-w-sm">
            <CardHeader>
                <CardTitle>Sign in</CardTitle>
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
            <CardFooter className="text-muted-foreground text-sm">
                <span>No account yet?&nbsp;</span>
                <Link to="/register" className="text-primary underline-offset-4 hover:underline">Sign up</Link>
            </CardFooter>
        </Card>
    );
}
