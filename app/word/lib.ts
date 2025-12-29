"use client";

import { SCM } from "@/lib/supabaseClient";

export const fetcher = async () => {
    const { data, error } = await SCM.get().allThemes();
    if (error) throw error;
    return data;
}
