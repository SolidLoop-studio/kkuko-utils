import { GetWordDetailService } from '../../application/get-word-detail';
import { GetWordDownloadService } from '../../application/get-word-download';
import { GetWordStatisticsService } from '../../application/get-word-statistics';
import { GetWordCombinerCandidatesService } from '../../application/get-word-combiner-candidates';
import { SearchWordsService } from '../../application/search-words';
import { browserSupabaseClient } from '../../../../shared/infrastructure/supabase/browser-client';
import {
    SupabaseWordCatalogQueryGateway,
    type SupabaseWordCatalogQueryClient,
} from '../supabase/supabase-word-catalog-query-gateway';
import { SupabaseWordDetailQueryGateway } from './supabase-word-detail-query-gateway';
import { SupabaseWordDownloadQueryGateway } from './supabase-word-download-query-gateway';
import { SupabaseWordStatisticsQueryGateway } from './supabase-word-statistics-query-gateway';
import { SupabaseWordCombinerCandidateQueryGateway } from './supabase-word-combiner-candidate-query-gateway';

export interface BrowserWordCatalogServices {
    searchWordsService: SearchWordsService;
    wordDetailService: GetWordDetailService;
    wordDownloadService: GetWordDownloadService;
    wordStatisticsService: GetWordStatisticsService;
    wordCombinerCandidateService: GetWordCombinerCandidatesService;
}

/** 브라우저 단어 검색 기능에서 사용할 애플리케이션 서비스를 조합한다. */
export const createBrowserWordCatalogServices = (): BrowserWordCatalogServices => ({
    searchWordsService: new SearchWordsService(new SupabaseWordCatalogQueryGateway(
        browserSupabaseClient as unknown as SupabaseWordCatalogQueryClient,
    )),
    wordDetailService: new GetWordDetailService(new SupabaseWordDetailQueryGateway()),
    wordDownloadService: new GetWordDownloadService(new SupabaseWordDownloadQueryGateway()),
    wordStatisticsService: new GetWordStatisticsService(new SupabaseWordStatisticsQueryGateway()),
    wordCombinerCandidateService: new GetWordCombinerCandidatesService(
        new SupabaseWordCombinerCandidateQueryGateway(),
    ),
});
