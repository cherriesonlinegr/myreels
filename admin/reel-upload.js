import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

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

async function engine() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => onEncode(progress));
      const core = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
      const worker = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${core}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${core}/ffmpeg-core.wasm`, "application/wasm"),
        classWorkerURL: await toBlobURL(worker, "text/javascript"),
      });
      return ffmpeg;
    })().catch((err) => {
      ffmpegPromise = null;
      console.error("[myreels/reel] load", err);
      throw new Error("Ο επεξεργαστής βίντεο δεν φορτώθηκε. Ξαναπροσπάθησε ή χρησιμοποίησε το The Old Way.");
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

async function watermarked(file, audioUrl, markUrl, onProgress) {
  if (file.size > MAX_BYTES) {
    fail("Το αρχείο είναι μεγάλο για επεξεργασία εδώ. Χρησιμοποίησε το The Old Way.");
  }
  const info = await videoInfo(file);
  if (Number.isFinite(info.duration) && info.duration > MAX_SECONDS) {
    fail("Το βίντεο είναι πάνω από 4 λεπτά. Για τόσο μεγάλο αρχείο χρησιμοποίησε το The Old Way.");
  }
  onProgress({ phase: "load", ratio: 0 });
  const ffmpeg = await engine();
  onEncode = (progress) => onProgress({ phase: "encode", ratio: Math.max(0, Math.min(1, progress || 0)) });
  const ext = (/\.([a-z0-9]{2,4})$/i.exec(file.name || "") || [])[1]?.toLowerCase() || "mp4";
  const inputName = `in.${ext}`;
  const markW = Math.max(240, Math.round((info.width * 0.72) / 2) * 2);
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.writeFile("mark.png", await fetchFile(markUrl));
  await ffmpeg.writeFile("bed.mp3", await fetchFile(audioUrl));
  const code = await ffmpeg.exec([
    "-i",
    inputName,
    "-i",
    "mark.png",
    "-stream_loop",
    "-1",
    "-i",
    "bed.mp3",
    "-filter_complex",
    `[1:v]scale=${markW}:-2[wm];[0:v][wm]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2:format=auto[v]`,
    "-map",
    "[v]",
    "-map",
    "2:a:0",
    "-shortest",
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
  await ffmpeg.deleteFile("bed.mp3").catch(() => {});
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
  async run({ file, audioUrl, markUrl, name, creds, onProgress }) {
    const report = onProgress || (() => {});
    const copy = await watermarked(file, audioUrl, markUrl, report);
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
