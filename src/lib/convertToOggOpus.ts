/**
 * Converts any audio file to OGG Opus format for WhatsApp native voice notes (PTT).
 *
 * Strategy:
 * 1. Firefox: native MediaRecorder with audio/ogg; codecs=opus
 * 2. Chrome/Edge: WebCodecs AudioEncoder + manual OGG container construction
 * 3. Fallback: return original file with warning
 */

// ─── OGG Container Writer ───────────────────────────────────────────────────

function makeOggCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    }
    table[i] = r >>> 0;
  }
  return table;
}

const CRC_TABLE = makeOggCrcTable();

function oggCrc32(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
  }
  return crc;
}

/**
 * Create an OGG page from one or more packets.
 * Each packet becomes a series of segments in the segment table.
 */
function createOggPage(
  serialNumber: number,
  pageSequence: number,
  granulePosition: number,
  headerType: number,
  packets: Uint8Array[]
): Uint8Array {
  // Build segment table entries and collect data
  const segEntries: number[] = [];
  const allData: Uint8Array[] = [];

  for (const packet of packets) {
    let remaining = packet.length;
    let offset = 0;
    while (remaining >= 255) {
      segEntries.push(255);
      allData.push(packet.slice(offset, offset + 255));
      offset += 255;
      remaining -= 255;
    }
    // Final segment (can be 0 if packet was exact multiple of 255)
    segEntries.push(remaining);
    if (remaining > 0) {
      allData.push(packet.slice(offset));
    }
  }

  const dataSize = allData.reduce((s, c) => s + c.length, 0);
  const headerSize = 27 + segEntries.length;
  const page = new Uint8Array(headerSize + dataSize);
  const view = new DataView(page.buffer);

  // Capture pattern "OggS"
  page[0] = 0x4f;
  page[1] = 0x67;
  page[2] = 0x67;
  page[3] = 0x53;
  page[4] = 0; // version
  page[5] = headerType;

  // Granule position (64-bit LE) — use only low 32 bits for typical audio
  view.setUint32(6, granulePosition >>> 0, true);
  view.setUint32(10, granulePosition > 0xffffffff ? Math.floor(granulePosition / 0x100000000) : 0, true);

  view.setUint32(14, serialNumber, true);
  view.setUint32(18, pageSequence, true);
  view.setUint32(22, 0, true); // CRC placeholder
  page[26] = segEntries.length;

  // Segment table
  for (let i = 0; i < segEntries.length; i++) {
    page[27 + i] = segEntries[i];
  }

  // Data
  let off = headerSize;
  for (const chunk of allData) {
    page.set(chunk, off);
    off += chunk.length;
  }

  // Compute and set CRC
  view.setUint32(22, oggCrc32(page), true);

  return page;
}

function createOpusHead(channels: number, preSkip: number, inputSampleRate: number): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);
  // "OpusHead"
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]);
  head[8] = 1; // version
  head[9] = channels;
  view.setUint16(10, preSkip, true);
  view.setUint32(12, inputSampleRate, true);
  view.setUint16(16, 0, true); // output gain
  head[18] = 0; // channel mapping family
  return head;
}

function createOpusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("JurisZap");
  const buf = new Uint8Array(8 + 4 + vendor.length + 4);
  const view = new DataView(buf.buffer);
  // "OpusTags"
  buf.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]);
  view.setUint32(8, vendor.length, true);
  buf.set(vendor, 12);
  view.setUint32(12 + vendor.length, 0, true); // no comments
  return buf;
}

function buildOggOpusFile(opusFrames: Uint8Array[], channels: number, preSkip: number): Uint8Array {
  const serialNumber = (Math.random() * 0xffffffff) >>> 0;
  const FRAME_DURATION_SAMPLES = 960; // 20ms at 48kHz
  const pages: Uint8Array[] = [];
  let pageSeq = 0;

  // Page 0: OpusHead (BOS = 0x02)
  pages.push(createOggPage(serialNumber, pageSeq++, 0, 0x02, [createOpusHead(channels, preSkip, 48000)]));

  // Page 1: OpusTags
  pages.push(createOggPage(serialNumber, pageSeq++, 0, 0x00, [createOpusTags()]));

  // Audio pages — batch up to 100 frames (~2 seconds) per page
  const FRAMES_PER_PAGE = 100;
  let granulePos = 0;

  for (let i = 0; i < opusFrames.length; i += FRAMES_PER_PAGE) {
    const batch = opusFrames.slice(i, i + FRAMES_PER_PAGE);
    granulePos += batch.length * FRAME_DURATION_SAMPLES;

    const isLast = i + FRAMES_PER_PAGE >= opusFrames.length;
    const headerType = isLast ? 0x04 : 0x00; // EOS on last page

    pages.push(createOggPage(serialNumber, pageSeq++, granulePos, headerType, batch));
  }

  // Combine pages
  const totalSize = pages.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const page of pages) {
    result.set(page, offset);
    offset += page.length;
  }
  return result;
}

