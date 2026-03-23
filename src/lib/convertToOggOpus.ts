/**
 * Converts any audio file to OGG Opus format using the Web Audio API + MediaRecorder.
 * This ensures audio files are always sent as native WhatsApp voice notes (PTT).
 */
export async function convertToOggOpus(file: File): Promise<File> {
  // Check if MediaRecorder supports OGG Opus
  const mimeType = "audio/ogg; codecs=opus";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    console.warn("Browser does not support OGG Opus recording, using original file");
    return file;
  }

  // If already OGG, skip conversion
  if (file.type === "audio/ogg" || file.name.endsWith(".ogg")) {
    console.log("File is already OGG, skipping conversion");
    return file;
  }

  console.log(`Converting ${file.name} (${file.type}) to OGG Opus...`);

  // Decode the source audio
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.error("Failed to decode audio:", err);
    await audioContext.close();
    throw new Error("Não foi possível decodificar o arquivo de áudio. Verifique o formato.");
  }

  // Use a new AudioContext to play the decoded buffer into a MediaRecorder
  const playbackCtx = new AudioContext();
  const destination = playbackCtx.createMediaStreamDestination();
  const source = playbackCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(destination);

  const recorder = new MediaRecorder(destination.stream, {
    mimeType,
    audioBitsPerSecond: 64000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const convertedBlob = await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/ogg" });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);

    recorder.start();
    source.start();

    source.onended = () => {
      // Small delay to ensure all data is captured
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 150);
    };
  });

  await audioContext.close();
  await playbackCtx.close();

  // Build a new File with .ogg extension
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const newFile = new File([convertedBlob], `${baseName}.ogg`, {
    type: "audio/ogg",
  });

  console.log(`Conversion complete: ${file.name} (${file.size}b) → ${newFile.name} (${newFile.size}b)`);
  return newFile;
}
