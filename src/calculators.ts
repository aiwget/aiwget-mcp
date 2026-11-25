export type TcoVertical = 'enterprise_translation' | 'real_estate_data';

export type TranslationTcoInput = {
  vertical: 'enterprise_translation';
  monthlyMillionChars: number;
  needsZeroDataRetention?: boolean;
  hasIcuJsonPlaceholders?: boolean;
};

export type RealEstateTcoInput = {
  vertical: 'real_estate_data';
  monthlyPropertyLookups: number;
  monthlySkipTraceMatches?: number;
  needsParcelPolygons?: boolean;
  needsMcpServer?: boolean;
};

export type ApiTcoInput = TranslationTcoInput | RealEstateTcoInput;

export type TcoVendorEstimate = {
  vendor: string;
  estimatedMonthlyUsd: number | null;
  pricingModel: string;
  fitRating: 'recommended' | 'conditional' | 'caution';
  notes: string[];
};

export type ApiTcoResult = {
  vertical: TcoVertical;
  rateCardVerifiedAt: string;
  assumptions: Record<string, unknown>;
  estimates: TcoVendorEstimate[];
  labWarnings: string[];
  sourceGuides: string[];
};

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateApiTco(input: ApiTcoInput): ApiTcoResult {
  if (input.vertical === 'enterprise_translation') {
    const millions = Math.max(0, Math.min(10000, Number(input.monthlyMillionChars) || 0));
    const needsZdr = Boolean(input.needsZeroDataRetention);
    const hasIcu = Boolean(input.hasIcuJsonPlaceholders);

    const azureBillable = Math.max(0, millions - 2);
    const azureCost = roundUsd(azureBillable * 10);

    const awsBillable = Math.max(0, millions - 2);
    const awsCost = roundUsd(awsBillable * 15);

    const googleBillable = Math.max(0, millions - 0.5);
    const googleCost = roundUsd(googleBillable * 20);

    const deeplCost = roundUsd(5.49 + millions * 25);

    const labWarnings: string[] = [];
    if (hasIcu) {
      labWarnings.push(
        'AIWget Nov 2026 live lab test: both Google Cloud Translation and DeepL broke nested ICU plural JSON tokens (translating syntax keywords) unless custom tag/placeholder masking was added. Azure AI Translator preserved the ICU structure cleanly.',
      );
    }
    if (needsZdr) {
      labWarnings.push(
        'Zero Data Retention (ZDR): DeepL Free does NOT include ZDR; enterprise teams must use DeepL API Pro ($5.49 + $25/1M) or Azure Translator Standard S1+ ($10/1M after 2M free tier).',
      );
    }

    const estimates: TcoVendorEstimate[] = [
      {
        vendor: 'Azure AI Translator (Standard S1)',
        estimatedMonthlyUsd: azureCost,
        pricingModel: '$10 / 1M chars (2M free monthly tier)',
        fitRating: 'recommended',
        notes: [
          'Zero Data Retention included on Standard S1+ pay-as-you-go.',
          'Passed AIWget Nov 2026 nested ICU JSON preservation test without custom pre-masking.',
        ],
      },
      {
        vendor: 'Amazon Translate (Standard)',
        estimatedMonthlyUsd: awsCost,
        pricingModel: '$15 / 1M chars (2M free/mo for first 12 months)',
        fitRating: 'recommended',
        notes: [
          'AWS IAM + opt-out data retention policies align cleanly with AWS-native workloads.',
          '40% cheaper than DeepL API Pro at high automated volume.',
        ],
      },
      {
        vendor: 'Google Cloud Translation v3',
        estimatedMonthlyUsd: googleCost,
        pricingModel: '$20 / 1M chars (500K free monthly tier)',
        fitRating: hasIcu ? 'caution' : 'conditional',
        notes: [
          'Broadest language coverage, but 2x Azure S1 unit cost.',
          ...(hasIcu
            ? ['Requires placeholder pre-masking for nested ICU plural strings (verified in Nov 2026 test).']
            : []),
        ],
      },
      {
        vendor: 'DeepL API Pro',
        estimatedMonthlyUsd: deeplCost,
        pricingModel: '$5.49/mo base + $25 / 1M chars',
        fitRating: hasIcu ? 'caution' : 'conditional',
        notes: [
          'Strong European prose quality and guaranteed ZDR on API Pro.',
          '2.5x Azure S1 cost at volume; broke nested ICU tokens in Nov 2026 lab test unless masked.',
        ],
      },
      {
        vendor: 'MachineTranslation.com (Multi-Engine Consensus)',
        estimatedMonthlyUsd: null,
        pricingModel: 'Subscription / word-credit tiers (not raw $/1M char commodity API)',
        fitRating: millions <= 1 ? 'conditional' : 'caution',
        notes: [
          'Best suited for marketing, legal, or human-in-the-loop QA workflows comparing multiple LLMs/MT engines side-by-side.',
          'Not intended for bulk automated CI/CD JSON localization pipelines.',
        ],
      },
    ];

    return {
      vertical: 'enterprise_translation',
      rateCardVerifiedAt: '2026-11-25',
      assumptions: {
        monthlyMillionChars: millions,
        needsZeroDataRetention: needsZdr,
        hasIcuJsonPlaceholders: hasIcu,
      },
      estimates,
      labWarnings,
      sourceGuides: ['https://aiwget.com/blogs/best-deepl-alternatives-enterprise-2026'],
    };
  }

  // Real Estate Data APIs & MCP (aligned with AIWget Nov 2026 audited pricing in Art #1 & Art #3)
  const lookups = Math.max(0, Math.min(10_000_000, Math.trunc(Number(input.monthlyPropertyLookups) || 0)));
  const skipTraces = Math.max(0, Math.min(10_000_000, Math.trunc(Number(input.monthlySkipTraceMatches) || 0)));
  const needsPolygons = Boolean(input.needsParcelPolygons);
  const needsMcp = Boolean(input.needsMcpServer);

  const rentcastCost =
    lookups <= 50
      ? 0
      : lookups <= 1000
        ? 74
        : lookups <= 5000
          ? 199
          : lookups <= 10000
            ? 349
            : lookups <= 25000
              ? 449
              : lookups <= 100000
                ? 1574
                : null;
  const batchDataPropertyCost = lookups <= 100000 ? 1000 : roundUsd((lookups / 100000) * 1000);
  const batchDataSkipCost = skipTraces > 0 ? Math.max(2000, roundUsd(skipTraces * 0.1)) : 0;
  const batchDataCost = roundUsd(batchDataPropertyCost + batchDataSkipCost);
  const realEstateApiBase = lookups <= 30000 ? 599 : lookups <= 100000 ? 1200 : roundUsd((lookups / 100000) * 1200);
  const realEstateApiEstimate = roundUsd(realEstateApiBase + skipTraces * 0.05);

  const labWarnings: string[] = [];
  if (needsMcp) {
    labWarnings.push(
      'AIWget Nov 2026 live MCP probe: BatchData (https://mcp.batchdata.com/) responded live with RFC 9728 OAuth 2.1 DCR at root / (note: /mcp returns 404); RentCast only exposed a 4-tool OpenAPI HAR proxy with zero mortgage/lien endpoints, and ATTOM had no public hosted MCP endpoint.',
    );
  }
  if (skipTraces > 0) {
    labWarnings.push(
      'Skip-trace inflection point: RealEstateAPI bills ~$0.05/match on top of Starter ($599/mo) or Growth ($1,200/mo), whereas BatchData Skip Tracing starts at a $2,000+/mo add-on floor (built for 40K+ high-volume outbound teams). RentCast and Regrid do not include owner skip tracing.',
    );
  }
  if (needsPolygons) {
    labWarnings.push(
      'For nationwide GIS parcel boundary polygons, pair Regrid with a property/skip-trace API rather than relying on ATTOM Basic ($500/mo excludes parcel boundaries, AVM, comps, and pre-foreclosure).',
    );
  }

  const estimates: TcoVendorEstimate[] = [
    {
      vendor: 'BatchData',
      estimatedMonthlyUsd: batchDataCost,
      pricingModel: 'Growth $1,000/mo (100K lookups, annual commitment billed monthly); Skip Trace $2,000+/mo add-on',
      fitRating: needsMcp || lookups >= 50000 ? 'recommended' : 'conditional',
      notes: [
        'Verified live hosted MCP endpoint at https://mcp.batchdata.com/ (root path, RFC 9728 OAuth 2.1 DCR).',
        'At 100K pure property lookups, BatchData Growth ($1,000/mo) beats RealEstateAPI ($1,200/mo) and RentCast ($1,574/mo).',
      ],
    },
    {
      vendor: 'RentCast API',
      estimatedMonthlyUsd: rentcastCost,
      pricingModel: 'Self-serve flat tiers ($0 / $74 / $199 / $349 Growth 10K / $449 Scale 25K / $1,574 at 100K)',
      fitRating: skipTraces === 0 && !needsMcp && !needsPolygons && lookups <= 25000 ? 'recommended' : 'conditional',
      notes: [
        'Fastest self-serve start under 25K lookups/month for property records, rent estimates, and comps.',
        ...(skipTraces > 0 ? ['Does not offer skip tracing or mortgage/lien data.'] : []),
        ...(needsMcp ? ['Public MCP is a 4-tool OpenAPI HAR proxy without mortgage/lien endpoints.'] : []),
      ],
    },
    {
      vendor: 'RealEstateAPI',
      estimatedMonthlyUsd: realEstateApiEstimate,
      pricingModel: '$599/mo Starter (30K credits) / $1,200/mo at 100K lookups + $0.05/match skip tracing',
      fitRating: skipTraces > 0 && skipTraces <= 30000 ? 'recommended' : 'conditional',
      notes: [
        'At 100K lookups + 10K skip traces, RealEstateAPI (~$1,700/mo) undercuts BatchData ($3,000+/mo due to $2K skip-trace floor).',
        'Includes mortgages, comps, investor search filters, and metered skip tracing.',
      ],
    },
    {
      vendor: 'Regrid',
      estimatedMonthlyUsd: null,
      pricingModel: 'Self-serve parcel API starter tiers + custom statewide/nationwide polygon licensing',
      fitRating: needsPolygons ? 'recommended' : 'conditional',
      notes: [
        'Purpose-built for accurate nationwide parcel boundaries and zoning/GIS tiles.',
        'Typically combined with BatchData or RealEstateAPI when owner contact info is also needed.',
      ],
    },
    {
      vendor: 'ATTOM Data',
      estimatedMonthlyUsd: null,
      pricingModel: '$500/mo Basic (excludes AVM, comps, pre-foreclosure, parcel boundaries) + custom annual enterprise contracts',
      fitRating: lookups >= 100000 ? 'conditional' : 'caution',
      notes: [
        'Deepest historical property, tax, deed, and AVM warehouse (note: Estated was acquired and merged into ATTOM).',
        'Overkill for prototypes or <50K monthly lookups where self-serve APIs ship in minutes.',
      ],
    },
  ];

  return {
    vertical: 'real_estate_data',
    rateCardVerifiedAt: '2026-11-25',
    assumptions: {
      monthlyPropertyLookups: lookups,
      monthlySkipTraceMatches: skipTraces,
      needsParcelPolygons: needsPolygons,
      needsMcpServer: needsMcp,
    },
    estimates,
    labWarnings,
    sourceGuides: [
      'https://aiwget.com/blogs/best-attom-data-alternatives-2026',
      'https://aiwget.com/blogs/best-real-estate-data-mcp-servers-2026',
    ],
  };
}
