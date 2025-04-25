// src/app/province-activity/page.tsx
// Fetches historical data, displays latest snapshot, shows activity graph,
// lists top 5 most frequent active provinces, and top 5 most active timestamps for expanded kingdoms.
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, get, Database } from 'firebase/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- Type Definitions ---
type ProvinceActivityData = {
  provinces: string[];
  fetchedDate: string;
  error?: boolean;
  message?: string;
};

type KingdomActivityData = {
  [kingdomIslandKey: string]: ProvinceActivityData;
};

type HistoricalActivityData = {
  [timestamp: string]: KingdomActivityData;
};

type ChartDataPoint = {
  timestamp: number;
  timeLabel: string;
  fullDateTimeLabel: string;
  [provinceName: string]: number | string;
};

type TopProvinceInfo = {
    name: string;
    count: number; // Frequency count
};

// Type for top timestamp data
type TopTimestampInfo = {
    timestamp: number; // Timestamp as number
    count: number; // Number of active provinces at this time
};


// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL
};

// --- Firebase Initialization ---
let app: FirebaseApp;
let db: Database;
if (typeof window !== 'undefined' && !getApps().length) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
        console.error("❌ Firebase config missing!");
    } else {
        try {
            app = initializeApp(firebaseConfig);
            db = getDatabase(app);
            console.log("🔥 Firebase Initialized.");
        } catch (error) {
             console.error("❌ Firebase init error:", error);
        }
    }
} else if (getApps().length > 0) {
    app = getApps()[0];
    db = getDatabase(app);
}

// --- Data Fetching Hook ---
function useHistoricalProvinceActivity() {
  const [historicalData, setHistoricalData] = useState<HistoricalActivityData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!db) {
          console.warn("Firebase DB not ready."); setIsLoading(false);
          setError("Firebase connection not established."); return;
      }
      const dbRef = ref(db, 'province_data');
      try {
        console.log("➡️ Fetching historical data...");
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const data = snapshot.val() as HistoricalActivityData;
          if (typeof data === 'object' && data !== null) {
              console.log(`✅ Historical data fetched. Found ${Object.keys(data).length} timestamps.`);
              setHistoricalData(data);
          } else {
              console.warn("⚠️ Unexpected data format.", data);
              setError("Unexpected data format."); setHistoricalData(null);
          }
        } else {
          console.log("ℹ️ No activity data found."); setError("No activity data found.");
          setHistoricalData(null);
        }
      } catch (fetchError: any) {
        console.error("❌ Error fetching data:", fetchError);
        setError(`Failed to fetch data: ${fetchError.message}`); setHistoricalData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);
  return { historicalData, isLoading, error };
}