// ─── Audio Decoding & Resampling ─────────────────────────────────────────────

async function decodeToPcm48kMono(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const tempCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    await tempCtx.close();
  }

  // Resample to 48kHz mono using OfflineAudioContext
  const numFrames = Math.ceil(decoded.duration * 48000);
  const offlineCtx = new OfflineAudioContext(1, numFrames, 48000);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
}

// ─── Method 1: MediaRecorder (Firefox) ───────────────────────────────────────

async function convertWithMediaRecorder(pcm: Float32Array, originalName: string): Promise<File> {
  // Create AudioBuffer at 48kHz mono
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, pcm.length, 48000);
  buffer.getChannelData(0).set(pcm);

  const dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);

  const recorder = new MediaRecorder(dest.stream, {
    mimeType: "audio/ogg; codecs=opus",
    audioBitsPerSecond: 64000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const blob = await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/ogg" }));
    recorder.onerror = () => reject(new Error("MediaRecorder error"));
    recorder.start();
    src.start();
    src.onended = () => setTimeout(() => recorder.state === "recording" && recorder.stop(), 200);
  });

  await ctx.close();

  const baseName = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.ogg`, { type: "audio/ogg" });
}

// ─── Method 2: WebCodecs AudioEncoder + OGG container (Chrome) ───────────────

async function convertWithWebCodecs(pcm: Float32Array, originalName: string): Promise<File> {
  const FRAME_SIZE = 960; // 20ms at 48kHz
  const opusFrames: Uint8Array[] = [];

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      opusFrames.push(data);
    },
    error: (e) => console.error("AudioEncoder error:", e),
  });

  encoder.configure({
    codec: "opus",
    sampleRate: 48000,
    numberOfChannels: 1,
    bitrate: 64000,
  });

  // Feed PCM in 20ms frames
  for (let i = 0; i < pcm.length; i += FRAME_SIZE) {
    const frameLen = Math.min(FRAME_SIZE, pcm.length - i);
    const frameData = new Float32Array(FRAME_SIZE);
    frameData.set(pcm.subarray(i, i + frameLen));

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: 48000,
      numberOfFrames: FRAME_SIZE,
      numberOfChannels: 1,
      timestamp: Math.round((i / 48000) * 1_000_000),
      data: frameData,
    });

    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();

  if (opusFrames.length === 0) {
    throw new Error("Nenhum frame Opus foi produzido pelo encoder");
  }

  console.log(`WebCodecs encoded ${opusFrames.length} Opus frames`);

  // Build OGG container
  const preSkip = 312;
  const oggData = buildOggOpusFile(opusFrames, 1, preSkip);

  const baseName = originalName.replace(/\.[^.]+$/, "");
  return new File([new Blob([oggData])], `${baseName}.ogg`, { type: "audio/ogg" });
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function convertToOggOpus(file: File): Promise<File> {
  // If already OGG, skip conversion
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    console.log("File is already OGG, skipping conversion");
    return file;
  }

  console.log(`Converting ${file.name} (${file.type}) to OGG Opus...`);

  // Decode & resample to 48kHz mono PCM
  const pcm = await decodeToPcm48kMono(file);
  console.log(`Decoded to ${pcm.length} PCM samples (${(pcm.length / 48000).toFixed(1)}s)`);

  // Method 1: MediaRecorder OGG Opus (Firefox)
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) {
    console.log("Using MediaRecorder (native OGG Opus support)");
    return convertWithMediaRecorder(pcm, file.name);
  }

  // Method 2: WebCodecs AudioEncoder + manual OGG (Chrome/Edge)
  if (typeof AudioEncoder !== "undefined") {
    console.log("Using WebCodecs AudioEncoder + OGG container");
    return convertWithWebCodecs(pcm, file.name);
  }

  // No encoder available
  console.warn("No OGG Opus encoder available in this browser. Audio may not appear as voice note.");
  return file;
}
