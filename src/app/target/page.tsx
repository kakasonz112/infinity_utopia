"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Province = {
  slot: number;
  name: string;
  race: string;
  land: number;
  nw: number;
};

type Match = {
  own: Province;
  enemy: Province;
  ratio: number;
  score: number;
  outOfRange: boolean;
  reused: boolean;
  reuseRecommendation: {
    enemy: Province;
    ratio: number;
  } | null;
};

type UnassignedCandidate = {
  enemy: Province;
  ratio: number;
  assignedTo?: {
    own: Province;
    ratio: number;
  } | null;
};

type UnassignedDetail = {
  own: Province;
  reason: string;
  candidates: UnassignedCandidate[];
  recommendation: {
    enemy: Province;
    ratio: number;
  } | null;
};

type MatchSet = {
  matches: Match[];
  totalScore: number;
  avgRatio: number;
  unassignedDetails: UnassignedDetail[];
  unusedEnemy: Province[];
  outOfRangeCount: number;
  reusedCount: number;
  priorityLabel: string;
};

// valid race list
const RACES = [
  "Avian",
  "Dark",
  "Elf",
  "Dwarf",
  "Faery",
  "Gnome",
  "Halfling",
  "Human",
  "Orc",
  "Undead",
];

// -------------------------------------
// NEW SMART PARSER FOR UTOPIA EXPORT FORMAT
// -------------------------------------
const parseKingdom = (text: string): Province[] => {
  const lines = text.trim().split("\n");
  const provinces: Province[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);

    // slot = first number
    const slot = parseInt(parts[0]);
    if (!slot) continue;

    // find race index
    let raceIndex = -1;
    for (let i = 1; i < parts.length; i++) {
      if (RACES.includes(parts[i])) {
        raceIndex = i;
        break;
      }
    }
    if (raceIndex === -1) continue;

    const race = parts[raceIndex];

    // name = everything between slot and race
    const nameParts = parts.slice(1, raceIndex);
    const name = nameParts.join(" ");

    // find land (ends with "a")
    const landPart = parts.find((p) => p.endsWith("a"));
    if (!landPart) continue;
    const land = parseInt(landPart.replace(/[^0-9]/g, ""));

    // find NW = first occurrence ending with "gc"
    const nwPart = parts.find((p) => p.endsWith("gc"));
    if (!nwPart) continue;
    const nw = parseInt(nwPart.replace(/[^0-9]/g, ""));

    provinces.push({
      slot,
      name,
      race,
      land,
      nw,
    });
  }

  return provinces;
};

// -------------------------------------
// TOP-K MATCHING (MINIMIZE TOTAL |RATIO-100|)
// -------------------------------------
const RATIO_MIN = 70;
const RATIO_MAX = 130;
const TOP_K = 5;
const CANDIDATE_LIMIT = 10;
const CANDIDATE_REASON_LIMIT = 3;
const BEAM_WIDTH = 250;

const MAX_PER_ENEMY = 2;
const REUSE_PENALTY = 1e13;
const COVERAGE_BONUS = 1e14;

const PRIORITY_ORDERINGS = [
  [110, 100, 120, 90, 80, 130, 70],
  [100, 110, 90, 120, 80, 130, 70],
  [120, 110, 100, 90, 80, 130, 70],
  [90, 100, 110, 120, 80, 130, 70],
  [100, 90, 110, 120, 80, 130, 70],
  [110, 120, 100, 130, 90, 80, 70],
];

const makePriorityScore = (order: number[]) => (r: number) => {
  let score = 0;
  for (let i = 0; i < order.length; i++) {
    score +=
      Math.abs(r - order[i]) * Math.pow(10, (order.length - 1 - i) * 2);
  }
  return score;
};