// --- Chart Component (Unchanged) ---
const ActivityTimelineChart = ({ kingdomHistory, uniqueProvinces }: { kingdomHistory: ChartDataPoint[], uniqueProvinces: string[] }) => {
    const colors = [
        "#8884d8", "#82ca9d", "#ffc658", "#ff7f0e", "#d0ed57", "#a4de6c",
        "#8dd1e1", "#83a6ed", "#ff6347", "#fa8072", "#ee82ee", "#00ced1",
        "#ffa500", "#9acd32", "#4682b4"
    ];
    const MAX_LEGEND_ITEMS = 15;

    if (!kingdomHistory || kingdomHistory.length < 2) {
        return <p className="text-sm text-gray-500 italic text-center my-4">Not enough historical data points to draw a graph for this kingdom.</p>;
    }
    const showLegend = uniqueProvinces.length <= MAX_LEGEND_ITEMS;

    return (
        <div style={{ width: '100%', height: 350 }} className="mt-4">
            <ResponsiveContainer>
                <LineChart data={kingdomHistory} margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                    <XAxis dataKey="timeLabel" stroke="#9ca3af" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(value) => (value === 1 ? 'Active' : 'Inactive')} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }}
                        labelStyle={{ color: '#e5e7eb', marginBottom: '5px' }}
                        itemStyle={{ color: '#d1d5db', fontSize: '12px' }}
                        labelFormatter={(label, payload) => {
                            const dataPoint = payload && payload.length > 0 ? kingdomHistory.find(p => p.timeLabel === label) : null;
                            return dataPoint ? `Time: ${dataPoint.fullDateTimeLabel}` : `Time: ${label}`;
                        }}
                        formatter={(value, name) => [value === 1 ? 'Active' : 'Inactive', name]}
                    />
                    {showLegend && (
                        <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px', paddingLeft: '20px' }} verticalAlign="bottom" />
                    )}
                    {uniqueProvinces.map((provinceName, index) => (
                        <Line key={provinceName} type="stepAfter" dataKey={provinceName} stroke={colors[index % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 1, fill: colors[index % colors.length] }} connectNulls={false} isAnimationActive={false} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- Helper Function to Calculate Top Provinces ---
const getTopActiveProvinces = (
    historicalData: HistoricalActivityData | null,
    kingdomKey: string,
    limit: number = 5
): TopProvinceInfo[] => {
    if (!historicalData) return [];
    const provinceCounts: { [name: string]: number } = {};
    Object.keys(historicalData).forEach(ts => {
        const kingdomDataAtTime = historicalData[ts]?.[kingdomKey];
        if (kingdomDataAtTime?.provinces && !kingdomDataAtTime.error) {
            kingdomDataAtTime.provinces.forEach(provinceName => {
                provinceCounts[provinceName] = (provinceCounts[provinceName] || 0) + 1;
            });
        }
    });
    const provinceList = Object.entries(provinceCounts).map(([name, count]) => ({ name, count }));
    provinceList.sort((a, b) => b.count - a.count);
    return provinceList.slice(0, limit);
};

// --- Helper Function to Calculate Top Timestamps by Activity ---
const getTopActiveTimestamps = (
    historicalData: HistoricalActivityData | null,
    kingdomKey: string,
    limit: number = 5 // Default to top 5
): TopTimestampInfo[] => {
    if (!historicalData) return [];

    const timestampCounts: TopTimestampInfo[] = [];
    const allTimestamps = Object.keys(historicalData);

    // Iterate through all timestamps
    allTimestamps.forEach(tsString => {
        const kingdomDataAtTime = historicalData[tsString]?.[kingdomKey];
        // Check if data exists for this kingdom at this time and there was no scrape error
        if (kingdomDataAtTime?.provinces && !kingdomDataAtTime.error) {
            timestampCounts.push({
                timestamp: Number(tsString),
                count: kingdomDataAtTime.provinces.length // Count of active provinces
            });
        } else if (kingdomDataAtTime && !kingdomDataAtTime.error) {
             // Include timestamps where the kingdom existed but had 0 active provinces
             timestampCounts.push({
                timestamp: Number(tsString),
                count: 0
            });
        }
        // Ignore timestamps where kingdom data doesn't exist or had a scrape error
    });

    // Sort by count descending, then by timestamp descending (as tie-breaker)
    timestampCounts.sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return b.timestamp - a.timestamp; // Show more recent first in case of tie
    });

    // Return the top 'limit' timestamps
    return timestampCounts.slice(0, limit);
};


// --- The Page Component ---
export default function ProvinceActivityPage() {
  const { historicalData, isLoading, error } = useHistoricalProvinceActivity();
  const [expandedKingdoms, setExpandedKingdoms] = useState<Set<string>>(new Set());

  // --- Process Data for Latest Snapshot ---
  const latestSnapshot = useMemo(() => {
    if (!historicalData) return { latestTimestamp: null, latestKingdomData: null };
    const timestamps = Object.keys(historicalData).sort((a, b) => Number(b) - Number(a));
    if (timestamps.length === 0) return { latestTimestamp: null, latestKingdomData: null };
    const latestTimestamp = timestamps[0];
    const latestKingdomData = historicalData[latestTimestamp];
    return { latestTimestamp, latestKingdomData };
  }, [historicalData]);

  const { latestTimestamp, latestKingdomData } = latestSnapshot;

  // --- Toggle Expansion ---
  const toggleKingdomExpansion = (kingdomKey: string) => {
    setExpandedKingdoms(prev => {
      const newSet = new Set(prev);
      newSet.has(kingdomKey) ? newSet.delete(kingdomKey) : newSet.add(kingdomKey);
      return newSet;
    });
  };

  // --- Calculate Consolidated Activity (Latest) ---
  const consolidatedActivity = useMemo(() => {
    if (!latestKingdomData) return { totalActive: 0, uniqueActiveProvinces: [] };
    let totalActiveCount = 0;
    const uniqueProvinces = new Set<string>();
    Object.values(latestKingdomData).forEach(activityInfo => {
      if (activityInfo.provinces && !activityInfo.error) {
        totalActiveCount += activityInfo.provinces.length;
        activityInfo.provinces.forEach(provinceName => uniqueProvinces.add(provinceName));
      }
    });
    return {
      totalActive: totalActiveCount,
      uniqueActiveProvinces: Array.from(uniqueProvinces).sort()
    };
  }, [latestKingdomData]);

  // --- Prepare Data for Chart ---
  const getChartDataForKingdom = (kingdomKey: string): { chartData: ChartDataPoint[], uniqueProvinces: string[] } => {
      if (!historicalData) return { chartData: [], uniqueProvinces: [] };
      const allTimestamps = Object.keys(historicalData).sort((a, b) => Number(a) - Number(b));
      const kingdomProvincesOverTime = new Set<string>();

      allTimestamps.forEach(ts => {
          const kingdomDataAtTime = historicalData[ts]?.[kingdomKey];
          if (kingdomDataAtTime?.provinces && !kingdomDataAtTime.error) {
              kingdomDataAtTime.provinces.forEach(p => kingdomProvincesOverTime.add(p));
          }
      });
      const uniqueProvincesList = Array.from(kingdomProvincesOverTime).sort();

      const chartData: ChartDataPoint[] = allTimestamps.map(tsString => {
          const timestamp = Number(tsString);
          const dateObj = new Date(timestamp);
          const kingdomDataAtTime = historicalData[tsString]?.[kingdomKey];
          const activeProvincesAtTime = (kingdomDataAtTime?.provinces && !kingdomDataAtTime.error)
              ? new Set(kingdomDataAtTime.provinces) : new Set<string>();
          const dataPoint: ChartDataPoint = {
              timestamp: timestamp,
              timeLabel: `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`,
              fullDateTimeLabel: dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
          };
          uniqueProvincesList.forEach(provinceName => {
              dataPoint[provinceName] = activeProvincesAtTime.has(provinceName) ? 1 : 0;
          });
          return dataPoint;
      });
      return { chartData, uniqueProvinces: uniqueProvincesList };
  };


  // --- Render Logic ---
  if (isLoading) return ( /* Loading state */
      <div className="p-4 md:p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold mb-4 text-yellow-400">Province Activity</h1>
          <p className="text-lg animate-pulse">Loading historical activity data...</p>
      </div>
  );
  if (error) return ( /* Error state */
      <div className="p-4 md:p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold mb-4 text-yellow-400">Province Activity</h1>
          <p className="text-red-500 text-lg">Error: {error}</p>
          <p className="text-gray-400 mt-2">Could not load data.</p>
      </div>
  );
   if (!historicalData || Object.keys(historicalData).length === 0) return ( /* No Data state */
       <div className="p-4 md:p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
           <h1 className="text-3xl font-bold mb-4 text-yellow-400">Province Activity</h1>
           <p className="text-gray-500 text-lg">No historical activity data found.</p>
       </div>
   );

  const lastUpdatedDate = latestTimestamp ? new Date(parseInt(latestTimestamp)).toLocaleString() : 'N/A';
  const sortedKingdomKeys = latestKingdomData ? Object.keys(latestKingdomData).sort((a, b) => {
      const [kdA, isA] = a.split(':').map(Number); const [kdB, isB] = b.split(':').map(Number);
      if (kdA !== kdB) return kdA - kdB; return isA - isB;
  }) : [];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-center text-yellow-400">Utopia Province Activity Monitor</h1>
      <p className="text-center text-sm text-gray-400 mb-6">Displaying Latest Scrape: {lastUpdatedDate}</p>
      <p className="text-center text-xs text-gray-500 mb-6">(Found {Object.keys(historicalData).length} historical records)</p>

      {/* --- Consolidated Activity Section --- */}
      <div className="mb-8 p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-semibold mb-3 text-center text-yellow-500">Latest Activity Summary</h2>
         {latestKingdomData ? (
            <>
                <p className="text-center text-lg mb-2">
                    Total Active Provinces Found: <span className="font-bold text-white">{consolidatedActivity.totalActive}</span>
                </p>
                {consolidatedActivity.uniqueActiveProvinces.length > 0 ? (
                    <div>
                        <h3 className="text-md font-medium mb-1 text-gray-300 text-center">
                            Unique Active Provinces ({consolidatedActivity.uniqueActiveProvinces.length}):
                        </h3>
                        <div className="max-h-32 overflow-y-auto bg-gray-700 p-2 rounded text-center text-sm">
                            {consolidatedActivity.uniqueActiveProvinces.join(' | ')}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 italic">No unique active provinces listed in the latest data.</p>
                )}
            </>
        ) : (
             <p className="text-center text-gray-500 italic">No data loaded for the latest timestamp to calculate summary.</p>
        )}
      </div>

      {/* --- Activity by Kingdom Grid --- */}
      <h2 className="text-2xl font-semibold mb-4 text-center text-yellow-400">Activity by Kingdom</h2>
      {latestKingdomData && sortedKingdomKeys.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedKingdomKeys.map((kingdomKey) => {
              const activityInfo = latestKingdomData[kingdomKey];
              const isExpanded = expandedKingdoms.has(kingdomKey);
              if (!activityInfo) return null;
              const hadScrapeError = activityInfo.error === true;

              // Prepare chart data *only if expanded*
              const { chartData, uniqueProvinces } = isExpanded
                  ? getChartDataForKingdom(kingdomKey)
                  : { chartData: [], uniqueProvinces: [] };

              // Calculate top provinces *only if expanded*
              const topProvinces = isExpanded
                  ? getTopActiveProvinces(historicalData, kingdomKey, 5)
                  : [];

              // Calculate top timestamps *only if expanded*
              const topTimestamps = isExpanded
                  ? getTopActiveTimestamps(historicalData, kingdomKey, 5)
                  : [];

              return (
                <div key={kingdomKey} className={`rounded-lg shadow-lg border ${hadScrapeError ? 'border-red-700 bg-red-900 bg-opacity-20' : 'border-gray-700 bg-gray-800'} overflow-hidden`}>
                  {/* Clickable Header */}
                  <div
                    className={`p-4 cursor-pointer ${hadScrapeError ? 'hover:bg-red-800 hover:bg-opacity-30' : 'hover:bg-gray-700'} transition-colors duration-200 flex justify-between items-center`}
                    onClick={() => toggleKingdomExpansion(kingdomKey)}
                  >
                     <div>
                      <h3 className={`text-xl font-semibold ${hadScrapeError ? 'text-red-400' : 'text-yellow-500'}`}>
                        Kingdom {kingdomKey.replace(':',':')}
                        {hadScrapeError && <span className="text-xs ml-2">(Scrape Error)</span>}
                      </h3>
                      <p className={`text-xs mt-1 ${hadScrapeError ? 'text-red-300' : 'text-gray-400'}`}>
                        Game Date: {activityInfo.fetchedDate || 'N/A'}
                      </p>
                       <p className={`text-sm mt-1 ${hadScrapeError ? 'text-red-300' : 'text-gray-300'}`}>
                        Active Provinces: {hadScrapeError ? 'N/A' : (activityInfo.provinces?.length ?? 0)}
                      </p>
                    </div>
                    <span className={`text-xl font-bold ${hadScrapeError ? 'text-red-400' : 'text-gray-400'}`}>
                      {isExpanded ? '-' : '+'}
                    </span>
                  </div>

                  {/* Expandable Content Area */}
                   {/* Increased max-height further for top timestamps list */}
                  <div className={`transition-max-height duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[800px]' : 'max-h-0'}`}> {/* Adjust height as needed */}
                    <div className="p-4 border-t border-gray-700">
                      {hadScrapeError && ( /* Error message */
                           <p className="text-sm text-red-400 italic mb-2">Failed to fetch details for this kingdom during the last scrape.</p>
                      )}

                       {/* Render Chart if expanded and no error */}
                       {isExpanded && !hadScrapeError && (
                            <ActivityTimelineChart
                                kingdomHistory={chartData}
                                uniqueProvinces={uniqueProvinces}
                            />
                        )}

                       {/* --- Top 5 Active Provinces Section --- */}
                       {isExpanded && !hadScrapeError && topProvinces.length > 0 && (
                           <div className="mt-6 pt-4 border-t border-gray-600">
                               <h4 className="text-md font-semibold mb-2 text-gray-300">
                                   Top {topProvinces.length} Most Frequent Active Provinces:
                               </h4>
                               <ul className="list-decimal list-inside text-sm text-gray-200 space-y-1 pl-2">
                                   {topProvinces.map((prov) => (
                                       <li key={prov.name}>
                                           {prov.name} <span className="text-xs text-gray-400">({prov.count} times)</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       )}
                       {/* --- End Top 5 Provinces Section --- */}


                       {/* --- Top 5 Active Timestamps Section --- */}
                       {isExpanded && !hadScrapeError && topTimestamps.length > 0 && (
                           <div className="mt-6 pt-4 border-t border-gray-600">
                               <h4 className="text-md font-semibold mb-2 text-gray-300">
                                   Top {topTimestamps.length} Most Active Times (by Province Count):
                               </h4>
                               <ul className="list-decimal list-inside text-sm text-gray-200 space-y-1 pl-2">
                                   {topTimestamps.map((tsInfo) => (
                                       <li key={tsInfo.timestamp}>
                                           {new Date(tsInfo.timestamp).toLocaleString()} {/* Format timestamp */}
                                           <span className="text-xs text-gray-400"> ({tsInfo.count} provinces)</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       )}
                       {/* --- End Top 5 Timestamps Section --- */}


                       {isExpanded && !hadScrapeError && topProvinces.length === 0 && topTimestamps.length === 0 && (
                            <p className="text-sm text-gray-500 italic mt-4">No historical province activity found for this kingdom.</p>
                       )}

                        {/* Message if no active provinces in latest scrape (and no historical data shown) */}
                        {!hadScrapeError && (!activityInfo.provinces || activityInfo.provinces.length === 0) && topProvinces.length === 0 && topTimestamps.length === 0 && (
                             <p className="text-sm text-gray-500 italic mt-2">No active provinces found (*/**) in the latest scrape.</p>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
           <p className="text-center text-gray-500 col-span-full italic">No kingdom-specific data found in the latest snapshot.</p>
      )}
    </div>
  );
}
