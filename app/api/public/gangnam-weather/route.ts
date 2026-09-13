import "server-only";
import { NextResponse } from "next/server";
import { createGangnamWeatherSource } from "@/lib/gangnam-weather-source";

export const dynamic = "force-dynamic";
const getWeather = createGangnamWeatherSource();

export async function GET() {
  const weather = await getWeather();
  return NextResponse.json({ weather }, {
    status: weather ? 200 : 503,
    headers: {
      "Cache-Control": weather ? "public, max-age=300, s-maxage=600, stale-while-revalidate=60" : "public, max-age=60, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
