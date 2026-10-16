import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SECONDS = 240;
const CHUNK = 8 * 1024 * 1024;

let ffmpegPromise = null;
let onEncode = () => {};

function fail(message) {
  const error = new Error(message);
  error.reel = true;
  throw error;
}

function googleMessage(text, fallback) {
  const raw = String(text || "");
  if (/quota|exceeded|uploadLimitExceeded/i.test(raw)) {
    return "Το YouTube έπιασε το ημερήσιο όριο. Για σήμερα χρησιμοποίησε το The Old Way.";
  }
  try {
    const data = JSON.parse(raw);
    const message = data?.error?.message || data?.error_description || "";
    if (message && message.length < 180) return message;
  } catch {
    /* The body was not JSON. */
  }
  return fallback;
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function preload(url, onRatio) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error("download");
  const total = Number(response.headers.get("content-length")) || 32 * 1024 * 1024;
  const reader = response.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    onRatio(Math.min(1, received / total));
  }
}

async function engine(onProgress) {
  if (!ffmpegPromise) {
    const report = onProgress || (() => {});
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => onEncode(progress));
      const core = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
      report(0.02);
      await preload(`${core}/ffmpeg-core.wasm`, (ratio) => report(0.05 + ratio * 0.85));
      await withTimeout(
        ffmpeg.load({
          classWorkerURL: new URL("/admin/vendor/ffmpeg-worker.js", window.location.origin).href,
          coreURL: `${core}/ffmpeg-core.js`,
          wasmURL: `${core}/ffmpeg-core.wasm`,
        }),
        90000,
        "Ο επεξεργαστής δεν άνοιξε. Κάνε ανανέωση και ξαναπροσπάθησε, ή χρησιμοποίησε το The Old Way."
      );
      report(1);
      return ffmpeg;
    })().catch((err) => {
      ffmpegPromise = null;
      console.error("[myreels/reel] load", err);
      const message = String(err?.message || "");
      if (!message || message === "download" || /failed to fetch|network/i.test(message)) {
        throw new Error("Ο επεξεργαστής δεν κατέβηκε. Έλεγξε τη σύνδεση και ξαναπροσπάθησε, ή χρησιμοποίησε το The Old Way.");
      }
      throw new Error(message);
    });
  }
  return ffmpegPromise;
}

function videoInfo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!width || !height) reject(new Error("Το βίντεο δεν διαβάστηκε."));
      else resolve({ width, height, duration });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Το βίντεο δεν διαβάστηκε. Χρησιμοποίησε mp4 ή mov."));
    };
    video.src = url;
  });
}

function stampFilter(duration, markW, hasAudio) {
  const third = Math.round((duration * 2) / 3 * 1000) / 1000;
  const thirdEnd = Math.round((third + 6) * 1000) / 1000;
  const delay2 = Math.round(third * 1000);
  const video = `[1:v]format=rgba,colorchannelmixer=aa=0.35,scale=${markW}:-2[wm];[0:v][wm]overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t,4,10)+between(t,${third},${thirdEnd})'[vout];`;
  const voice = (index, delay) =>
    `[${index}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay},apad,aformat=channel_layouts=stereo`;
  if (!hasAudio) {
    return `${video}${voice(2, 6000)}[v1];${voice(3, delay2)}[v2];[v1][v2]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=0:${duration}[aout]`;
  }
  return `${video}[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,aformat=channel_layouts=stereo[base];${voice(2, 6000)}[v1];${voice(3, delay2)}[v2];[v1][v2]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3[voices];[base][voices]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3,atrim=0:${duration}[aout]`;
}

async function sourceHasAudio(ffmpeg, inputName) {
  const lines = [];
  const onLog = ({ message }) => lines.push(String(message || ""));
  ffmpeg.on("log", onLog);
  await ffmpeg.exec(["-hide_banner", "-i", inputName]);
  if (typeof ffmpeg.off === "function") ffmpeg.off("log", onLog);
  return lines.some((line) => /\bAudio:/.test(line));
}

