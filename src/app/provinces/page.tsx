// src/app/province-activity/page.tsx
// This component fetches and displays province activity data from Firebase,
// including a summary section and expandable kingdom cards.
"use client"; // Marking as client component

import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, get, Database } from 'firebase/database';

// --- Type Definitions ---
type ProvinceActivityData = {
  provinces: string[];
  fetchedDate: string;
};

type KingdomActivityData = {
  [kingdomIslandKey: string]: ProvinceActivityData;
};

type ScrapedActivityData = {
  [timestamp: string]: KingdomActivityData;
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

// --- Firebase Initialization (Client-Side Safe) ---
let app: FirebaseApp;
let db: Database;

if (typeof window !== 'undefined' && !getApps().length) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
        console.error("❌ Firebase configuration environment variables (prefixed with NEXT_PUBLIC_) are missing!");
    } else {
        try {
            app = initializeApp(firebaseConfig);
            db = getDatabase(app);
            console.log("🔥 Firebase Initialized Successfully on Client.");
        } catch (error) {
             console.error("❌ Failed to initialize Firebase on Client:", error);
        }
    }
} else if (getApps().length > 0) {
    app = getApps()[0];
    db = getDatabase(app);
}

// --- Data Fetching Hook ---
function useProvinceActivity() {
  const [kingdomData, setKingdomData] = useState<KingdomActivityData | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!db) {
          console.warn("Firebase DB not ready yet.");
          setIsLoading(false);
          setError("Firebase connection not established.");
          return;
      }

      const dbRef = ref(db, 'province_data');
      try {
        console.log("➡️ Fetching province activity data from Firebase...");
        const snapshot = await get(dbRef);

        if (snapshot.exists()) {
          const data = snapshot.val() as ScrapedActivityData;
          const latestTimestamp = Object.keys(data)[0];

          if (latestTimestamp && data[latestTimestamp]) {
             console.log(`✅ Data found for timestamp: ${latestTimestamp}`);
             setKingdomData(data[latestTimestamp]);
             setTimestamp(latestTimestamp);
          } else {
              console.warn("⚠️ Data format unexpected. No valid timestamp key found under 'province_data'.");
              setError("Unexpected data format received.");
              setKingdomData(null);
          }
        } else {
          console.log("ℹ️ No province activity data available at Firebase path: province_data");
          setError("No activity data found.");
          setKingdomData(null);
        }
      } catch (fetchError: any) {
        console.error("❌ Error fetching data from Firebase:", fetchError);
        setError(`Failed to fetch data: ${fetchError.message}`);
        setKingdomData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return { kingdomData, timestamp, isLoading, error };
}


