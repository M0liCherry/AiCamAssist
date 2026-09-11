import { HttpError } from "@/lib/http";

export type ParsedSource = { title: string; text: string; sourceType: string; sourceLabel: string };

const MAX_TEXT_CHARS = 1_500_000;
const MAX_FILE_BYTES = 60 * 1024 * 1024;
const MAX_REMOTE_BYTES = 15 * 1024 * 1024;

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©" };

export function decodeEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export function titleFromFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Untitled note";
}

export function htmlToText(html: string) {
  let source = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|canvas|iframe|template)[\s\S]*?<\/\1>/gi, "");
  const main = source.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i);
  if (main && main[2].length > 500) source = main[2];
  source = source
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\s*h([1-6])[^>]*>/gi, (_, level: string) => `\n${"#".repeat(Number(level))} `)
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/blockquote|\/pre|\/table)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(source);
}

function extractTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return decodeEntities((og || title || "").trim());
}

/** Groups a run-on transcript into readable paragraphs. */
export function paragraphize(text: string, target = 700) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence;
    if (current.length >= target) {
      paragraphs.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs.join("\n\n");
}

async function extractPdf(buffer: Buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return result.text;
}

async function extractDocx(buffer: Buffer) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPptx(buffer: Buffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideNumber = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  const sections: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.file(name)!.async("string");
    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((part) => Array.from(part.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)).map((m) => decodeEntities(m[1])).join(""))
      .map((line) => line.trim())
      .filter(Boolean);
    if (paragraphs.length) sections.push(`## Slide ${slideNumber(name)}\n${paragraphs.join("\n")}`);
  }
  return sections.join("\n\n");
}

export async function parseUploadedFile(file: File): Promise<ParsedSource> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.size > MAX_FILE_BYTES) throw new HttpError(`${file.name} is larger than 60 MB.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  switch (extension) {
    case "pdf":
      text = await extractPdf(buffer);
      break;
    case "docx":
      text = await extractDocx(buffer);
      break;
    case "pptx":
      text = await extractPptx(buffer);
      break;
    case "html":
    case "htm":
      text = htmlToText(buffer.toString("utf8"));
      break;
    case "txt":
    case "md":
    case "markdown":
    case "csv":
    case "json":
    case "rtf":
      text = buffer.toString("utf8");
      break;
    case "doc":
    case "ppt":
      throw new HttpError(`Legacy .${extension} files are not supported. Save the file as .${extension}x in Office and import again.`);
    default:
      throw new HttpError(`Unsupported file type ".${extension}". Supported: PDF, DOCX, PPTX, TXT, MD, HTML.`);
  }
  text = normalizeText(text);
  if (!text) throw new HttpError(`No readable text was found in ${file.name}. Scanned PDFs need OCR before import.`);
  return { title: titleFromFilename(file.name), text: text.slice(0, MAX_TEXT_CHARS), sourceType: "document", sourceLabel: file.name };
}

async function fetchRemote(url: string, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NitroAI/1.0 study-import",
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "accept-language": "en",
      },
    });
    if (!response.ok) throw new HttpError(`The page responded with HTTP ${response.status}.`, 502);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_REMOTE_BYTES) throw new HttpError("The page is larger than 15 MB and was not imported.", 413);
    return response;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const name = (error as { name?: string })?.name;
    throw new HttpError(name === "AbortError" ? "The page took too long to respond." : "The page could not be fetched. Check the address and your connection.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
    return match ? match[1] : null;
  }
  return null;
}

/** Extracts a JSON array that follows `"key":` using bracket matching (string-aware). */
function extractJsonArray(source: string, key: string): string | null {
  const start = source.indexOf(`"${key}":`);
  if (start === -1) return null;
  let index = source.indexOf("[", start);
  if (index === -1) return null;
  const begin = index;
  let depth = 0;
  let inString = false;
  for (; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (char === "\\") index++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) return source.slice(begin, index + 1);
    }
  }
  return null;
}

async function importYoutube(videoId: string, original: string): Promise<ParsedSource> {
  const page = await (await fetchRemote(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`)).text();
  const rawTitle = page.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? page.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, "");
  const title = decodeEntities(rawTitle || `YouTube video ${videoId}`);
  const tracksJson = extractJsonArray(page, "captionTracks");
  if (!tracksJson) {
    throw new HttpError("This video has no captions available, so a transcript cannot be imported. Paste the transcript as text instead.", 422);
  }
  let tracks: { baseUrl: string; languageCode?: string; kind?: string }[] = [];
  try {
    tracks = JSON.parse(tracksJson) as typeof tracks;
  } catch {
    throw new HttpError("YouTube caption metadata could not be read.", 502);
  }
  const track = tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ?? tracks.find((t) => t.languageCode?.startsWith("en")) ?? tracks[0];
  if (!track?.baseUrl) throw new HttpError("No usable caption track was found for this video.", 422);
  const xml = await (await fetchRemote(track.baseUrl)).text();
  const lines = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map((m) => decodeEntities(decodeEntities(m[1]).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!lines.length) throw new HttpError("The caption track was empty.", 422);
  return { title, text: paragraphize(lines.join(" ")).slice(0, MAX_TEXT_CHARS), sourceType: "youtube", sourceLabel: original };
}

export async function importFromUrl(rawUrl: string): Promise<ParsedSource> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new HttpError("Enter a valid http(s) address.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new HttpError("Only http and https links are supported.");
  const videoId = youtubeId(url);
  if (videoId) return importYoutube(videoId, url.toString());

  const response = await fetchRemote(url.toString());
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    const text = normalizeText(await extractPdf(Buffer.from(await response.arrayBuffer())));
    if (!text) throw new HttpError("The linked PDF contained no readable text.", 422);
    return { title: titleFromFilename(url.pathname.split("/").pop() || url.hostname), text: text.slice(0, MAX_TEXT_CHARS), sourceType: "website", sourceLabel: url.toString() };
  }
  const html = await response.text();
  const text = normalizeText(contentType.includes("text/plain") ? html : htmlToText(html));
  if (text.length < 40) throw new HttpError("The page returned no readable article text. It may require sign-in or render content with scripts.", 422);
  return { title: extractTitle(html) || url.hostname, text: text.slice(0, MAX_TEXT_CHARS), sourceType: "website", sourceLabel: url.toString() };
}
