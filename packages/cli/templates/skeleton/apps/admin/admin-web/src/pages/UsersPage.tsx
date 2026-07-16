import {useEffect, useState} from "react";
import {toast} from "sonner";

import {usersApi} from "@/api";
import type {UserDto} from "@/api/schema.gen";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@/components/ui/table";
import {Badge} from "@/components/ui/badge";

export function UsersPage() {
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        usersApi.list()
            .then(setUsers)
            .catch(() => toast.error("Failed to load users"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <h1 className="mb-6 text-2xl font-semibold">Users</h1>
            {loading ? (
                <p className="text-muted-foreground">Loading…</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Login</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.login}</TableCell>
                                <TableCell>{u.name}</TableCell>
                                <TableCell>
                                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                                </TableCell>
                                <TableCell>{new Date(u.created_at).toLocaleDateString("en-US")}</TableCell>
                                <TableCell>{u.last_seen ? new Date(u.last_seen).toLocaleString("en-US") : "—"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