const computeMatchSets = (
  own: Province[],
  enemy: Province[],
): MatchSet[] => {
  if (own.length === 0 || enemy.length === 0) return [];

  const ratio = (ownNW: number, enemyNW: number) =>
    (enemyNW / ownNW) * 100;

  const distanceToRange = (r: number) => {
    if (r < RATIO_MIN) return RATIO_MIN - r;
    if (r > RATIO_MAX) return r - RATIO_MAX;
    return 0;
  };

  const OUT_OF_RANGE_PENALTY = 1e13;

  const allMatchSets: MatchSet[] = [];

  for (const ordering of PRIORITY_ORDERINGS) {
  const priorityScore = makePriorityScore(ordering);

  const candidateListsAll = own.map((o) => {
    const candidates = enemy.map((e, index) => {
      const r = ratio(o.nw, e.nw);
      const inRange = r >= RATIO_MIN && r <= RATIO_MAX;
      return {
        enemyIndex: index,
        ratio: r,
        inRange,
        score: priorityScore(r) + (inRange ? 0 : OUT_OF_RANGE_PENALTY),
      };
    });

    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  });

  const fallbackRecommendations = own.map((o) => {
    const candidates = enemy.map((e, index) => {
      const r = ratio(o.nw, e.nw);
      return {
        enemyIndex: index,
        ratio: r,
        distance: distanceToRange(r),
        score: priorityScore(r),
      };
    });

    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.score - b.score;
    });

    const best = candidates[0];
    return best
      ? {
          enemy: enemy[best.enemyIndex],
          ratio: best.ratio,
        }
      : null;
  });

  const runSearch = (limit: number) => {
    const candidateLists = candidateListsAll.map((candidates) =>
      candidates.slice(0, limit).map((candidate) => ({
        enemyIndex: candidate.enemyIndex,
        score: candidate.score,
      }))
    );

    const eligible = own
      .map((_, idx) => idx)
      .filter((idx) => candidateLists[idx].length > 0);

    if (eligible.length === 0) return [];

    const order = eligible.sort(
      (a, b) => candidateLists[a].length - candidateLists[b].length
    );

    type BeamState = {
      assignments: number[];
      totalScore: number;
      enemyCount: Map<number, number>;
    };

    let beam: BeamState[] = [
      {
        assignments: new Array(own.length).fill(-1),
        totalScore: 0,
        enemyCount: new Map<number, number>(),
      },
    ];

    for (const ownIndex of order) {
      const nextBeam: BeamState[] = [];
      const candidates = candidateLists[ownIndex];
      if (candidates.length === 0) continue;

      for (const state of beam) {
        for (const candidate of candidates) {
          const count = state.enemyCount.get(candidate.enemyIndex) || 0;
          if (count >= MAX_PER_ENEMY) continue;

          const nextAssignments = [...state.assignments];
          nextAssignments[ownIndex] = candidate.enemyIndex;

          const nextCount = new Map(state.enemyCount);
          nextCount.set(candidate.enemyIndex, count + 1);

          const reuseCost = count > 0 ? REUSE_PENALTY : 0;

          nextBeam.push({
            assignments: nextAssignments,
            totalScore: state.totalScore + candidate.score + reuseCost,
            enemyCount: nextCount,
          });
        }
      }

      nextBeam.sort((a, b) => a.totalScore - b.totalScore);
      beam = nextBeam.slice(0, BEAM_WIDTH);
      if (beam.length === 0) return [];
    }

    // Prefer sets where all enemies are covered
    const scored = beam.map((state) => {
      const coveredEnemies = new Set<number>();
      for (const ei of state.assignments) {
        if (ei >= 0) coveredEnemies.add(ei);
      }
      const uncoveredCount = enemy.length - coveredEnemies.size;
      return {
        ...state,
        finalScore: state.totalScore + uncoveredCount * COVERAGE_BONUS,
      };
    });

    return scored
      .sort((a, b) => a.finalScore - b.finalScore)
      .slice(0, TOP_K)
      .map((state) => ({
        assignments: state.assignments,
        totalScore: state.finalScore,
      }));
  };

  const initialLimit = Math.min(CANDIDATE_LIMIT, enemy.length);
  let bestSets = runSearch(initialLimit);
  if (bestSets.length === 0 && enemy.length > initialLimit) {
    bestSets = runSearch(enemy.length);
  }

  const setsForOrdering = bestSets.map((set) => {
    // Step 1 — build mutable match list from beam assignments
    const matchesRaw: Array<{
      own: Province;
      enemy: Province;
      ratio: number;
      score: number;
      outOfRange: boolean;
    }> = set.assignments
      .map((enemyIndex, ownIndex) => {
        if (enemyIndex < 0) return null;
        const e = enemy[enemyIndex];
        const r = ratio(own[ownIndex].nw, e.nw);
        return {
          own: own[ownIndex],
          enemy: e,
          ratio: r,
          score: Math.abs(r - 100),
          outOfRange: r < RATIO_MIN || r > RATIO_MAX,
        };
      })
      .filter(
        (m): m is NonNullable<typeof m> => m !== null,
      );

    // Step 2 — eliminate unused enemies by swapping reused assignments
    const usedSlots = new Set(matchesRaw.map((m) => m.enemy.slot));
    let unusedList = enemy.filter((e) => !usedSlots.has(e.slot));
    const ecMap: Record<number, number> = {};
    matchesRaw.forEach((m) => {
      ecMap[m.enemy.slot] = (ecMap[m.enemy.slot] || 0) + 1;
    });

    let swapped = true;
    while (swapped && unusedList.length > 0) {
      swapped = false;
      for (const unused of [...unusedList]) {
        // find a reused match (count > 1) where swapping causes least damage
        const candidates = matchesRaw
          .filter((m) => ecMap[m.enemy.slot] > 1)
          .map((m) => {
            const r = ratio(m.own.nw, unused.nw);
            return {
              match: m,
              newRatio: r,
              newScore:
                priorityScore(r) +
                (r < RATIO_MIN || r > RATIO_MAX ? OUT_OF_RANGE_PENALTY : 0),
            };
          })
          .sort((a, b) => a.newScore - b.newScore);

        if (candidates.length > 0) {
          const best = candidates[0];
          const oldSlot = best.match.enemy.slot;
          // swap
          best.match.enemy = unused;
          best.match.ratio = best.newRatio;
          best.match.score = Math.abs(best.newRatio - 100);
          best.match.outOfRange =
            best.newRatio < RATIO_MIN || best.newRatio > RATIO_MAX;
          ecMap[oldSlot]--;
          ecMap[unused.slot] = (ecMap[unused.slot] || 0) + 1;
          usedSlots.add(unused.slot);
          swapped = true;
        }
      }
      unusedList = enemy.filter((e) => !usedSlots.has(e.slot));
    }

    // Step 3 — recompute counts, build final Match[] with reused + recommendation
    const enemyCounts: Record<number, number> = {};
    matchesRaw.forEach((m) => {
      enemyCounts[m.enemy.slot] = (enemyCounts[m.enemy.slot] || 0) + 1;
    });

    const matches: Match[] = matchesRaw.map((match) => {
      const isReused = enemyCounts[match.enemy.slot] > 1;
      let reuseRecommendation: Match["reuseRecommendation"] = null;

      if (match.outOfRange || isReused) {
        // best in-range enemy already in the set (reuse suggestion)
        const ownNW = match.own.nw;
        let bestScore = Infinity;
        let bestEnemy: Province | null = null;
        let bestRatio = 0;

        for (const m of matchesRaw) {
          if (m.enemy.slot === match.enemy.slot) continue;
          const r = (m.enemy.nw / ownNW) * 100;
          if (r >= RATIO_MIN && r <= RATIO_MAX) {
            const s = priorityScore(r);
            if (s < bestScore) {
              bestScore = s;
              bestEnemy = m.enemy;
              bestRatio = r;
            }
          }
        }

        if (bestEnemy) {
          reuseRecommendation = { enemy: bestEnemy, ratio: bestRatio };
        }
      }

      return {
        ...match,
        reused: isReused,
        reuseRecommendation,
      };
    });

    const finalUsedSlots = new Set(matches.map((m) => m.enemy.slot));
    const unusedEnemy = enemy.filter((e) => !finalUsedSlots.has(e.slot));
    const ratioSum = matches.reduce((sum, m) => sum + m.ratio, 0);
    const matchByEnemySlot = new Map<number, Match>();
    matches.forEach((match) => {
      matchByEnemySlot.set(match.enemy.slot, match);
    });

    const unassignedDetails: UnassignedDetail[] = own
      .map((o, index) => ({ own: o, index }))
      .filter(({ index }) => set.assignments[index] < 0)
      .map(({ own: o, index }) => {
        const candidates = candidateListsAll[index];
        const reason =
          candidates.length === 0
            ? "No enemy targets available."
            : candidates.every((c) => !c.inRange)
              ? "No in-range target (70-130%)."
              : "All in-range targets already assigned (max 2 per enemy).";

        const candidateDetails: UnassignedCandidate[] = candidates
          .slice(0, CANDIDATE_REASON_LIMIT)
          .map((candidate) => {
            const target = enemy[candidate.enemyIndex];
            const assignedMatch = matchByEnemySlot.get(target.slot) || null;
            return {
              enemy: target,
              ratio: candidate.ratio,
              assignedTo: assignedMatch
                ? {
                    own: assignedMatch.own,
                    ratio: assignedMatch.ratio,
                  }
                : null,
            };
          });

        return {
          own: o,
          reason,
          candidates: candidateDetails,
          recommendation: fallbackRecommendations[index],
        };
      });

    const outOfRangeCount = matches.filter((m) => m.outOfRange).length;
    const reusedCount = matches.filter((m) => m.reused).length;

    return {
      matches,
      totalScore: matches.reduce((sum, m) => sum + m.score, 0),
      avgRatio: matches.length ? ratioSum / matches.length : 0,
      unassignedDetails,
      unusedEnemy,
      outOfRangeCount,
      reusedCount,
      priorityLabel: ordering.join(" → "),
    };
  });

  allMatchSets.push(...setsForOrdering);
  } // end for ordering

  // Deduplicate by assignment fingerprint, sort by totalScore, return top K
  allMatchSets.sort((a, b) => a.totalScore - b.totalScore);
  const seen = new Set<string>();
  const uniqueSets: MatchSet[] = [];
  for (const mset of allMatchSets) {
    const key = JSON.stringify(
      mset.matches
        .map((m) => [m.own.slot, m.enemy.slot])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    );
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSets.push(mset);
    }
    if (uniqueSets.length >= TOP_K) break;
  }
  return uniqueSets;
};

