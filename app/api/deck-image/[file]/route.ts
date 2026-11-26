import { ensureImage, IMAGE_FILE_RE } from "@/lib/deck";

/** Serves deck images cached server-side. File names are content hashes, so they are immutable. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!IMAGE_FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  const bytes = await ensureImage(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
