import {useState, type FormEvent} from "react";
import {useNavigate, Link} from "react-router-dom";
import {toast} from "sonner";

import {useAuth} from "@/auth";
import {ApiError, isValidationErrorPayload} from "@/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Card, CardHeader, CardTitle, CardContent, CardFooter} from "@/components/ui/card";

export function RegisterPage() {
    const {register} = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({login: "", name: "", password: ""});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setBusy(true);
        try {
            await register(form.login, form.name, form.password);
            navigate("/");
        } catch (err) {
            if (err instanceof ApiError) {
                // validation payload: {fieldErrors, formErrors} — highlights form fields.
                if (isValidationErrorPayload(err.body?.payload)) {
                    setFieldErrors(err.body!.payload.fieldErrors);
                }
                toast.error(err.body?.message ?? "Failed to register");
            } else {
                toast.error("Network unavailable");
            }
        } finally {
            setBusy(false);
        }
    };

    const fieldError = (name: string) => fieldErrors[name]?.[0];

    return (
        <Card className="mx-auto mt-12 w-full max-w-sm">
            <CardHeader>
                <CardTitle>Sign up</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="flex flex-col gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <Label htmlFor="login">Login</Label>
                        <Input id="login" value={form.login} autoComplete="username"
                               onChange={e => setForm({...form, login: e.target.value})} />
                        {fieldError("login") && <span className="text-destructive text-xs">{fieldError("login")}</span>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={form.name} autoComplete="name"
                               onChange={e => setForm({...form, name: e.target.value})} />
                        {fieldError("name") && <span className="text-destructive text-xs">{fieldError("name")}</span>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" value={form.password} autoComplete="new-password"
                               onChange={e => setForm({...form, password: e.target.value})} />
                        {fieldError("password") && <span className="text-destructive text-xs">{fieldError("password")}</span>}
                    </div>
                    <Button type="submit" disabled={busy}>{busy ? "…" : "Create account"}</Button>
                </form>
            </CardContent>
            <CardFooter className="text-muted-foreground text-sm">
                <span>Already have an account?&nbsp;</span>
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
            </CardFooter>
        </Card>
    );
}