export default function KingdomTargetMatcher() {
  const [ownInput, setOwnInput] = useState("");
  const [enemyInput, setEnemyInput] = useState("");
  const [matchSets, setMatchSets] = useState<MatchSet[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const computeMatches = () => {
    if (isComputing) return;
    setIsComputing(true);
    setMatchSets([]);
    setCopiedKey(null);

    window.setTimeout(() => {
      const own = parseKingdom(ownInput);
      const enemy = parseKingdom(enemyInput);

      const sets = computeMatchSets(own, enemy);
      setMatchSets(sets);
      setIsComputing(false);
    }, 0);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Kingdom Target Matcher</h1>

      <div className={styles.grid}>
        <textarea
          className={styles.textarea}
          placeholder={
            `Paste OWN kingdom table here
COPY FORMAT from OWN KINGDOM PAGE:

1   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
2   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
            `
            }
          value={ownInput}
          onChange={(e) => setOwnInput(e.target.value)}
        />

        <textarea
          className={styles.textarea}
          placeholder={
            `Paste ENEMY kingdom table here
COPY FORMAT from ENEMY KINGDOM PAGE:

1   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
2   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
            `
            }
          value={enemyInput}
          onChange={(e) => setEnemyInput(e.target.value)}
        />
      </div>

      <button
        className={styles.button}
        onClick={computeMatches}
        disabled={isComputing}
      >
        {isComputing ? "Generating Targets..." : "Compute Targets"}
      </button>

      {isComputing && (
        <div className={styles.loadingBanner}>
          <span className={styles.spinner} aria-hidden="true" />
          Generating targets, please wait...
        </div>
      )}

      {matchSets.length > 0 && (
        <div className={styles.accordion}>
          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Best Combinations</h2>
            {(() => {
              // Build lookup from Option 1 for diff comparison
              const baseMap = new Map<number, number>();
              if (matchSets.length > 0) {
                matchSets[0].matches.forEach((m) =>
                  baseMap.set(m.own.slot, m.enemy.slot),
                );
              }
              return matchSets.map((set, index) => {
                const diffCount =
                  index === 0
                    ? 0
                    : set.matches.filter(
                        (m) => baseMap.get(m.own.slot) !== m.enemy.slot,
                      ).length;
                return (
              <details
                key={`no-reuse-${index}`}
                className={styles.accordionItem}
                open={index === 0}
              >
                <summary className={styles.accordionSummary}>
                  <span>Option {index + 1}{index === 0 ? " (Recommended)" : ""}</span>
                  {index > 0 && (
                    <span className={styles.diffMeta}>
                      {diffCount} change{diffCount !== 1 ? "s" : ""} vs Option 1
                    </span>
                  )}
                  <span className={styles.accordionMeta}>
                    Priority: {set.priorityLabel}
                  </span>
                  <span className={styles.accordionMeta}>
                    Total deviation: {set.totalScore.toFixed(1)}
                  </span>
                  <span className={styles.accordionMeta}>
                    Avg ratio: {set.avgRatio.toFixed(1)}%
                  </span>
                  <span className={styles.accordionMeta}>
                    Unassigned own: {set.unassignedDetails.length}
                  </span>
                  <span className={styles.accordionMeta}>
                    Unused enemy: {set.unusedEnemy.length}
                  </span>
                  <span className={styles.accordionMeta}>
                    Out-of-range: {set.outOfRangeCount}
                  </span>
                  <span className={styles.accordionMeta}>
                    Reused: {set.reusedCount}
                  </span>
                </summary>

                <div className={styles.accordionBody}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>Assigned Targets</h2>

                    <div className={styles.actionBox}>
                      <button
                        className={styles.copyButton}
                        onClick={() => {
                          const text = set.matches
                            .map(
                              (m) =>
                                `#${m.own.slot} ${m.own.name}  →  #${m.enemy.slot} ${m.enemy.name}   (${m.ratio.toFixed(1)}%)`
                            )
                            .join("\n");

                          navigator.clipboard.writeText(text);
                          setCopiedKey(`no-reuse-${index}`);
                          setTimeout(() => setCopiedKey(null), 1200);
                        }}
                      >
                        Copy
                      </button>

                      {copiedKey === `no-reuse-${index}` && (
                        <span className={styles.copiedText}>Copied!</span>
                      )}
                    </div>
                  </div>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Own Slot</th>
                        <th>Own Province</th>
                        <th>Enemy Slot</th>
                        <th>Enemy Province</th>
                        <th>Ratio (%)</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {set.matches.map((m) => {
                        const isDiff =
                          index > 0 &&
                          baseMap.get(m.own.slot) !== m.enemy.slot;
                        return (
                        <tr
                          key={m.own.slot}
                          className={isDiff ? styles.diffRow : undefined}
                        >
                          <td>{`#${m.own.slot}`}</td>
                          <td>{m.own.name}</td>
                          <td>
                            {`#${m.enemy.slot}`}
                            {isDiff && (
                              <span className={styles.diffTag}>changed</span>
                            )}
                          </td>
                          <td>{m.enemy.name}</td>
                          <td className={m.outOfRange ? styles.outOfRange : undefined}>
                            {m.ratio.toFixed(1)}%
                            {m.outOfRange && (
                              <span className={styles.outOfRangeTag}>out of range</span>
                            )}
                            {m.reused && (
                              <span className={styles.reusedTag}>reused</span>
                            )}
                          </td>
                          <td>
                            {m.reuseRecommendation ? (
                              <span className={styles.candidateItem}>
                                #{m.reuseRecommendation.enemy.slot} {m.reuseRecommendation.enemy.name} ({m.reuseRecommendation.ratio.toFixed(1)}%)
                                <span className={styles.reusedTag}>reuse</span>
                              </span>
                            ) : (
                              <span className={styles.mutedText}>{m.outOfRange ? "No in-range reuse" : "—"}</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {set.unassignedDetails.length > 0 && (
                    <div className={styles.tableContainer}>
                      <h3 className={styles.subtitle}>Unassigned Own Provinces</h3>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Own Slot</th>
                            <th>Own Province</th>
                            <th>NW</th>
                            <th>Reason</th>
                            <th>Possible In-Range Targets</th>
                            <th>Recommendation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {set.unassignedDetails.map((detail) => (
                            <tr key={detail.own.slot}>
                              <td>{`#${detail.own.slot}`}</td>
                              <td>{detail.own.name}</td>
                              <td>{detail.own.nw.toLocaleString()}</td>
                              <td>{detail.reason}</td>
                              <td>
                                {detail.candidates.length === 0 ? (
                                  <span className={styles.mutedText}>None</span>
                                ) : (
                                  <div className={styles.candidateList}>
                                    {detail.candidates.map((candidate) => (
                                      <span
                                        key={candidate.enemy.slot}
                                        className={styles.candidateItem}
                                      >
                                        #{candidate.enemy.slot} {candidate.enemy.name} ({candidate.ratio.toFixed(1)}%)
                                        {candidate.assignedTo
                                          ? `, taken by #${candidate.assignedTo.own.slot} ${candidate.assignedTo.own.name} (${candidate.assignedTo.ratio.toFixed(1)}%)`
                                          : ", unused"}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                {detail.recommendation ? (
                                  <span className={styles.candidateItem}>
                                    #{detail.recommendation.enemy.slot} {detail.recommendation.enemy.name} ({detail.recommendation.ratio.toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className={styles.mutedText}>None</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {set.unusedEnemy.length > 0 && (
                    <div className={styles.tableContainer}>
                      <h3 className={styles.subtitle}>Unused Enemy Provinces</h3>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Enemy Slot</th>
                            <th>Enemy Province</th>
                            <th>NW</th>
                          </tr>
                        </thead>
                        <tbody>
                          {set.unusedEnemy.map((e) => (
                            <tr key={e.slot}>
                              <td>{`#${e.slot}`}</td>
                              <td>{e.name}</td>
                              <td>{e.nw.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
