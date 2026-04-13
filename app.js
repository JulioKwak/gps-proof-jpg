let map = null;
let marker = null;
let currentPosition = null;
let currentAccuracy = null;
let currentSourceType = "미선택";
let currentBlob = null;
let convertedBlob = null;
let naverClientId = null;

const els = {
  tabs: document.querySelectorAll(".tab"),
  panes: document.querySelectorAll(".tab-pane"),

  btnGetGps: document.getElementById("btnGetGps"),
  btnResetLocation: document.getElementById("btnResetLocation"),
  btnPreviewCard: document.getElementById("btnPreviewCard"),
  btnSaveJpg: document.getElementById("btnSaveJpg"),
  btnShareJpg: document.getElementById("btnShareJpg"),

  latInput: document.getElementById("latInput"),
  lngInput: document.getElementById("lngInput"),
  accuracyInput: document.getElementById("accuracyInput"),
  timeInput: document.getElementById("timeInput"),
  memoInput: document.getElementById("memoInput"),

  resultCanvas: document.getElementById("resultCanvas"),

  imageFileInput: document.getElementById("imageFileInput"),
  outputFormat: document.getElementById("outputFormat"),
  jpgQuality: document.getElementById("jpgQuality"),
  jpgQualityText: document.getElementById("jpgQualityText"),
  btnConvertImage: document.getElementById("btnConvertImage"),
  btnDownloadConverted: document.getElementById("btnDownloadConverted"),
  btnShareConverted: document.getElementById("btnShareConverted"),
  sourcePreview: document.getElementById("sourcePreview"),
  convertedPreview: document.getElementById("convertedPreview"),
};

init();

function init() {
  bindTabs();
  bindEvents();
  updateStatus("지도를 불러오는 중입니다...");
  syncQualityText();
  drawInitialCanvas();
  loadMapSdkAndInit();
}