async function watermarked(file, markUrl, onProgress) {
  if (file.size > MAX_BYTES) {
    fail("Το αρχείο είναι μεγάλο για επεξεργασία εδώ. Χρησιμοποίησε το The Old Way.");
  }
  const info = await videoInfo(file);
  if (!Number.isFinite(info.duration) || info.duration <= 10) {
    fail("Το βίντεο είναι πολύ μικρό για το σήμα και τα ηχητικά.");
  }
  if (info.duration > MAX_SECONDS) {
    fail("Το βίντεο είναι πάνω από 4 λεπτά. Για τόσο μεγάλο αρχείο χρησιμοποίησε το The Old Way.");
  }
  onProgress({ phase: "load", ratio: 0 });
  const ffmpeg = await engine((ratio) => onProgress({ phase: "load", ratio }));
  onEncode = (progress) => onProgress({ phase: "encode", ratio: Math.max(0, Math.min(1, progress || 0)) });
  const ext = (/\.([a-z0-9]{2,4})$/i.exec(file.name || "") || [])[1]?.toLowerCase() || "mp4";
  const inputName = `in.${ext}`;
  const markW = Math.max(240, Math.round((info.width * 0.72) / 2) * 2);
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.writeFile("mark.png", await fetchFile(markUrl));
  await ffmpeg.writeFile("voice1.mp3", await fetchFile("/admin/brand/1-demo.mp3"));
  await ffmpeg.writeFile("voice2.mp3", await fetchFile("/admin/brand/2-demo.mp3"));
  const hasAudio = await sourceHasAudio(ffmpeg, inputName);
  const code = await ffmpeg.exec([
    "-i",
    inputName,
    "-i",
    "mark.png",
    "-i",
    "voice1.mp3",
    "-i",
    "voice2.mp3",
    "-filter_complex",
    stampFilter(Math.round(info.duration * 1000) / 1000, markW, hasAudio),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "out.mp4",
  ]);
  if (code !== 0) fail("Το αντίγραφο με το σήμα δεν φτιάχτηκε. Χρησιμοποίησε το The Old Way.");
  const data = await ffmpeg.readFile("out.mp4");
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile("mark.png").catch(() => {});
  await ffmpeg.deleteFile("voice1.mp3").catch(() => {});
  await ffmpeg.deleteFile("voice2.mp3").catch(() => {});
  await ffmpeg.deleteFile("out.mp4").catch(() => {});
  onEncode = () => {};
  return new Blob([data], { type: "video/mp4" });
}

function putChunks(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const send = (offset) => {
      const end = Math.min(offset + CHUNK, blob.size);
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");
      xhr.setRequestHeader("Content-Range", `bytes ${offset}-${end - 1}/${blob.size}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress((offset + event.loaded) / blob.size);
      };
      xhr.onload = () => {
        if (xhr.status === 308) {
          send(end);
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}"));
          } catch {
            resolve({});
          }
          return;
        }
        reject(new Error(googleMessage(xhr.responseText, "Το ανέβασμα κόπηκε.")));
      };
      xhr.onerror = () => reject(new Error("Το ανέβασμα κόπηκε. Έλεγξε τη σύνδεση και ξαναπροσπάθησε."));
      xhr.send(blob.slice(offset, end));
    };
    send(0);
  });
}

async function session(token, endpoint, metadata, blob) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": blob.type || "video/mp4",
      "X-Upload-Content-Length": String(blob.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) {
    fail(googleMessage(await response.text(), "Η Google δεν άνοιξε το ανέβασμα."));
  }
  const location = response.headers.get("Location");
  if (!location) fail("Η Google δεν άνοιξε το ανέβασμα.");
  return location;
}

async function access(creds, service) {
  const response = await fetch("/api/google-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...creds, action: "access", service }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.accessToken) fail(data.error || "Η σύνδεση δεν είναι έτοιμη.");
  return data;
}

async function uploadDrive(creds, file, name, onProgress) {
  const gate = await access(creds, "drive");
  const safe = String(name || "reel").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "reel";
  const ext = (/\.([a-z0-9]{2,4})$/i.exec(file.name || "") || [])[1]?.toLowerCase() || "mp4";
  const location = await session(
    gate.accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    { name: `${safe}.${ext}`, parents: gate.folderId ? [gate.folderId] : undefined, mimeType: file.type || "video/mp4" },
    file
  );
  const saved = await putChunks(location, file, onProgress);
  if (!saved.id) fail("Το αρχείο δεν μπήκε στο Drive.");
  const share = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(saved.id)}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gate.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!share.ok) fail("Το αρχείο μπήκε στο Drive, αλλά ο αγοραστής δεν μπορεί να το ανοίξει ακόμα.");
  return saved.id;
}

async function uploadYouTube(creds, blob, title, onProgress) {
  const gate = await access(creds, "youtube");
  const location = await session(
    gate.accessToken,
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false",
    {
      snippet: {
        title: String(title || "Reel").slice(0, 100),
        description: "LuxuryStayReels demo",
        categoryId: "19",
      },
      status: {
        privacyStatus: "unlisted",
        embeddable: true,
        selfDeclaredMadeForKids: false,
      },
    },
    blob
  );
  const saved = await putChunks(location, blob, onProgress);
  if (!saved.id) fail("Το αντίγραφο δεν ανέβηκε στο YouTube.");
  return saved.id;
}

window.MyReelsUpload = {
  async run({ file, markUrl, name, creds, onProgress }) {
    const report = onProgress || (() => {});
    const copy = await watermarked(file, markUrl, report);
    report({ phase: "drive", ratio: 0 });
    let driveId = "";
    try {
      driveId = await uploadDrive(creds, file, name, (ratio) => report({ phase: "drive", ratio }));
    } catch (err) {
      throw err;
    }
    report({ phase: "youtube", ratio: 0 });
    try {
      const videoId = await uploadYouTube(creds, copy, name, (ratio) => report({ phase: "youtube", ratio }));
      return {
        driveId,
        driveUrl: `https://drive.google.com/file/d/${driveId}/view`,
        videoId,
        youtubeUrl: `https://youtu.be/${videoId}`,
      };
    } catch (err) {
      err.driveUrl = `https://drive.google.com/file/d/${driveId}/view`;
      throw err;
    }
  },
};
