import { GetWordDetailService } from '../../application/get-word-detail';
import { SearchWordsService } from '../../application/search-words';
import { SupabaseWordCatalogQueryGateway } from './supabase-word-catalog-query-gateway';
import { SupabaseWordDetailQueryGateway } from './supabase-word-detail-query-gateway';

export interface BrowserWordCatalogServices {
    searchWordsService: SearchWordsService;
    wordDetailService: GetWordDetailService;
}

/** 브라우저 단어 검색 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserWordCatalogServices = (): BrowserWordCatalogServices => ({
    searchWordsService: new SearchWordsService(new SupabaseWordCatalogQueryGateway()),
    wordDetailService: new GetWordDetailService(new SupabaseWordDetailQueryGateway()),
});
