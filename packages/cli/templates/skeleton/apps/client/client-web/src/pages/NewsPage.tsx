import {useEffect, useState} from "react";

import {newsApi} from "@/api";
import type {NewsDto} from "@/api/schema.gen";
import {Card, CardHeader, CardTitle, CardContent, CardFooter} from "@/components/ui/card";

export function NewsPage() {
    const [news, setNews] = useState<NewsDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        newsApi.list({published: true})
            .then(setNews)
            .catch(() => setError("Failed to load news"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p className="text-muted-foreground">Loading…</p>;
    if (error) return <p className="text-destructive">{error}</p>;
    if (news.length === 0) return <p className="text-muted-foreground">No news yet.</p>;

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">News</h1>
            {news.map(n => (
                <Card key={n.id}>
                    <CardHeader>
                        <CardTitle className="text-lg">{n.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap">{n.body}</p>
                    </CardContent>
                    <CardFooter className="text-muted-foreground text-sm">
                        {n.author ?? "—"} · {new Date(n.created_at).toLocaleDateString("ru-RU")}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
