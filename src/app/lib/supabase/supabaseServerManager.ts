import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from '../../types/database.types';
import { GitHubRelease } from "@/src/app/types/program";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

class SupabaseServerManager {
    constructor(private readonly supabase: SupabaseClient<Database>) { }

    public async getPrograms(category: 'all' | 'tool' | 'util' | 'other') {
        let q = this.supabase.from('programs').select('*')
        if (category !== 'all') {
            q = q.eq('category', category);
        }
        return q;
    }

    public async getLatestInfoProgram(repo: string) {
        try {
            const res = await fetch(
                `https://api.github.com/repos/${repo}/releases/latest`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'kkuko-utils',
                        ...(process.env.GITHUB_TOKEN && {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`
                        })
                    },
                    next: { revalidate: 300 } // 5분 캐시
                }
            );
            if (res.status === 200 && res.ok) {
                return { data: await res.json() as GitHubRelease, error: null }
            } else {
                return { data: null, error: res }
            }
        } catch (error) {
            if (error instanceof Error) {
                return { data: null, error }
            } else {
                return { data: null, error: null }
            }
        }
    }

    public async getGithubReleases(repo: string, page: number, per_page: number) {
        try {
            const res = await fetch(
                `https://api.github.com/repos/${repo}/releases?page=${page}&per_page=${per_page}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'kkuko-utils',
                        ...(process.env.GITHUB_TOKEN && {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`
                        })
                    },
                    next: { revalidate: 300 } // 5분 캐시
                }
            );
            if (res.status === 200 && res.ok) {
                return { data: await res.json() as GitHubRelease[], error: null }
            } else {
                return { data: null, error: res }
            }
        } catch (error) {
            if (error instanceof Error) {
                return { data: null, error }
            } else {
                return { data: null, error: null }
            }
        }
    }

    public async getProgramInfo(id: number) {
        const { data, error } = await this.supabase
            .from('programs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw new Error(`Supabase error: ${JSON.stringify(error)}`);
        }

        return { data, error: null };
    }
}

export const SSM = new SupabaseServerManager(supabase);