// --- The Page Component (Client Component) ---
export default function ProvinceActivityPage() {
  const { kingdomData, timestamp, isLoading, error } = useProvinceActivity();
  // State to track expanded kingdom cards
  const [expandedKingdoms, setExpandedKingdoms] = useState<Set<string>>(new Set());

  // Function to toggle kingdom card expansion
  const toggleKingdomExpansion = (kingdomKey: string) => {
    setExpandedKingdoms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kingdomKey)) {
        newSet.delete(kingdomKey);
      } else {
        newSet.add(kingdomKey);
      }
      return newSet;
    });
  };


  // --- Calculate Consolidated Activity Data ---
  const consolidatedActivity = useMemo(() => {
    if (!kingdomData) {
      return { totalActive: 0, uniqueActiveProvinces: [] };
    }
    let totalActiveCount = 0;
    const uniqueProvinces = new Set<string>();
    Object.values(kingdomData).forEach(activityInfo => {
      if (activityInfo.provinces && activityInfo.provinces.length > 0) {
        totalActiveCount += activityInfo.provinces.length;
        activityInfo.provinces.forEach(provinceName => {
          uniqueProvinces.add(provinceName);
        });
      }
    });
    return {
      totalActive: totalActiveCount,
      uniqueActiveProvinces: Array.from(uniqueProvinces).sort()
    };
  }, [kingdomData]);


  // --- Render Logic ---

  // Handle Loading State
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4 text-yellow-400">Province Activity</h1>
        <p className="text-lg animate-pulse">Loading activity data...</p>
      </div>
    );
  }

  // Handle Error State
  if (error) {
    return (
      <div className="p-4 md:p-8 min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4 text-yellow-400">Province Activity</h1>
        <p className="text-red-500 text-lg">Error: {error}</p>
        <p className="text-gray-400 mt-2">
          Please ensure the scraper is running, Firebase configuration is correct (using NEXT_PUBLIC_ prefixes), and database rules allow access.
        </p>
      </div>
    );
  }

  const lastUpdatedDate = timestamp ? new Date(parseInt(timestamp)).toLocaleString() : 'N/A';

  // Sort kingdom keys for the grid display
  const sortedKingdomKeys = kingdomData ? Object.keys(kingdomData).sort((a, b) => {
      const [kdA, isA] = a.split(':').map(Number);
      const [kdB, isB] = b.split(':').map(Number);
      if (kdA !== kdB) return kdA - kdB;
      return isA - isB;
  }) : [];

  // Render Data
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-center text-yellow-400">
        Utopia Province Activity Monitor
      </h1>
      <p className="text-center text-sm text-gray-400 mb-6">
        Last Scrape Time: {lastUpdatedDate}
      </p>

      {/* --- Consolidated Activity Section --- */}
      <div className="mb-8 p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-semibold mb-3 text-center text-yellow-500">
          Overall Activity Summary
        </h2>
        {kingdomData ? (
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
                    <p className="text-center text-gray-500 italic">No unique active provinces listed.</p>
                )}
            </>
        ) : (
             <p className="text-center text-gray-500 italic">No data loaded to calculate summary.</p>
        )}
      </div>
      {/* --- End Consolidated Activity Section --- */}


      {/* Grid layout for individual kingdom cards */}
      <h2 className="text-2xl font-semibold mb-4 text-center text-yellow-400">
        Activity by Kingdom
      </h2>
      {kingdomData && sortedKingdomKeys.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedKingdomKeys.map((kingdomKey) => {
              const [kingdomId, islandId] = kingdomKey.split(':');
              const activityInfo = kingdomData[kingdomKey];
              const isExpanded = expandedKingdoms.has(kingdomKey); // Check if this card is expanded

              if (!activityInfo) return null;

              return (
                // Individual kingdom card container
                <div
                  key={kingdomKey}
                  className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden" // Added overflow-hidden
                >
                  {/* Clickable Header Area */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-700 transition-colors duration-200 flex justify-between items-center"
                    onClick={() => toggleKingdomExpansion(kingdomKey)} // Toggle on click
                  >
                    <div>
                      <h3 className="text-xl font-semibold text-yellow-500">
                        Kingdom {kingdomId}:{islandId}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Game Date: {activityInfo.fetchedDate || 'N/A'}
                      </p>
                       <p className="text-sm text-gray-300 mt-1">
                        Active Provinces: {activityInfo.provinces?.length ?? 0}
                      </p>
                    </div>
                    {/* Expand/Collapse Icon */}
                    <span className="text-xl font-bold text-gray-400">
                      {isExpanded ? '-' : '+'}
                    </span>
                  </div>

                  {/* Expandable Content Area */}
                  {/* Use CSS transition for smooth expand/collapse */}
                  <div
                    className={`transition-max-height duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-0'}`} // Adjust max-h as needed
                  >
                    <div className="p-4 border-t border-gray-700"> {/* Add padding and border */}
                      {activityInfo.provinces && activityInfo.provinces.length > 0 ? (
                        <div>
                          <h4 className="text-md font-medium mb-2 text-gray-300">
                            Currently Active Provinces:
                          </h4>
                          <ul className="list-disc list-inside text-sm text-gray-200 space-y-1 pl-2 max-h-48 overflow-y-auto">
                            {activityInfo.provinces.sort().map((province, index) => (
                              <li key={index} className="break-words">{province}</li>
                            ))}
                          </ul>
                           <p className="text-xs text-gray-500 italic mt-3">
                                Note: Activity graph will be shown here when historical data is available.
                           </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No active provinces found (*/**) in the latest scrape.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
           <p className="text-center text-gray-500 col-span-full italic">No kingdom-specific data to display.</p>
      )}
    </div>
  );
}
