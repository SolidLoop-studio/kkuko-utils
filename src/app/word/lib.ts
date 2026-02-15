"use client";

import { SCM } from "@/src/app/lib/supabaseClient";

export const fetcher = async () => {
    const { data, error } = await SCM.get().allThemes();
    if (error) throw error;
    return data;
}
