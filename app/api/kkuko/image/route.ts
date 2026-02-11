import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  const controller = new AbortController();
  const signal = controller.signal;

  const timer = setTimeout(() => controller.abort(), 5000);

  if (!imageUrl) {
    return new Response("Missing image url", { status: 400 });
  }

  if (!imageUrl.startsWith("https://cdn.kkutu.co.kr/img/")) {
    return new Response("Invalid image url", { status: 400 });
  }

  const imageResponse = await fetch(imageUrl, { signal }).finally(() => clearTimeout(timer));

  if (!imageResponse.ok) {
    return new Response("Failed to fetch image", {
      status: imageResponse.status,
    });
  }

  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const buffer = await imageResponse.arrayBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, s-maxage=31536000, max-age=86400, stale-while-revalidate=59",
    },
  });
}
