import { SearchWordsService } from '../../application/search-words';
import { createServerSupabaseClient } from '../../../../shared/infrastructure/supabase/server-client';
import {
    SupabaseWordCatalogQueryGateway,
    type SupabaseWordCatalogQueryClient,
} from '../supabase/supabase-word-catalog-query-gateway';

export interface ServerWordCatalogServices {
    searchWordsService: SearchWordsService;
}

/** 서버 단어 검색 기능에서 사용할 요청 단위 애플리케이션 서비스를 조합한다. */
export const createServerWordCatalogServices = async (): Promise<ServerWordCatalogServices> => {
    const client = await createServerSupabaseClient();

    return {
        searchWordsService: new SearchWordsService(new SupabaseWordCatalogQueryGateway(
            client as unknown as SupabaseWordCatalogQueryClient,
        )),
    };
};
