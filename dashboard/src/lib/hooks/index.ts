// Export all custom hooks
export { useFilters } from './useFilters';
export type { FilterValue, Filters } from './useFilters';

export {
    useAdminData,
    useAdminMutation,
    useTenants,
    useJobs,
    useRules,
    useMappings,
    useLogs,
    useStats,
} from './useAdminData';

export {
    useRealTimeQuotes,
    useRealTimeQuote,
} from './useRealTimeQuotes';
export type { RealTimeQuote } from './useRealTimeQuotes';

export {
    usePortfolio,
    usePortfolios,
    usePortfolioMutations,
} from './usePortfolio';

export {
    useStockAnalysis,
    useNewsImpactAnalysis,
    usePortfolioAdvice,
    useMarketOutlook,
    useAIChat,
} from './useAIAnalysis';

export {
    useSocialPosts,
    useSocialDashboard,
    useSocialAnalytics,
    useTrackedAccounts,
    useMonitorKeywords,
    useSocialMutations,
    usePostFilter,
} from './useSocialData';

export {
    useNewsArticles,
    useNewsDashboard,
    useNewsSources,
    useNewsAnalytics,
    useNewsMutations,
    useNewsFilter,
} from './useNewsData';

export {
    useQuotes,
    useMarketDashboard,
    useWatchlist,
    useMarketSignals,
    useSectorHeatmap,
    useTechnicalIndicators,
    useMarketMutations,
    useWatchlistFilter,
} from './useMarketData';

export {
    useInfiniteScroll,
    useDebounce,
    useLocalStorage,
    usePrevious,
} from './useUtilities';
