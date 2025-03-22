// app/api/kingdoms/route.ts
export async function GET(req: Request) {
  try {
    const response = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/");
    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }

    const data = await response.json();

    // Find the kingdom with the biggest land and networth
    let biggestLandKingdom = null;
    let biggestNetworthKingdom = null;
    let maxLand = 0;
    let maxNetworth = 0;

    if (data && data.kingdoms) {
      for (const kingdom of data.kingdoms) {
        if (kingdom.totalLand > maxLand) {
          maxLand = kingdom.totalLand;
          biggestLandKingdom = kingdom;
        }
        if (kingdom.networth > maxNetworth) {
          maxNetworth = kingdom.networth;
          biggestNetworthKingdom = kingdom;
        }
      }
    }

    // Return the biggest land and networth kingdoms along with all data
    const result = {
      kingdoms: data,
      biggestLandKingdom: biggestLandKingdom,
      biggestNetworthKingdom: biggestNetworthKingdom,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to fetch kingdoms data" }), {
      status: 500,
    });
  }
}