function bindTabs() {
  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.tabs.forEach((x) => x.classList.remove("active"));
      els.panes.forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

function bindEvents() {
  els.btnGetGps.addEventListener("click", getCurrentGps);
  els.btnResetLocation.addEventListener("click", resetLocation);
  els.btnPreviewCard.addEventListener("click", generateProofPreview);
  els.btnSaveJpg.addEventListener("click", saveProofJpg);
  els.btnShareJpg.addEventListener("click", shareProofJpg);

  els.jpgQuality.addEventListener("input", syncQualityText);
  els.btnConvertImage.addEventListener("click", convertImageFile);
  els.btnDownloadConverted.addEventListener("click", downloadConvertedFile);
  els.btnShareConverted.addEventListener("click", shareConvertedFile);
}

function syncQualityText() {
  els.jpgQualityText.value = els.jpgQuality.value;
}

function updateStatus(message, isError = false) {
//
}

async function loadMapSdkAndInit() {
  try {
    updateStatus("지도 API 설정을 불러오는 중입니다...");

    if (window.naver && window.naver.maps && map) {
      updateStatus("지도가 이미 준비되어 있습니다.");
      return;
    }

    if (!naverClientId) {
      const res = await fetch("/api/static-map?mode=config");
      if (!res.ok) {
        throw new Error("지도 설정을 불러오지 못했습니다.");
      }

      const data = await res.json();
      if (!data.ok || !data.clientId) {
        throw new Error("Client ID 응답이 올바르지 않습니다.");
      }

      naverClientId = data.clientId;
    }

    if (!window.naver || !window.naver.maps) {
      await loadScript(
        `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverClientId)}`
      );
    }

    initMap();
    updateStatus("지도가 준비되었습니다. 지도 클릭 또는 GPS로 위치를 선택하세요.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "지도 로드 중 오류가 발생했습니다.", true);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

function initMap() {
  const defaultCenter = new naver.maps.LatLng(37.5666103, 126.9783882);

  map = new naver.maps.Map("map", {
    center: defaultCenter,
    zoom: 15,
  });

  marker = new naver.maps.Marker({
    position: defaultCenter,
    map,
    visible: false,
  });

  naver.maps.Event.addListener(map, "click", (e) => {
    const latlng = e.coord;
    setSelectedLocation({
      lat: latlng.y,
      lng: latlng.x,
      accuracy: null,
      sourceType: "지도 클릭",
    });
  });
}

function setSelectedLocation({ lat, lng, accuracy, sourceType }) {
  currentPosition = { lat, lng };
  currentAccuracy = accuracy;
  currentSourceType = sourceType;

  els.latInput.value = Number(lat).toFixed(6);
  els.lngInput.value = Number(lng).toFixed(6);
  els.accuracyInput.value = accuracy == null ? "-" : Number(accuracy).toFixed(1);
  els.timeInput.value = formatDateTime(new Date());

  if (map && marker && window.naver && window.naver.maps) {
    const point = new naver.maps.LatLng(lat, lng);
    marker.setPosition(point);
    marker.setVisible(true);
    map.setCenter(point);
  }

  updateStatus(`${sourceType} 위치가 선택되었습니다.`);
}

function getCurrentGps() {
  if (!navigator.geolocation) {
    updateStatus("이 기기에서는 위치 기능을 지원하지 않습니다.", true);
    return;
  }

  updateStatus("현재 GPS를 불러오는 중입니다...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setSelectedLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        sourceType: "현재 GPS",
      });
    },
    (error) => {
      console.error(error);
      let message = "GPS를 가져오지 못했습니다.";
      if (error.code === 1) message = "위치 권한이 거부되었습니다.";
      if (error.code === 2) message = "위치 정보를 사용할 수 없습니다.";
      if (error.code === 3) message = "위치 요청 시간이 초과되었습니다.";
      updateStatus(message, true);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );
}

function resetLocation() {
  currentPosition = null;
  currentAccuracy = null;
  currentSourceType = "미선택";
  currentBlob = null;

  els.sourceType.value = "미선택";
  els.latInput.value = "";
  els.lngInput.value = "";
  els.accuracyInput.value = "";
  els.timeInput.value = "";
  els.memoInput.value = "";

  if (marker) {
    marker.setVisible(false);
  }

  drawInitialCanvas();
  updateStatus("위치 정보가 초기화되었습니다.");
}

async function generateProofPreview() {
  try {
    if (!currentPosition) {
      throw new Error("먼저 위치를 선택해주세요.");
    }

    updateStatus("지도 포함 JPG 미리보기를 생성하는 중입니다...");

    const memo = (els.memoInput.value || "").trim();
    const timeText = els.timeInput.value || formatDateTime(new Date());

    const staticMapUrl = buildStaticMapUrl(
      currentPosition.lng,
      currentPosition.lat
    );

    const res = await fetch(staticMapUrl);
    if (!res.ok) {
      throw new Error("정적 지도 이미지를 불러오지 못했습니다.");
    }

    const blob = await res.blob();
    const image = await blobToImage(blob);

    const canvas = els.resultCanvas;
    const ctx = canvas.getContext("2d");

    drawProofCanvas(ctx, canvas, {
      mapImage: image,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      accuracy: currentAccuracy,
      sourceType: currentSourceType,
      timeText,
      memo,
    });

    currentBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    updateStatus("미리보기가 생성되었습니다.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "미리보기 생성 중 오류가 발생했습니다.", true);
  }
}

function buildStaticMapUrl(lng, lat) {
  const center = `${lng},${lat}`;
  const marker = `type:d|size:mid|pos:${lng} ${lat}`;
  const params = new URLSearchParams({
    center,
    level: "16",
    w: "1080",
    h: "720",
    maptype: "basic",
    format: "jpg",
    scale: "2",
    markers: marker,
  });

  return `/api/static-map?${params.toString()}`;
}

function drawProofCanvas(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 배경
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 헤더
  roundRect(ctx, 40, 30, canvas.width - 80, 110, 28, "#ffffff");
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("위치 증빙 이미지", 80, 88);
  ctx.fillStyle = "#64748b";
  ctx.font = "26px sans-serif";
  ctx.fillText("GPS Proof JPG", 80, 126);

  // 지도
  roundImage(ctx, data.mapImage, 40, 165, canvas.width - 80, 720, 32);

  // 정보 카드
  roundRect(ctx, 40, 920, canvas.width - 80, 390, 28, "#ffffff");

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("좌표 정보", 76, 980);

  const rows = [
    ["선택 방식", data.sourceType],
    ["위도", Number(data.lat).toFixed(6)],
    ["경도", Number(data.lng).toFixed(6)],
    ["정확도(m)", data.accuracy == null ? "-" : Number(data.accuracy).toFixed(1)],
    ["측정 시각", data.timeText],
    ["비고", data.memo || "-"],
  ];

  let y = 1038;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = "#64748b";
    ctx.font = "24px sans-serif";
    ctx.fillText(label, 76, y);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 24px sans-serif";
    wrapText(ctx, value, 300, y, 700, 32);
    y += 50;
  });

  // 하단 라벨
  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px sans-serif";
  ctx.fillText("Generated by gps-proof-jpg", 76, 1270);
}

async function saveProofJpg() {
  try {
    if (!currentBlob) {
      await generateProofPreview();
    }
    if (!currentBlob) {
      throw new Error("저장할 JPG가 없습니다.");
    }
    downloadBlob(currentBlob, makeFileName("gps-proof", "jpg"));
    updateStatus("JPG 저장을 시작했습니다.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "JPG 저장 중 오류가 발생했습니다.", true);
  }
}

async function shareProofJpg() {
  try {
    if (!currentBlob) {
      await generateProofPreview();
    }
    if (!currentBlob) {
      throw new Error("공유할 JPG가 없습니다.");
    }

    const file = new File([currentBlob], makeFileName("gps-proof", "jpg"), {
      type: "image/jpeg",
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "위치 증빙 이미지",
        files: [file],
      });
      updateStatus("공유를 완료했습니다.");
      return;
    }

    downloadBlob(currentBlob, file.name);
    updateStatus("공유를 지원하지 않아 다운로드로 대체했습니다.");
  } catch (error) {
    console.error(error);
    if (error.name === "AbortError") {
      updateStatus("공유가 취소되었습니다.");
      return;
    }
    updateStatus(error.message || "공유 중 오류가 발생했습니다.", true);
  }
}

async function convertImageFile() {
  try {
    const file = els.imageFileInput.files?.[0];
    if (!file) {
      throw new Error("변환할 이미지를 먼저 선택해주세요.");
    }

    const sourceUrl = URL.createObjectURL(file);
    els.sourcePreview.src = sourceUrl;

    updateStatus("이미지를 변환하는 중입니다...");

    const img = await fileToImage(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // JPG 변환 시 흰 배경 깔기
    if (els.outputFormat.value === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    const quality = parseFloat(els.jpgQuality.value);
    convertedBlob = await canvasToBlob(
      canvas,
      els.outputFormat.value,
      quality
    );

    const previewUrl = URL.createObjectURL(convertedBlob);
    els.convertedPreview.src = previewUrl;

    updateStatus("이미지 변환이 완료되었습니다.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "이미지 변환 중 오류가 발생했습니다.", true);
  }
}

function downloadConvertedFile() {
  try {
    if (!convertedBlob) {
      throw new Error("먼저 변환을 실행해주세요.");
    }

    const ext = els.outputFormat.value === "image/png" ? "png" : "jpg";
    downloadBlob(convertedBlob, makeFileName("converted-image", ext));
    updateStatus("변환 파일 저장을 시작했습니다.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "파일 저장 중 오류가 발생했습니다.", true);
  }
}

async function shareConvertedFile() {
  try {
    if (!convertedBlob) {
      throw new Error("먼저 변환을 실행해주세요.");
    }

    const ext = els.outputFormat.value === "image/png" ? "png" : "jpg";
    const mime = els.outputFormat.value;
    const file = new File([convertedBlob], makeFileName("converted-image", ext), {
      type: mime,
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "변환 이미지",
        files: [file],
      });
      updateStatus("공유를 완료했습니다.");
      return;
    }

    downloadBlob(convertedBlob, file.name);
    updateStatus("공유를 지원하지 않아 다운로드로 대체했습니다.");
  } catch (error) {
    console.error(error);
    if (error.name === "AbortError") {
      updateStatus("공유가 취소되었습니다.");
      return;
    }
    updateStatus(error.message || "공유 중 오류가 발생했습니다.", true);
  }
}

function drawInitialCanvas() {
  const canvas = els.resultCanvas;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundRect(ctx, 40, 40, canvas.width - 80, canvas.height - 80, 30, "#ffffff");
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("미리보기가 여기에 표시됩니다.", 90, 140);

  ctx.fillStyle = "#64748b";
  ctx.font = "26px sans-serif";
  ctx.fillText("위치를 선택한 뒤 '미리보기 생성' 버튼을 눌러주세요.", 90, 190);
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundImage(ctx, image, x, y, w, h, r) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let offsetY = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, y + offsetY);
      line = words[i] + " ";
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, y + offsetY);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Blob 생성에 실패했습니다."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 로드 실패"));
    };
    img.src = url;
  });
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Blob 이미지 로드 실패"));
    };
    img.src = url;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function makeFileName(prefix, ext) {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    "_",
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join("");
  return `${prefix}_${stamp}.${ext}`;
}
