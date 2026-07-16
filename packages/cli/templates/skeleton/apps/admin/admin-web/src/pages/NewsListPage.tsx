import {useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {toast} from "sonner";
import {Plus, Pencil, Trash2} from "lucide-react";

import {newsApi} from "@/api";
import type {NewsDto} from "@/api/schema.gen";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@/components/ui/table";

export function NewsListPage() {
    const [news, setNews] = useState<NewsDto[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        newsApi.list({})
            .then(setNews)
            .catch(() => toast.error("Failed to load news"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const remove = async (id: string) => {
        if (!confirm("Delete this news item?")) return;
        try {
            await newsApi.remove(id);
            toast.success("News item deleted");
            load();
        } catch {
            toast.error("Failed to delete");
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">News</h1>
                <Button asChild>
                    <Link to="/news/new">
                        <Plus className="size-4" />
                        Create
                    </Link>
                </Button>
            </div>
            {loading ? (
                <p className="text-muted-foreground">Loading…</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {news.map(n => (
                            <TableRow key={n.id}>
                                <TableCell className="font-medium">{n.title}</TableCell>
                                <TableCell>
                                    {n.published ? (
                                        <Badge variant="default">published</Badge>
                                    ) : n.publish_at ? (
                                        <Badge variant="secondary" title={new Date(n.publish_at).toLocaleString("en-US")}>
                                            scheduled
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">draft</Badge>
                                    )}
                                </TableCell>
                                <TableCell>{n.author ?? "—"}</TableCell>
                                <TableCell>{new Date(n.updated_at).toLocaleDateString("en-US")}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button asChild variant="ghost" size="icon">
                                            <Link to={`/news/${n.id}/edit`} aria-label="Edit">
                                                <Pencil className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(n.id)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
