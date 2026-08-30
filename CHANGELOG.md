# [v1.11.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.10.0...v1.11.0) - 2026-08-30

## fix
- ([c585e65](https://github.com/SolidLoop-studio/kkuko-utils/commit/c585e65)) - normalize item timestamp responses
- ([f839525](https://github.com/SolidLoop-studio/kkuko-utils/commit/f839525)) - separate list and modal queries
- ([f8fe976](https://github.com/SolidLoop-studio/kkuko-utils/commit/f8fe976)) - refresh profile favorites after update
- ([38874e4](https://github.com/SolidLoop-studio/kkuko-utils/commit/38874e4)) - 비로그인시 발생하는 무한루프 버그 수정
- ([6cc4b8b](https://github.com/SolidLoop-studio/kkuko-utils/commit/6cc4b8b)) - preserve server error status contract
- ([16a31dc](https://github.com/SolidLoop-studio/kkuko-utils/commit/16a31dc)) - harden boundary verification
- ([0b1f1bd](https://github.com/SolidLoop-studio/kkuko-utils/commit/0b1f1bd)) - reject malformed user list input
- ([d41eaa9](https://github.com/SolidLoop-studio/kkuko-utils/commit/d41eaa9)) - satisfy public request boundary test
- ([8e6014a](https://github.com/SolidLoop-studio/kkuko-utils/commit/8e6014a)) - type theme query mocks
- ([4f3502f](https://github.com/SolidLoop-studio/kkuko-utils/commit/4f3502f)) - stabilize empty theme state
- ([6f0460b](https://github.com/SolidLoop-studio/kkuko-utils/commit/6f0460b)) - stabilize pagination and caches
- ([46fad37](https://github.com/SolidLoop-studio/kkuko-utils/commit/46fad37)) - preserve candidate semantics
- ([6ce8c8f](https://github.com/SolidLoop-studio/kkuko-utils/commit/6ce8c8f)) - validate release timestamps
- ([6385066](https://github.com/SolidLoop-studio/kkuko-utils/commit/6385066)) - stabilize public log pagination
- ([ab5c023](https://github.com/SolidLoop-studio/kkuko-utils/commit/ab5c023)) - propagate refreshed nickname cookies
- ([2dffb82](https://github.com/SolidLoop-studio/kkuko-utils/commit/2dffb82)) - bind browser fetch for nickname registration
- ([70e2c49](https://github.com/SolidLoop-studio/kkuko-utils/commit/70e2c49)) - harden profile summary boundaries
- ([1ab27b8](https://github.com/SolidLoop-studio/kkuko-utils/commit/1ab27b8)) - harden notification image storage
- ([73458c2](https://github.com/SolidLoop-studio/kkuko-utils/commit/73458c2)) - preserve semantic mission identity across docs
- ([d08fd2a](https://github.com/SolidLoop-studio/kkuko-utils/commit/d08fd2a)) - stabilize pending moderation request identity
- ([6a5059a](https://github.com/SolidLoop-studio/kkuko-utils/commit/6a5059a)) - harden notification detail requests
- ([ae04470](https://github.com/SolidLoop-studio/kkuko-utils/commit/ae04470)) - harden notification dismissal storage
- ([a3292ff](https://github.com/SolidLoop-studio/kkuko-utils/commit/a3292ff)) - harden nickname registration route
- ([4dcefbf](https://github.com/SolidLoop-studio/kkuko-utils/commit/4dcefbf)) - harden identity auth lifecycle
- ([fcf0011](https://github.com/SolidLoop-studio/kkuko-utils/commit/fcf0011)) - harden direct word addition boundary
- ([e6fd334](https://github.com/SolidLoop-studio/kkuko-utils/commit/e6fd334)) - preserve pending queue on refetch failure
- ([d1f41f6](https://github.com/SolidLoop-studio/kkuko-utils/commit/d1f41f6)) - recognize remapped docs marker parents
- ([16da415](https://github.com/SolidLoop-studio/kkuko-utils/commit/16da415)) - harden docs favorite command boundary
- ([9f37ad1](https://github.com/SolidLoop-studio/kkuko-utils/commit/9f37ad1)) - harden docs application writes
- ([b6d2302](https://github.com/SolidLoop-studio/kkuko-utils/commit/b6d2302)) - harden docs request boundary
- ([6a7f3d7](https://github.com/SolidLoop-studio/kkuko-utils/commit/6a7f3d7)) - harden docs query refresh handling
- ([8763855](https://github.com/SolidLoop-studio/kkuko-utils/commit/8763855)) - harden docs content refresh lifecycle
- ([f91ed28](https://github.com/SolidLoop-studio/kkuko-utils/commit/f91ed28)) - preserve docs content refresh state
- ([29243cc](https://github.com/SolidLoop-studio/kkuko-utils/commit/29243cc)) - preserve missing letter docs count
- ([010507f](https://github.com/SolidLoop-studio/kkuko-utils/commit/010507f)) - name docs loading visibility flag
- ([8b3c1ee](https://github.com/SolidLoop-studio/kkuko-utils/commit/8b3c1ee)) - show docs query loading state
- ([814138a](https://github.com/SolidLoop-studio/kkuko-utils/commit/814138a)) - synchronize pending docs request cache
- ([0a6e0be](https://github.com/SolidLoop-studio/kkuko-utils/commit/0a6e0be)) - preserve advanced search filters
- ([72f8e39](https://github.com/SolidLoop-studio/kkuko-utils/commit/72f8e39)) - preserve advanced search options
- ([2dd0fb9](https://github.com/SolidLoop-studio/kkuko-utils/commit/2dd0fb9)) - preserve word detail count parity
- ([c419a21](https://github.com/SolidLoop-studio/kkuko-utils/commit/c419a21)) - guard word detail wiki link state
- ([f366d92](https://github.com/SolidLoop-studio/kkuko-utils/commit/f366d92)) - harden word detail query errors
- ([e0b00ff](https://github.com/SolidLoop-studio/kkuko-utils/commit/e0b00ff)) - document word detail query gateway
- ([39b7f81](https://github.com/SolidLoop-studio/kkuko-utils/commit/39b7f81)) - preserve unlimited word search limits
- ([6f9b7fd](https://github.com/SolidLoop-studio/kkuko-utils/commit/6f9b7fd)) - stabilize word theme request resolution
- ([1529c94](https://github.com/SolidLoop-studio/kkuko-utils/commit/1529c94)) - clarify admin word deletion
- ([d9af954](https://github.com/SolidLoop-studio/kkuko-utils/commit/d9af954)) - cover word info mutation boundaries
- ([54ad25f](https://github.com/SolidLoop-studio/kkuko-utils/commit/54ad25f)) - guard inherited theme request error codes
- ([9cfe776](https://github.com/SolidLoop-studio/kkuko-utils/commit/9cfe776)) - harden atomic word theme requests
- ([10fa9fe](https://github.com/SolidLoop-studio/kkuko-utils/commit/10fa9fe)) - sanitize inherited word request error keys
- ([230db6c](https://github.com/SolidLoop-studio/kkuko-utils/commit/230db6c)) - lock docs user word request actions
- ([17b04f1](https://github.com/SolidLoop-studio/kkuko-utils/commit/17b04f1)) - validate docs moderation response ids
- ([e5332f8](https://github.com/SolidLoop-studio/kkuko-utils/commit/e5332f8)) - address docs moderation final review
- ([a940167](https://github.com/SolidLoop-studio/kkuko-utils/commit/a940167)) - stabilize docs word moderation transitions
- ([69327be](https://github.com/SolidLoop-studio/kkuko-utils/commit/69327be)) - guard docs moderation actions
- ([a1d4a8d](https://github.com/SolidLoop-studio/kkuko-utils/commit/a1d4a8d)) - sanitize unexpected direct deletion errors
- ([7b172ed](https://github.com/SolidLoop-studio/kkuko-utils/commit/7b172ed)) - correct word request moderation boundaries
- ([32d0530](https://github.com/SolidLoop-studio/kkuko-utils/commit/32d0530)) - preserve word request moderation attribution
- ([427608a](https://github.com/SolidLoop-studio/kkuko-utils/commit/427608a)) - validate word moderation command payloads
- ([1d0a9b2](https://github.com/SolidLoop-studio/kkuko-utils/commit/1d0a9b2)) - limit affected deletion documents
- ([f88ce31](https://github.com/SolidLoop-studio/kkuko-utils/commit/f88ce31)) - restore deletion dialog focus
- ([f01d1a6](https://github.com/SolidLoop-studio/kkuko-utils/commit/f01d1a6)) - lock deletion dialogs while active
- ([3a1b5ea](https://github.com/SolidLoop-studio/kkuko-utils/commit/3a1b5ea)) - keep deletion jobs resumable
- ([ae79f5a](https://github.com/SolidLoop-studio/kkuko-utils/commit/ae79f5a)) - preserve requests for undeleted words
- ([51d433d](https://github.com/SolidLoop-studio/kkuko-utils/commit/51d433d)) - harden word approval batch search path
- ([92a246f](https://github.com/SolidLoop-studio/kkuko-utils/commit/92a246f)) - harden resumable word approval recovery
- ([c65201e](https://github.com/SolidLoop-studio/kkuko-utils/commit/c65201e)) - harden word approval UI state
- ([64855f4](https://github.com/SolidLoop-studio/kkuko-utils/commit/64855f4)) - expose word approval query errors
- ([b8d0778](https://github.com/SolidLoop-studio/kkuko-utils/commit/b8d0778)) - harden word approval batch migration
- ([d7731f0](https://github.com/SolidLoop-studio/kkuko-utils/commit/d7731f0)) - verify word approval completion before cleanup
- ([7c817b3](https://github.com/SolidLoop-studio/kkuko-utils/commit/7c817b3)) - enforce application layer import boundary
- ([2147eb8](https://github.com/SolidLoop-studio/kkuko-utils/commit/2147eb8)) - term

## refactor
- ([334ce3f](https://github.com/SolidLoop-studio/kkuko-utils/commit/334ce3f)) - complete ddd-lite migration
- ([cf14cda](https://github.com/SolidLoop-studio/kkuko-utils/commit/cf14cda)) - replace server manager gateways
- ([3a315a0](https://github.com/SolidLoop-studio/kkuko-utils/commit/3a315a0)) - isolate authenticated gateway
- ([8fdeb53](https://github.com/SolidLoop-studio/kkuko-utils/commit/8fdeb53)) - isolate user list projection
- ([0b54ac4](https://github.com/SolidLoop-studio/kkuko-utils/commit/0b54ac4)) - isolate public request query
- ([c8d9c46](https://github.com/SolidLoop-studio/kkuko-utils/commit/c8d9c46)) - reuse catalog theme query
- ([e4c6564](https://github.com/SolidLoop-studio/kkuko-utils/commit/e4c6564)) - isolate count projection
- ([27a4390](https://github.com/SolidLoop-studio/kkuko-utils/commit/27a4390)) - use catalog query
- ([238474f](https://github.com/SolidLoop-studio/kkuko-utils/commit/238474f)) - isolate data gateways
- ([99bcfcd](https://github.com/SolidLoop-studio/kkuko-utils/commit/99bcfcd)) - migrate public log query
- ([7413422](https://github.com/SolidLoop-studio/kkuko-utils/commit/7413422)) - migrate selected deletion
- ([b38bab1](https://github.com/SolidLoop-studio/kkuko-utils/commit/b38bab1)) - migrate filters and pagination
- ([35a82c4](https://github.com/SolidLoop-studio/kkuko-utils/commit/35a82c4)) - migrate profile summary query
- ([2b31123](https://github.com/SolidLoop-studio/kkuko-utils/commit/2b31123)) - migrate profile nickname search query
- ([274852f](https://github.com/SolidLoop-studio/kkuko-utils/commit/274852f)) - retire legacy notification write storage
- ([18b776d](https://github.com/SolidLoop-studio/kkuko-utils/commit/18b776d)) - clarify notification cleanup candidate
- ([a0e354f](https://github.com/SolidLoop-studio/kkuko-utils/commit/a0e354f)) - complete notification delete image cleanup
- ([42ff32d](https://github.com/SolidLoop-studio/kkuko-utils/commit/42ff32d)) - migrate notification write form
- ([0072064](https://github.com/SolidLoop-studio/kkuko-utils/commit/0072064)) - migrate notification delete command
- ([ff612b2](https://github.com/SolidLoop-studio/kkuko-utils/commit/ff612b2)) - complete semantic mission child docs query
- ([7cbf456](https://github.com/SolidLoop-studio/kkuko-utils/commit/7cbf456)) - route mission child docs semantically
- ([a5b0a4a](https://github.com/SolidLoop-studio/kkuko-utils/commit/a5b0a4a)) - share docs mission reference catalog
- ([5e45364](https://github.com/SolidLoop-studio/kkuko-utils/commit/5e45364)) - define semantic mission child references
- ([dec730e](https://github.com/SolidLoop-studio/kkuko-utils/commit/dec730e)) - migrate notification detail query
- ([b4d8bcd](https://github.com/SolidLoop-studio/kkuko-utils/commit/b4d8bcd)) - migrate notification list query
- ([e4f9ab3](https://github.com/SolidLoop-studio/kkuko-utils/commit/e4f9ab3)) - migrate nickname registration boundary
- ([d31c5e7](https://github.com/SolidLoop-studio/kkuko-utils/commit/d31c5e7)) - separate identity auth boundary
- ([cfe8c2c](https://github.com/SolidLoop-studio/kkuko-utils/commit/cfe8c2c)) - make direct word addition atomic
- ([4c61f09](https://github.com/SolidLoop-studio/kkuko-utils/commit/4c61f09)) - migrate pending word moderation query
- ([f5d335d](https://github.com/SolidLoop-studio/kkuko-utils/commit/f5d335d)) - reuse catalog theme query in moderation
- ([b27e91f](https://github.com/SolidLoop-studio/kkuko-utils/commit/b27e91f)) - migrate docs marker query boundary
- ([ac09444](https://github.com/SolidLoop-studio/kkuko-utils/commit/ac09444)) - migrate docs favorite command boundary
- ([f1b3596](https://github.com/SolidLoop-studio/kkuko-utils/commit/f1b3596)) - migrate docs view command boundary
- ([3a30725](https://github.com/SolidLoop-studio/kkuko-utils/commit/3a30725)) - migrate docs creation request boundary
- ([120625d](https://github.com/SolidLoop-studio/kkuko-utils/commit/120625d)) - resolve mission parents by semantic code
- ([2957760](https://github.com/SolidLoop-studio/kkuko-utils/commit/2957760)) - resolve mission docs by semantic code
- ([f250959](https://github.com/SolidLoop-studio/kkuko-utils/commit/f250959)) - resolve long-word docs by semantic code
- ([e757c23](https://github.com/SolidLoop-studio/kkuko-utils/commit/e757c23)) - migrate docs content query
- ([b26f5c2](https://github.com/SolidLoop-studio/kkuko-utils/commit/b26f5c2)) - migrate docs info query
- ([02bc974](https://github.com/SolidLoop-studio/kkuko-utils/commit/02bc974)) - migrate docs log query
- ([2cfa07b](https://github.com/SolidLoop-studio/kkuko-utils/commit/2cfa07b)) - migrate docs list query
- ([4109af4](https://github.com/SolidLoop-studio/kkuko-utils/commit/4109af4)) - migrate docs request duplicate query
- ([531b4d4](https://github.com/SolidLoop-studio/kkuko-utils/commit/531b4d4)) - migrate pending docs request query
- ([8863eec](https://github.com/SolidLoop-studio/kkuko-utils/commit/8863eec)) - migrate word statistics to word catalog
- ([83d870e](https://github.com/SolidLoop-studio/kkuko-utils/commit/83d870e)) - add word statistics query service
- ([ef00abd](https://github.com/SolidLoop-studio/kkuko-utils/commit/ef00abd)) - migrate word downloads to word catalog
- ([9c14e4f](https://github.com/SolidLoop-studio/kkuko-utils/commit/9c14e4f)) - add word download query service
- ([5b494bc](https://github.com/SolidLoop-studio/kkuko-utils/commit/5b494bc)) - retire legacy advanced word search
- ([ca4db5b](https://github.com/SolidLoop-studio/kkuko-utils/commit/ca4db5b)) - migrate advanced word search route
- ([69bd7c0](https://github.com/SolidLoop-studio/kkuko-utils/commit/69bd7c0)) - retire legacy word detail queries
- ([427a58b](https://github.com/SolidLoop-studio/kkuko-utils/commit/427a58b)) - migrate word detail queries
- ([378d7b4](https://github.com/SolidLoop-studio/kkuko-utils/commit/378d7b4)) - retire legacy word suggestion query
- ([309dbaf](https://github.com/SolidLoop-studio/kkuko-utils/commit/309dbaf)) - migrate browser word search queries
- ([8e02ece](https://github.com/SolidLoop-studio/kkuko-utils/commit/8e02ece)) - remove migrated word info mutations
- ([67c96b9](https://github.com/SolidLoop-studio/kkuko-utils/commit/67c96b9)) - migrate word info mutations
- ([348faca](https://github.com/SolidLoop-studio/kkuko-utils/commit/348faca)) - migrate docs user word request actions
- ([1d16fdd](https://github.com/SolidLoop-studio/kkuko-utils/commit/1d16fdd)) - migrate docs request moderation actions
- ([e6ad890](https://github.com/SolidLoop-studio/kkuko-utils/commit/e6ad890)) - remove docs moderation legacy paths
- ([8c81b60](https://github.com/SolidLoop-studio/kkuko-utils/commit/8c81b60)) - migrate docs word moderation actions
- ([a4d742a](https://github.com/SolidLoop-studio/kkuko-utils/commit/a4d742a)) - migrate admin word request moderation
- ([012d603](https://github.com/SolidLoop-studio/kkuko-utils/commit/012d603)) - migrate bulk word deletion
- ([8a46f55](https://github.com/SolidLoop-studio/kkuko-utils/commit/8a46f55)) - remove replaced word approval queries
- ([94b52ef](https://github.com/SolidLoop-studio/kkuko-utils/commit/94b52ef)) - use resumable word approval workflow
- ([1cc481b](https://github.com/SolidLoop-studio/kkuko-utils/commit/1cc481b)) - extract word approval domain rules
- ([6ac775f](https://github.com/SolidLoop-studio/kkuko-utils/commit/6ac775f)) - add data access application boundary

## feat
- ([2dc12bb](https://github.com/SolidLoop-studio/kkuko-utils/commit/2dc12bb)) - add filtered page query
- ([d90ecca](https://github.com/SolidLoop-studio/kkuko-utils/commit/d90ecca)) - migrate initial projection
- ([593c098](https://github.com/SolidLoop-studio/kkuko-utils/commit/593c098)) - migrate profile nickname update
- ([829ead5](https://github.com/SolidLoop-studio/kkuko-utils/commit/829ead5)) - migrate profile processed activity query
- ([ed0e61a](https://github.com/SolidLoop-studio/kkuko-utils/commit/ed0e61a)) - migrate profile word request query
- ([0d291ce](https://github.com/SolidLoop-studio/kkuko-utils/commit/0d291ce)) - migrate profile favorite docs query
- ([a3ee7a5](https://github.com/SolidLoop-studio/kkuko-utils/commit/a3ee7a5)) - expose notification write hook
- ([a81c645](https://github.com/SolidLoop-studio/kkuko-utils/commit/a81c645)) - guard notification image cleanup
- ([ffa34d1](https://github.com/SolidLoop-studio/kkuko-utils/commit/ffa34d1)) - isolate notification image storage
- ([38846d5](https://github.com/SolidLoop-studio/kkuko-utils/commit/38846d5)) - add notification write gateway
- ([59290ab](https://github.com/SolidLoop-studio/kkuko-utils/commit/59290ab)) - define notification write cleanup policy
- ([3dc524a](https://github.com/SolidLoop-studio/kkuko-utils/commit/3dc524a)) - expose notification delete hook
- ([876819c](https://github.com/SolidLoop-studio/kkuko-utils/commit/876819c)) - add notification delete gateway
- ([e351ec4](https://github.com/SolidLoop-studio/kkuko-utils/commit/e351ec4)) - define notification delete command
- ([f579bd5](https://github.com/SolidLoop-studio/kkuko-utils/commit/f579bd5)) - add required docs reference resolver
- ([ffc4905](https://github.com/SolidLoop-studio/kkuko-utils/commit/ffc4905)) - add docs semantic reference codes
- ([d648f65](https://github.com/SolidLoop-studio/kkuko-utils/commit/d648f65)) - expose word detail query hooks
- ([e2f7d1c](https://github.com/SolidLoop-studio/kkuko-utils/commit/e2f7d1c)) - add connected word query service
- ([7c8b3d9](https://github.com/SolidLoop-studio/kkuko-utils/commit/7c8b3d9)) - map supabase word detail projection
- ([603fcd1](https://github.com/SolidLoop-studio/kkuko-utils/commit/603fcd1)) - define word detail query contract
- ([51b5e42](https://github.com/SolidLoop-studio/kkuko-utils/commit/51b5e42)) - add word catalog browser queries
- ([4c38c0c](https://github.com/SolidLoop-studio/kkuko-utils/commit/4c38c0c)) - define word catalog search queries
- ([5c572b4](https://github.com/SolidLoop-studio/kkuko-utils/commit/5c572b4)) - migrate user word addition requests
- ([e01ddaf](https://github.com/SolidLoop-studio/kkuko-utils/commit/e01ddaf)) - add word info mutation actions
- ([d0e29ee](https://github.com/SolidLoop-studio/kkuko-utils/commit/d0e29ee)) - add word theme request use case
- ([c5548c7](https://github.com/SolidLoop-studio/kkuko-utils/commit/c5548c7)) - add atomic word theme requests
- ([c481507](https://github.com/SolidLoop-studio/kkuko-utils/commit/c481507)) - add atomic user word request RPCs
- ([15e3ee5](https://github.com/SolidLoop-studio/kkuko-utils/commit/15e3ee5)) - add browser user word request services
- ([73e45ae](https://github.com/SolidLoop-studio/kkuko-utils/commit/73e45ae)) - add user word request application contract
- ([1d19beb](https://github.com/SolidLoop-studio/kkuko-utils/commit/1d19beb)) - add docs request moderation hook
- ([c3ab995](https://github.com/SolidLoop-studio/kkuko-utils/commit/c3ab995)) - add atomic docs request moderation
- ([bf52585](https://github.com/SolidLoop-studio/kkuko-utils/commit/bf52585)) - define docs request moderation contracts
- ([09d9ebe](https://github.com/SolidLoop-studio/kkuko-utils/commit/09d9ebe)) - add docs word moderation hook
- ([a4d5bc0](https://github.com/SolidLoop-studio/kkuko-utils/commit/a4d5bc0)) - connect direct word deletion gateway
- ([308357e](https://github.com/SolidLoop-studio/kkuko-utils/commit/308357e)) - add atomic direct word deletion
- ([9ea5abb](https://github.com/SolidLoop-studio/kkuko-utils/commit/9ea5abb)) - resolve docs word mutation targets
- ([e075553](https://github.com/SolidLoop-studio/kkuko-utils/commit/e075553)) - define docs word moderation contracts
- ([39674f4](https://github.com/SolidLoop-studio/kkuko-utils/commit/39674f4)) - add word request moderation hook
- ([537e77a](https://github.com/SolidLoop-studio/kkuko-utils/commit/537e77a)) - connect word request moderation RPCs
- ([f38a94b](https://github.com/SolidLoop-studio/kkuko-utils/commit/f38a94b)) - add atomic word request moderation RPCs
- ([b6b42de](https://github.com/SolidLoop-studio/kkuko-utils/commit/b6b42de)) - add word request moderation contracts
- ([9476dd2](https://github.com/SolidLoop-studio/kkuko-utils/commit/9476dd2)) - expose word deletion hook
- ([cc6bc25](https://github.com/SolidLoop-studio/kkuko-utils/commit/cc6bc25)) - connect word deletion infrastructure
- ([fe1c657](https://github.com/SolidLoop-studio/kkuko-utils/commit/fe1c657)) - add transactional word deletion RPC
- ([3d65b80](https://github.com/SolidLoop-studio/kkuko-utils/commit/3d65b80)) - orchestrate resumable word deletion
- ([d280522](https://github.com/SolidLoop-studio/kkuko-utils/commit/d280522)) - add word deletion domain
- ([0d709a7](https://github.com/SolidLoop-studio/kkuko-utils/commit/0d709a7)) - expose browser word approval workflow
- ([c8a10ed](https://github.com/SolidLoop-studio/kkuko-utils/commit/c8a10ed)) - connect word approval rpc gateway
- ([2e6dd54](https://github.com/SolidLoop-studio/kkuko-utils/commit/2e6dd54)) - add atomic word approval batch rpc
- ([54072ab](https://github.com/SolidLoop-studio/kkuko-utils/commit/54072ab)) - persist pending word approval jobs
- ([ecbd90f](https://github.com/SolidLoop-studio/kkuko-utils/commit/ecbd90f)) - orchestrate resumable word approval batches
- ([ce47ce5](https://github.com/SolidLoop-studio/kkuko-utils/commit/ce47ce5)) - define resumable word approval contracts

# [v1.10.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.9.1...v1.10.0) - 2026-08-19

## fix
- ([8888939](https://github.com/SolidLoop-studio/kkuko-utils/commit/8888939)) - 오픈 DB 일단 봉쇄
- ([9fbe67d](https://github.com/SolidLoop-studio/kkuko-utils/commit/9fbe67d)) - 대기 단어들 주제 목록 요청시 나오는 http400에러 수정
- ([338bfab](https://github.com/SolidLoop-studio/kkuko-utils/commit/338bfab)) - keep typing exit modal above game stats
- ([9996867](https://github.com/SolidLoop-studio/kkuko-utils/commit/9996867)) - measure active typing target character
- ([9b8443d](https://github.com/SolidLoop-studio/kkuko-utils/commit/9b8443d)) - 도움말, 설정 패널 문구 수정
- ([504e0f9](https://github.com/SolidLoop-studio/kkuko-utils/commit/504e0f9)) - refine typing practice experience
- ([a9dd814](https://github.com/SolidLoop-studio/kkuko-utils/commit/a9dd814)) - polish typing practice experience
- ([fadfc16](https://github.com/SolidLoop-studio/kkuko-utils/commit/fadfc16)) - gate typing practice hint commands
- ([93342df](https://github.com/SolidLoop-studio/kkuko-utils/commit/93342df)) - polish typing practice review edge cases
- ([bb7efea](https://github.com/SolidLoop-studio/kkuko-utils/commit/bb7efea)) - address typing practice final review
- ([399e609](https://github.com/SolidLoop-studio/kkuko-utils/commit/399e609)) - address typing practice review findings
- ([db03a03](https://github.com/SolidLoop-studio/kkuko-utils/commit/db03a03)) - block typing practice start errors
- ([e6dd620](https://github.com/SolidLoop-studio/kkuko-utils/commit/e6dd620)) - delay typing practice timer until words load
- ([2b506c7](https://github.com/SolidLoop-studio/kkuko-utils/commit/2b506c7)) - reset typing practice sessions
- ([151fb2a](https://github.com/SolidLoop-studio/kkuko-utils/commit/151fb2a)) - fix: 프로필 등록 요청 문구 추가
- ([497089c](https://github.com/SolidLoop-studio/kkuko-utils/commit/497089c)) - 서비스이용약관 업데이트
- ([a1f7cea](https://github.com/SolidLoop-studio/kkuko-utils/commit/a1f7cea)) - 자퀴 단어 검색에서 주제 선택 모달의 검색 부분의 오류 수정
- ([75cf457](https://github.com/SolidLoop-studio/kkuko-utils/commit/75cf457)) - 통일되지 않은 버튼 디자인 수정

## feat
- ([e376754](https://github.com/SolidLoop-studio/kkuko-utils/commit/e376754)) - integrate long-word typing feedback
- ([95967e7](https://github.com/SolidLoop-studio/kkuko-utils/commit/95967e7)) - add scrolling typing target viewport
- ([e444176](https://github.com/SolidLoop-studio/kkuko-utils/commit/e444176)) - calculate typing target viewport position
- ([f21140e](https://github.com/SolidLoop-studio/kkuko-utils/commit/f21140e)) - guard incomplete typing submissions
- ([e51ec6c](https://github.com/SolidLoop-studio/kkuko-utils/commit/e51ec6c)) - limit typing practice words to 100 characters
- ([4abec95](https://github.com/SolidLoop-studio/kkuko-utils/commit/4abec95)) - add typing practice mode
- ([2fc3030](https://github.com/SolidLoop-studio/kkuko-utils/commit/2fc3030)) - wire typing practice into mini game
- ([ed05809](https://github.com/SolidLoop-studio/kkuko-utils/commit/ed05809)) - add typing practice play screen
- ([5fd4773](https://github.com/SolidLoop-studio/kkuko-utils/commit/5fd4773)) - add typing practice session hook
- ([69d86e6](https://github.com/SolidLoop-studio/kkuko-utils/commit/69d86e6)) - add typing practice setup
- ([2bad01b](https://github.com/SolidLoop-studio/kkuko-utils/commit/2bad01b)) - add typing practice logic

# [v1.9.1](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.9.0...v1.9.1) - 2026-07-21

## fix
- ([151fb2a](https://github.com/SolidLoop-studio/kkuko-utils/commit/151fb2a)) - fix: 프로필 등록 요청 문구 추가
- ([497089c](https://github.com/SolidLoop-studio/kkuko-utils/commit/497089c)) - 서비스이용약관 업데이트
- ([a1f7cea](https://github.com/SolidLoop-studio/kkuko-utils/commit/a1f7cea)) - 자퀴 단어 검색에서 주제 선택 모달의 검색 부분의 오류 수정
- ([75cf457](https://github.com/SolidLoop-studio/kkuko-utils/commit/75cf457)) - 통일되지 않은 버튼 디자인 수정

# [v1.9.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.8.0...v1.9.0) - 2026-04-23

## fix
- ([8f7df2a](https://github.com/SolidLoop-studio/kkuko-utils/commit/8f7df2a)) - 삭제 요청시 완료모달의 텍스트가 잘못 표시되는 오류 수정
- ([a0ec593](https://github.com/SolidLoop-studio/kkuko-utils/commit/a0ec593)) - 단어 조합기 단어 표시 로직 수정
- ([42fbe54](https://github.com/SolidLoop-studio/kkuko-utils/commit/42fbe54)) - 오탈자 수정
- ([2da272a](https://github.com/SolidLoop-studio/kkuko-utils/commit/2da272a)) - 관리자 페이지로 이동안됨 수정

## feat
- ([971bba6](https://github.com/SolidLoop-studio/kkuko-utils/commit/971bba6)) - 특정 글자가 포함된 단어 추출 추가
- ([7e32b56](https://github.com/SolidLoop-studio/kkuko-utils/commit/7e32b56)) - 깃허브 릴리즈 확인 기능 추가

# [v1.8.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.7.2...v1.8.0) - 2026-04-21

## fix
- ([f4098f7](https://github.com/SolidLoop-studio/kkuko-utils/commit/f4098f7)) - 닉네임 색 추가 반영
- ([ee34736](https://github.com/SolidLoop-studio/kkuko-utils/commit/ee34736)) - 프로필 이미지 버그 수정, 간단한 시인성 수정
- ([f85a684](https://github.com/SolidLoop-studio/kkuko-utils/commit/f85a684)) - 권한 상승 취약점 패치

## feat
- ([ed12b1c](https://github.com/SolidLoop-studio/kkuko-utils/commit/ed12b1c)) - 아바타 이미지 다운로드 추가

# [v1.7.2](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.7.1...v1.7.2) - 2026-03-16

## fix
- ([f2ea0c3](https://github.com/SolidLoop-studio/kkuko-utils/commit/f2ea0c3)) - 이미 호출은 CF 워커 사용
- ([aba630e](https://github.com/SolidLoop-studio/kkuko-utils/commit/aba630e)) - 끄코 프로필 랭킹 데이터 캐싱
- ([9d213b5](https://github.com/SolidLoop-studio/kkuko-utils/commit/9d213b5)) - 프로필 온라인 정보 제거
- ([fd7017e](https://github.com/SolidLoop-studio/kkuko-utils/commit/fd7017e)) - 이미지 로드 수정

# [v1.7.1](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.7.0...v1.7.1) - 2026-03-02

## fix
- ([fed4dd1](https://github.com/SolidLoop-studio/kkuko-utils/commit/fed4dd1)) - 이미지 캐싱시간 수정
- ([b4ec430](https://github.com/SolidLoop-studio/kkuko-utils/commit/b4ec430)) - 테스트
- ([fc0894d](https://github.com/SolidLoop-studio/kkuko-utils/commit/fc0894d)) - 개같은 에러수정시도

# [v1.7.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.6.3...v1.7.0) - 2026-02-21

## fix
- ([23391d8](https://github.com/SolidLoop-studio/kkuko-utils/commit/23391d8)) - 값이 문자열로된 옵션 처리 추가
- ([bd59a6c](https://github.com/SolidLoop-studio/kkuko-utils/commit/bd59a6c)) - 알려진 옵션만 표시
- ([b634676](https://github.com/SolidLoop-studio/kkuko-utils/commit/b634676)) - 이미지 패칭 url 수정
- ([f1fab4a](https://github.com/SolidLoop-studio/kkuko-utils/commit/f1fab4a)) - 두음법칙이 적용되지 않는 버그 수정

## feat
- ([4f4e551](https://github.com/SolidLoop-studio/kkuko-utils/commit/4f4e551)) - 정보 강제 갱신 요청 버튼 추가
- ([9129dbd](https://github.com/SolidLoop-studio/kkuko-utils/commit/9129dbd)) - user관리에서 isLastOnlineHidden도 수정 가능
- ([451a6f5](https://github.com/SolidLoop-studio/kkuko-utils/commit/451a6f5)) - 유저 관리 추가

# [v1.6.3](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.6.2...v1.6.3) - 2026-02-15

## fix
- ([f1fab4a](https://github.com/SolidLoop-studio/kkuko-utils/commit/f1fab4a)) - 두음법칙이 적용되지 않는 버그 수정

# [v1.6.2](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.6.1...v1.6.2) - 2026-02-13

## fix
- ([1935fba](https://github.com/SolidLoop-studio/kkuko-utils/commit/1935fba)) - 분당 옵션 계산 오류 수정
- ([c176818](https://github.com/SolidLoop-studio/kkuko-utils/commit/c176818)) - 부동소수점 오류 수정

# [v1.6.1](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.6.0...v1.6.1) - 2026-02-12

## fix
- ([2c0ef13](https://github.com/SolidLoop-studio/kkuko-utils/commit/2c0ef13)) - 공지 모달 md뷰어 사용

# [v1.6.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.5.2...v1.6.0) - 2026-02-12

## feat
- ([688410c](https://github.com/SolidLoop-studio/kkuko-utils/commit/688410c)) - 정보 비공개 요청 링크 추가
- ([16b6e74](https://github.com/SolidLoop-studio/kkuko-utils/commit/16b6e74)) - 중복된 닉네임 검색 처리 추가
- ([4ccb275](https://github.com/SolidLoop-studio/kkuko-utils/commit/4ccb275)) - 플레이 판수 탭 추가 및 탭 옵션 쿼리파라미터 추가
- ([c57a31c](https://github.com/SolidLoop-studio/kkuko-utils/commit/c57a31c)) - api-server 아이템 관리자 페이지 제작
- ([2923c50](https://github.com/SolidLoop-studio/kkuko-utils/commit/2923c50)) - 공지사항 추가/수정/삭제 구현
- ([32d3b43](https://github.com/SolidLoop-studio/kkuko-utils/commit/32d3b43)) - 공지사항 열람 페이지 추가
- ([c05353f](https://github.com/SolidLoop-studio/kkuko-utils/commit/c05353f)) - 랭킹에 전체모드 추가

## fix
- ([8bc4843](https://github.com/SolidLoop-studio/kkuko-utils/commit/8bc4843)) - 이미지 캐싱
- ([d78980d](https://github.com/SolidLoop-studio/kkuko-utils/commit/d78980d)) - 캐싱 추가로 429 줄이기 및 성능 향상
- ([d28d954](https://github.com/SolidLoop-studio/kkuko-utils/commit/d28d954)) - dark 모드 기본 색상 변경
- ([8541713](https://github.com/SolidLoop-studio/kkuko-utils/commit/8541713)) - 관리자페이지 전용 공지사항 관리 페이지를 이동
- ([87d0ceb](https://github.com/SolidLoop-studio/kkuko-utils/commit/87d0ceb)) - html lang수정
- ([a94e1d3](https://github.com/SolidLoop-studio/kkuko-utils/commit/a94e1d3)) - 모드 페이지 쿼리 파라미터 추가
- ([e8c8cea](https://github.com/SolidLoop-studio/kkuko-utils/commit/e8c8cea)) - 가림막 버그 수정
- ([86cca46](https://github.com/SolidLoop-studio/kkuko-utils/commit/86cca46)) - 특수 이름색 수정

# [v1.5.2](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.5.1...v1.5.2) - 2026-01-22

## fix
- ([c472882](https://github.com/SolidLoop-studio/kkuko-utils/commit/c472882)) - 분당 아이템 옵션 버그 수정

# [v1.5.1](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.5.0...v1.5.1) - 2026-01-22

## fix
- ([52ce05b](https://github.com/SolidLoop-studio/kkuko-utils/commit/52ce05b)) - 랭킹 123 판수 표시
- ([9f8be19](https://github.com/SolidLoop-studio/kkuko-utils/commit/9f8be19)) - 옵션 계산식 오류 수정

# [v1.5.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.4.0...v1.5.0) - 2026-01-22

## feat
- ([2d87586](https://github.com/SolidLoop-studio/kkuko-utils/commit/2d87586)) - ㄱㄴㄷ순 정렬 v4 추가
- ([2e79c24](https://github.com/SolidLoop-studio/kkuko-utils/commit/2e79c24)) - 자퀴 주제 선택창 자음 검색 추가
- ([cc48a8a](https://github.com/SolidLoop-studio/kkuko-utils/commit/cc48a8a)) - 크롤러 재시작 버튼 추가
- ([45897e0](https://github.com/SolidLoop-studio/kkuko-utils/commit/45897e0)) - 에러 핸들링 강화
- ([9d70dd3](https://github.com/SolidLoop-studio/kkuko-utils/commit/9d70dd3)) - 랭킹창 아바타 추가
- ([ca1693a](https://github.com/SolidLoop-studio/kkuko-utils/commit/ca1693a)) - 끄코 랭킹 페이지 구현
- ([83d448b](https://github.com/SolidLoop-studio/kkuko-utils/commit/83d448b)) - 최근 검색어 표시, 주의 문구 추가
- ([7592cd9](https://github.com/SolidLoop-studio/kkuko-utils/commit/7592cd9)) - 배지 표시추가, 프로필 이미지 default layer 추가
- ([dfecc15](https://github.com/SolidLoop-studio/kkuko-utils/commit/dfecc15)) - 유저 장착 아이템 이미지 추가
- ([3a72247](https://github.com/SolidLoop-studio/kkuko-utils/commit/3a72247)) - 유저 프로필 이미지 로드 추가
- ([b826fbd](https://github.com/SolidLoop-studio/kkuko-utils/commit/b826fbd)) - 경험치 랭킹, 레벨 아이콘 추가, 타입 파일 분리
- ([cb79044](https://github.com/SolidLoop-studio/kkuko-utils/commit/cb79044)) - 끄코 api, 이미지 사용을 위한 프록시 추가
- ([1219ffd](https://github.com/SolidLoop-studio/kkuko-utils/commit/1219ffd)) - 끄코 유저 정보 조회 페이지 추가
- ([9dc5c52](https://github.com/SolidLoop-studio/kkuko-utils/commit/9dc5c52)) - 끄코 관련 페이지 홈 추가
- ([e5e81e5](https://github.com/SolidLoop-studio/kkuko-utils/commit/e5e81e5)) - api 서버 관리자 페이지 추가
- ([1d21a84](https://github.com/SolidLoop-studio/kkuko-utils/commit/1d21a84)) - 한앞, 한쿵 미션문서 페이지 추가
- ([751960d](https://github.com/SolidLoop-studio/kkuko-utils/commit/751960d)) - 미션 문서 최근 변경 시각 추가
- ([95340e2](https://github.com/SolidLoop-studio/kkuko-utils/commit/95340e2)) - 미션 탭/문서 표시시 미션 글자 하이라이팅 추가
- ([6a55f63](https://github.com/SolidLoop-studio/kkuko-utils/commit/6a55f63)) - 한국어 끝말잇기 미션 단어 페이지 추가
- ([b791e38](https://github.com/SolidLoop-studio/kkuko-utils/commit/b791e38)) - split API page
- ([4d61854](https://github.com/SolidLoop-studio/kkuko-utils/commit/4d61854)) - ㄱㄴㄷ순 정렬v4 추가
- ([30e83f3](https://github.com/SolidLoop-studio/kkuko-utils/commit/30e83f3)) - renamed following Naming Conventions
- ([59f5d7f](https://github.com/SolidLoop-studio/kkuko-utils/commit/59f5d7f)) - Open API추가 및 api docs 추가
- ([1e54be7](https://github.com/SolidLoop-studio/kkuko-utils/commit/1e54be7)) - 한국어 미션단어 추출A - 첫글자 미션글자 제외 옵션 추가
- ([4cbddff](https://github.com/SolidLoop-studio/kkuko-utils/commit/4cbddff)) - 다크모드 지원 추가
- ([660f67c](https://github.com/SolidLoop-studio/kkuko-utils/commit/660f67c)) - 모바일 환경 미지원 추가
- ([7db26bb](https://github.com/SolidLoop-studio/kkuko-utils/commit/7db26bb)) - 미니게임 페이지 추가
- ([9f5fa2b](https://github.com/SolidLoop-studio/kkuko-utils/commit/9f5fa2b)) - 게임 컴포넌트 및 배경 추가
- ([dfc6556](https://github.com/SolidLoop-studio/kkuko-utils/commit/dfc6556)) - 게임 메인 화면 컴포넌트 추가
- ([5e58464](https://github.com/SolidLoop-studio/kkuko-utils/commit/5e58464)) - 미니게임 셋업 화면 추가
- ([5ed523a](https://github.com/SolidLoop-studio/kkuko-utils/commit/5ed523a)) - 미니게임 컴포넌트 추가
- ([055521d](https://github.com/SolidLoop-studio/kkuko-utils/commit/055521d)) - 미니게임 채팅 컴포넌트 추가
- ([66f778b](https://github.com/SolidLoop-studio/kkuko-utils/commit/66f778b)) - 미니게임에 사용될 컴포넌트 추가
- ([6f6532b](https://github.com/SolidLoop-studio/kkuko-utils/commit/6f6532b)) - 게임 관련 훅 추가
- ([55d6c16](https://github.com/SolidLoop-studio/kkuko-utils/commit/55d6c16)) - 게임 채팅 관련 훅 추가
- ([2b8768e](https://github.com/SolidLoop-studio/kkuko-utils/commit/2b8768e)) - 미니게임 매니저, 게임 로직  클래스 추가
- ([0f1d890](https://github.com/SolidLoop-studio/kkuko-utils/commit/0f1d890)) - 사운드 매니저 클래스 추가
- ([05154f5](https://github.com/SolidLoop-studio/kkuko-utils/commit/05154f5)) - 미니게임 단어 관리 함수 추가
- ([95a0c74](https://github.com/SolidLoop-studio/kkuko-utils/commit/95a0c74)) - 미니게임 서비스 클래스 추가
- ([d74bdd2](https://github.com/SolidLoop-studio/kkuko-utils/commit/d74bdd2)) - 미니게임 타입 파일 추가
- ([75de1a9](https://github.com/SolidLoop-studio/kkuko-utils/commit/75de1a9)) - 미니게임 상수 추가
- ([0b30397](https://github.com/SolidLoop-studio/kkuko-utils/commit/0b30397)) - 미니게임 상태 관리 및 provider 추가
- ([ceae47f](https://github.com/SolidLoop-studio/kkuko-utils/commit/ceae47f)) - 미니게임에서 사용할 이미지,사운드 파일

## fix
- ([c84dfef](https://github.com/SolidLoop-studio/kkuko-utils/commit/c84dfef)) - 문서 필터링 입력창에 특문 입력시 발생하는 에러 수정
- ([746483b](https://github.com/SolidLoop-studio/kkuko-utils/commit/746483b)) - suspense 추가
- ([34491b8](https://github.com/SolidLoop-studio/kkuko-utils/commit/34491b8)) - 의견 반영
- ([a3d732e](https://github.com/SolidLoop-studio/kkuko-utils/commit/a3d732e)) - 이전 검색어 표시 로직 수정, 검색후 UX 개선
- ([1533f63](https://github.com/SolidLoop-studio/kkuko-utils/commit/1533f63)) - 양손에 같은 아이템을 가지고 있을때 미표시되는 버그 수정
- ([74427da](https://github.com/SolidLoop-studio/kkuko-utils/commit/74427da)) - 특이 옵션 처리 추가
- ([134e458](https://github.com/SolidLoop-studio/kkuko-utils/commit/134e458)) - 부동 소수점 오류 수정
- ([a365d04](https://github.com/SolidLoop-studio/kkuko-utils/commit/a365d04)) - 상수 파일 분리, 슬롯 이름 지정
- ([21eaf12](https://github.com/SolidLoop-studio/kkuko-utils/commit/21eaf12)) - 헤더 activeIndex 수정
- ([cef72b3](https://github.com/SolidLoop-studio/kkuko-utils/commit/cef72b3)) - 철자 수정 누락됨
- ([6e65769](https://github.com/SolidLoop-studio/kkuko-utils/commit/6e65769)) - k_CanUse to k_canuse
- ([f2cfb46](https://github.com/SolidLoop-studio/kkuko-utils/commit/f2cfb46)) - openapi link path
- ([e8a2f2e](https://github.com/SolidLoop-studio/kkuko-utils/commit/e8a2f2e)) - lint Error
- ([cfe0eff](https://github.com/SolidLoop-studio/kkuko-utils/commit/cfe0eff)) - 오탈자 제거
- ([82768b5](https://github.com/SolidLoop-studio/kkuko-utils/commit/82768b5)) - 스택오버플로우 버그 수정
- ([fd2d994](https://github.com/SolidLoop-studio/kkuko-utils/commit/fd2d994)) - 단어 고급 검색 모바일 ui 수정
- ([c203922](https://github.com/SolidLoop-studio/kkuko-utils/commit/c203922)) - 없는 단어 뒤로 가기 꼬임 문제 수정
- ([87721ef](https://github.com/SolidLoop-studio/kkuko-utils/commit/87721ef)) - 사운드 파일명 오타 수정
- ([78d6da7](https://github.com/SolidLoop-studio/kkuko-utils/commit/78d6da7)) - 입력창 다크모드 대응
- ([863051d](https://github.com/SolidLoop-studio/kkuko-utils/commit/863051d)) - 한글 유틸 함수 저장파일 변경 및 테스트 파일 추가

## refactor
- ([2e3e35a](https://github.com/SolidLoop-studio/kkuko-utils/commit/2e3e35a)) - hook 분리
- ([4f8a379](https://github.com/SolidLoop-studio/kkuko-utils/commit/4f8a379)) - 관심사 분리 원칙에 맞게 리펙토링

# [v1.4.0](https://github.com/SolidLoop-studio/kkuko-utils/compare/v1.3.0...v1.4.0) - 2025-12-20

## fix
- ([b91fdd2](https://github.com/SolidLoop-studio/kkuko-utils/commit/b91fdd2)) - 릴리즈 nodejs 버전 업데이트
- ([e603226](https://github.com/SolidLoop-studio/kkuko-utils/commit/e603226)) - 서비스 제공자 이름 변경, 코드 라이센스 변경

## feat
- ([768ef96](https://github.com/SolidLoop-studio/kkuko-utils/commit/768ef96)) - implement automated release workflow and update dependencies

