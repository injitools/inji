import type {CSSProperties} from "react";
import {Toaster as Sonner, type ToasterProps} from "sonner";

// Notification toasts. The theme is hardcoded to dark (see index.html class="dark");
// if you like, wire up next-themes and pass the theme dynamically.
function Toaster(props: ToasterProps) {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                } as CSSProperties
            }
            {...props}
        />
    );
}

export {Toaster};
