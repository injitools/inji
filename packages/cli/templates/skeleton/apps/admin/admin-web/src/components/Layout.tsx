import {NavLink, Outlet, useNavigate} from "react-router-dom";
import {Newspaper, Users, LogOut} from "lucide-react";

import {useAuth} from "@/auth";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";

const nav = [
    {to: "/news", label: "News", icon: Newspaper},
    {to: "/users", label: "Users", icon: Users},
];

export function Layout() {
    const {user, logout} = useAuth();
    const navigate = useNavigate();

    const onLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="bg-background flex min-h-screen">
            <aside className="bg-sidebar text-sidebar-foreground flex w-60 flex-col border-r p-4">
                <div className="px-2 py-3 text-lg font-semibold">__PROJECT_NAME__</div>
                <nav className="mt-4 flex flex-1 flex-col gap-1">
                    {nav.map(({to, label, icon: Icon}) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({isActive}) =>
                                cn(
                                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-muted-foreground hover:bg-sidebar-accent/60",
                                )
                            }
                        >
                            <Icon className="size-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="border-t pt-3">
                    <div className="text-muted-foreground px-3 pb-2 text-xs">{user?.name}</div>
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onLogout}>
                        <LogOut className="size-4" />
                        Sign out
                    </Button>
                </div>
            </aside>
            <main className="flex-1 p-8">
                <Outlet />
            </main>
        </div>
    );
}
