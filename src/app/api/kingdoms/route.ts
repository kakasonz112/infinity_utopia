// app/api/kingdoms/route.ts
export async function GET(req: Request) {
    try {
      const response = await fetch("https://utopia-game.com/wol/game/kingdoms_dump_v2/");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
  
      const data = await response.json();
      return new Response(JSON.stringify(data), {
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
  