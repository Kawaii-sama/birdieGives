// Pure functions only — no I/O — so they can be unit-tested, reused on the
// client for instant UI feedback, and reused server-side as the source of truth.

/** Effective monthly contribution for a plan, given current settings. */
export function planPrice(plan, settings) {
  return plan === "yearly" ? settings.yearly_price : settings.monthly_price;
}

/**
 * Total monthly prize pool + per-tier split, based on the *actual* mix of
 * active monthly vs yearly subscribers (not a flat average).
 */
export function calcPrizePools(activeProfiles, settings) {
  const revenue = activeProfiles.reduce((sum, p) => sum + planPrice(p.plan, settings), 0);
  const total = +(revenue * settings.pool_share).toFixed(2);
  return {
    total,
    match5: +(total * settings.tier5_share).toFixed(2),
    match4: +(total * settings.tier4_share).toFixed(2),
    match3: +(total * settings.tier3_share).toFixed(2),
  };
}

export function calcCharityContribution(plan, charityPct, settings) {
  return +(planPrice(plan, settings) * charityPct / 100).toFixed(2);
}

/** Random draw: 5 unique Stableford numbers, 1–45. */
export function randomDraw() {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const result = [];
  while (result.length < 5) {
    const i = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(i, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

/**
 * Algorithmic draw: weighted toward the scores most/least frequently logged
 * by active subscribers this cycle. `frequency` is { [score]: count }.
 */
export function algorithmicDraw(frequency = {}) {
  const entries = Object.entries(frequency);
  if (!entries.length) return randomDraw();

  const weighted = [];
  for (const [score, count] of entries) {
    for (let i = 0; i < count; i++) weighted.push(Number(score));
  }

  const result = new Set();
  let attempts = 0;
  while (result.size < 5 && attempts < 500) {
    result.add(weighted[Math.floor(Math.random() * weighted.length)]);
    attempts++;
  }
  while (result.size < 5) result.add(Math.floor(Math.random() * 45) + 1);
  return [...result].sort((a, b) => a - b);
}

/** How many of a user's 5 stored scores appear in the drawn numbers. */
export function countMatches(userScores, drawNumbers) {
  const userNums = new Set(userScores.map((s) => s.score));
  return drawNumbers.filter((n) => userNums.has(n));
}

export function tierForMatches(matchCount) {
  if (matchCount >= 5) return "5-match";
  if (matchCount === 4) return "4-match";
  if (matchCount === 3) return "3-match";
  return null;
}

/**
 * Resolves an entire draw against every active subscriber's current scores.
 * Returns per-tier winner lists with equal-split amounts, and whether the
 * 5-match jackpot rolls over.
 */
export function resolveDraw({ numbers, activeUsersWithScores, pools, jackpotIn }) {
  const buckets = { "5-match": [], "4-match": [], "3-match": [] };

  for (const u of activeUsersWithScores) {
    if (u.scores.length < 5) continue; // must have a full rolling window to qualify
    const matched = countMatches(u.scores, numbers);
    const tier = tierForMatches(matched.length);
    if (tier) buckets[tier].push({ userId: u.userId, matched });
  }

  const jackpotPool = pools.match5 + jackpotIn;
  const jackpotRolled = buckets["5-match"].length === 0;

  const winners = [];
  const tierConfig = [
    ["5-match", jackpotRolled ? 0 : jackpotPool],
    ["4-match", pools.match4],
    ["3-match", pools.match3],
  ];
  for (const [tier, pool] of tierConfig) {
    const list = buckets[tier];
    if (!list.length) continue;
    const share = +(pool / list.length).toFixed(2);
    for (const w of list) winners.push({ ...w, tier, amount: share });
  }

  return {
    winners,
    jackpotRolled,
    jackpotOut: jackpotRolled ? jackpotPool : 0,
  };
}

/** Score validation mirrors the DB constraints so the UI can fail fast. */
export function validateScore(score, date, existingScores, editingId = null) {
  const val = parseInt(score, 10);
  if (!score || !date) return "Please enter both a score and date.";
  if (Number.isNaN(val) || val < 1 || val > 45) return "Score must be between 1 and 45 (Stableford format).";
  const dup = existingScores.find((s) => s.played_on === date && s.id !== editingId);
  if (dup) return "A score for this date already exists. Edit or delete the existing entry.";
  return null;
}

/**
 * Convenience wrapper used by AdminDashboard.
 * `scores` is an array of { score, profile_id, profiles } rows from Supabase.
 * `mode` is "random" | "weighted_freq" | "weighted_rare"
 * Returns { drawnNumbers, winners[] }
 */
export function runDraw(scores, mode = "random") {
  // Build frequency map from active subscribers' scores
  const freq = {};
  for (const row of scores) {
    const s = row.score;
    freq[s] = (freq[s] || 0) + 1;
  }

  let drawnNumbers;
  if (mode === "random") {
    drawnNumbers = randomDraw();
  } else if (mode === "weighted_rare") {
    // Invert weights: rarer scores get higher weight
    const maxCount = Math.max(...Object.values(freq), 1);
    const invFreq = {};
    for (const [s, c] of Object.entries(freq)) {
      invFreq[s] = maxCount - c + 1;
    }
    drawnNumbers = algorithmicDraw(invFreq);
  } else {
    drawnNumbers = algorithmicDraw(freq);
  }

  // Group scores by profile
  const byProfile = {};
  for (const row of scores) {
    const pid = row.profile_id;
    if (!byProfile[pid]) byProfile[pid] = [];
    if (byProfile[pid].length < 5) byProfile[pid].push({ score: row.score });
  }

  // Find winners
  const winners = [];
  for (const [profileId, userScores] of Object.entries(byProfile)) {
    if (userScores.length < 5) continue;
    const matched = countMatches(userScores, drawnNumbers);
    const tier = tierForMatches(matched.length);
    if (tier) {
      winners.push({ profileId, tier, matchedNumbers: matched, prizeAmount: 0 });
    }
  }

  // Equal-split prize amounts (approximate — real amounts from DB settings)
  const POOLS = { "5-match": 0.40, "4-match": 0.35, "3-match": 0.25 };
  const tierCounts = {};
  for (const w of winners) tierCounts[w.tier] = (tierCounts[w.tier] || 0) + 1;
  for (const w of winners) {
    w.prizeAmount = POOLS[w.tier] ? +(100 * POOLS[w.tier] / tierCounts[w.tier]).toFixed(2) : 0;
  }

  return { drawnNumbers, winners };
}
