import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

/** Merges class names (clsx) and collapses Tailwind conflicts (tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
