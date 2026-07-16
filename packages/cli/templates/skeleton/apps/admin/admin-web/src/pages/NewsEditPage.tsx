import {useEffect, useState, type FormEvent} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {toast} from "sonner";

import {newsApi, ApiError, isValidationErrorPayload} from "@/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent} from "@/components/ui/card";

// ISO (UTC) → value for <input type="datetime-local"> (local time, without seconds).
function isoToLocalInput(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewsEditPage() {
    const {id} = useParams();
    const editing = Boolean(id);
    const navigate = useNavigate();
    const [form, setForm] = useState({title: "", body: "", published: true, publish_at: ""});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(editing);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!id) return;
        newsApi.get(id)
            .then(n => setForm({title: n.title, body: n.body, published: n.published, publish_at: isoToLocalInput(n.publish_at)}))
            .catch(() => toast.error("News item not found"))
            .finally(() => setLoading(false));
    }, [id]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setFieldErrors({});
        // datetime-local → ISO (UTC). Empty — no schedule (we omit publish_at).
        const payload = {
            title: form.title,
            body: form.body,
            published: form.published,
            publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : undefined,
        };
        try {
            if (editing && id) {
                await newsApi.update(id, payload);
            } else {
                await newsApi.create(payload);
            }
            toast.success(editing ? "Saved" : "News item created");
            navigate("/news");
        } catch (err) {
            if (err instanceof ApiError) {
                if (isValidationErrorPayload(err.body?.payload)) {
                    setFieldErrors(err.body!.payload.fieldErrors);
                }
                toast.error(err.body?.message ?? "Failed to save");
            } else {
                toast.error("Network unavailable");
            }
        } finally {
            setBusy(false);
        }
    };

    const fieldError = (k: string) => fieldErrors[k]?.[0];

    if (loading) return <p className="text-muted-foreground">Loading…</p>;

    return (
        <div className="max-w-2xl">
            <h1 className="mb-6 text-2xl font-semibold">{editing ? "Edit news item" : "New news item"}</h1>
            <Card>
                <CardContent>
                    <form className="flex flex-col gap-4" onSubmit={submit}>
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={form.title}
                                   onChange={e => setForm({...form, title: e.target.value})} />
                            {fieldError("title") && <span className="text-destructive text-xs">{fieldError("title")}</span>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" rows={8} value={form.body}
                                      onChange={e => setForm({...form, body: e.target.value})} />
                            {fieldError("body") && <span className="text-destructive text-xs">{fieldError("body")}</span>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="publish_at">Publish at (optional)</Label>
                            <Input id="publish_at" type="datetime-local" value={form.publish_at}
                                   onChange={e => setForm({...form, publish_at: e.target.value})} />
                            <span className="text-muted-foreground text-xs">
                                A future date → the draft is published by the publisher worker on schedule.
                            </span>
                            {fieldError("publish_at") && <span className="text-destructive text-xs">{fieldError("publish_at")}</span>}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.published}
                                   onChange={e => setForm({...form, published: e.target.checked})} />
                            Published
                        </label>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={busy}>{busy ? "…" : "Save"}</Button>
                            <Button type="button" variant="outline" onClick={() => navigate("/news")}>Cancel</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
