export interface TrustScoreInput {
  contracts: { status: "draft" | "active" | "completed" | "terminated" }[];
  reviews: { quality_rating: number; timeliness_rating: number; safety_rating: number }[];
}

export type TrustLabel = "Excellent" | "Good" | "Fair" | "Needs Review" | "Unrated";

export interface TrustScore {
  score: number; // 0-100
  label: TrustLabel;
  reviewCount: number;
  avgRating: number | null; // 1-5 scale, unshrunk (for display)
  terminatedContracts: number;
}

const PRIOR_RATING = 3.5; // neutral prior on the 1-5 rating scale
const PRIOR_WEIGHT = 3; // equivalent to 3 "phantom" reviews at the prior — keeps 1-review vendors from spiking to the top

/**
 * Rolls a vendor's subcontract history and performance reviews into a single
 * 0-100 trust score. Uses Bayesian shrinkage toward a neutral prior so a
 * vendor with one 5-star review doesn't outrank one with ten reviews
 * averaging 4.5, and penalizes terminated contracts directly since that's
 * a stronger signal than any star rating.
 */
export function computeSubcontractorTrustScore(input: TrustScoreInput): TrustScore {
  const { contracts, reviews } = input;

  const reviewCount = reviews.length;
  const avgRatingRaw =
    reviewCount > 0
      ? reviews.reduce((s, r) => s + (r.quality_rating + r.timeliness_rating + r.safety_rating) / 3, 0) /
        reviewCount
      : null;

  const shrunkRating =
    reviewCount > 0 ? (avgRatingRaw! * reviewCount + PRIOR_RATING * PRIOR_WEIGHT) / (reviewCount + PRIOR_WEIGHT) : null;

  const terminatedContracts = contracts.filter((c) => c.status === "terminated").length;

  let score = shrunkRating != null ? Math.round(((shrunkRating - 1) / 4) * 100) : 50;
  score -= terminatedContracts * 15;
  score = Math.max(0, Math.min(100, score));

  let label: TrustLabel;
  if (reviewCount === 0 && contracts.length === 0) label = "Unrated";
  else if (score >= 80) label = "Excellent";
  else if (score >= 60) label = "Good";
  else if (score >= 40) label = "Fair";
  else label = "Needs Review";

  return {
    score,
    label,
    reviewCount,
    avgRating: avgRatingRaw != null ? Math.round(avgRatingRaw * 10) / 10 : null,
    terminatedContracts,
  };
}
