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

  sourceType: document.getElementById("sourceType"),
  latInput: document.getElementById("latInput"),
  lngInput: document.getElementById("lngInput"),
  btnCopyLat: document.getElementById("btnCopyLat"),
  btnCopyLng: document.getElementById("btnCopyLng"),
  accuracyInput: document.getElementById("accuracyInput"),
  jibunAddressInput: document.getElementById("jibunAddressInput"),
  roadAddressInput: document.getElementById("roadAddressInput"),
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

  statusBox: document.getElementById("statusBox"),
  statusBadge: document.getElementById("statusBadge"),
  statusText: document.getElementById("statusText"),

  appModalBackdrop: document.getElementById("appModalBackdrop"),
  appModal: document.getElementById("appModal"),
  appModalBadge: document.getElementById("appModalBadge"),
  appModalTitle: document.getElementById("appModalTitle"),
  appModalMessage: document.getElementById("appModalMessage"),
  appModalConfirmBtn: document.getElementById("appModalConfirmBtn"),
};

init();

function init() {
  bindTabs();
  bindEvents();
  initModal();
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

  els.btnCopyLat.addEventListener("click", () => copyTextValue(els.latInput, "위도"));
  els.btnCopyLng.addEventListener("click", () => copyTextValue(els.lngInput, "경도"));
  
  els.jpgQuality.addEventListener("input", syncQualityText);
  els.btnConvertImage.addEventListener("click", convertImageFile);
  els.btnDownloadConverted.addEventListener("click", downloadConvertedFile);
  els.btnShareConverted.addEventListener("click", shareConvertedFile);
}

function initModal() {
  window.alert = function (message) {
    openModal({
      title: "안내",
      message: String(message || ""),
      badge: "알림",
    });
  };
}

function openModal({ title = "안내", message = "", badge = "알림" } = {}) {
  const backdrop = els.appModalBackdrop;
  const modal = els.appModal;

  els.appModalBadge.textContent = badge;
  els.appModalTitle.textContent = title;
  els.appModalMessage.innerHTML = String(message).replace(/\n/g, "<br>");

  backdrop.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add("show");
    modal.classList.add("show");
  });

  function close() {
    backdrop.classList.remove("show");
    modal.classList.remove("show");
    setTimeout(() => {
      backdrop.hidden = true;
    }, 180);

    els.appModalConfirmBtn.removeEventListener("click", close);
    backdrop.removeEventListener("click", onBackdropClick);
    document.removeEventListener("keydown", onKeyDown);
  }

  function onBackdropClick(e) {
    if (e.target === backdrop) close();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  els.appModalConfirmBtn.addEventListener("click", close);
  backdrop.addEventListener("click", onBackdropClick);
  document.addEventListener("keydown", onKeyDown);
}

function syncQualityText() {
  els.jpgQualityText.value = els.jpgQuality.value;
}

function updateStatus(message, isError = false) {
  if (!els.statusBox || !els.statusText || !els.statusBadge) return;

  els.statusText.textContent = message || "";

  els.statusBox.classList.remove("is-error", "is-success", "is-warning");

  if (isError) {
    els.statusBox.classList.add("is-error");
    els.statusBadge.textContent = "오류";
    return;
  }

  const text = String(message || "");
  if (text.includes("완료") || text.includes("생성되었습니다") || text.includes("저장") || text.includes("공유")) {
    els.statusBox.classList.add("is-success");
    els.statusBadge.textContent = "완료";
  } else if (text.includes("불러오는 중") || text.includes("생성 중") || text.includes("변환 중") || text.includes("로드")) {
    els.statusBox.classList.add("is-warning");
    els.statusBadge.textContent = "진행";
  } else {
    els.statusBadge.textContent = "안내";
  }
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
    alert(error.message || "지도 로드 중 오류가 발생했습니다.");
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.naver && window.naver.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("스크립트 로드 실패")), { once: true });
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

async function setSelectedLocation({ lat, lng, accuracy, sourceType }) {
  currentPosition = { lat, lng };
  currentAccuracy = accuracy;
  currentSourceType = sourceType;

  els.sourceType.value = sourceType;
  els.latInput.value = Number(lat).toFixed(6);
  els.lngInput.value = Number(lng).toFixed(6);
  els.accuracyInput.value = accuracy == null ? "-" : Number(accuracy).toFixed(1);
  els.timeInput.value = formatDateTime(new Date());
  els.jibunAddressInput.value = "주소 조회 중...";
  els.roadAddressInput.value = "주소 조회 중...";

  if (map && marker && window.naver && window.naver.maps) {
    const point = new naver.maps.LatLng(lat, lng);
    marker.setPosition(point);
    marker.setVisible(true);
    map.setCenter(point);
  }

  try {
    const address = await reverseGeocode(lat, lng);
    els.jibunAddressInput.value = address.jibun || "-";
    els.roadAddressInput.value = address.road || "-";
  } catch (error) {
    console.error(error);
    els.jibunAddressInput.value = "주소 조회 실패";
    els.roadAddressInput.value = "주소 조회 실패";
  }

  updateStatus(`${sourceType} 위치가 선택되었습니다.`);
}

function getCurrentGps() {
  if (!navigator.geolocation) {
    updateStatus("이 기기에서는 위치 기능을 지원하지 않습니다.", true);
    alert("이 기기에서는 위치 기능을 지원하지 않습니다.");
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
      alert(message);
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
  els.jibunAddressInput.value = "";
  els.roadAddressInput.value = "";
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
      jibunAddress: els.jibunAddressInput.value,
      roadAddress: els.roadAddressInput.value,
      timeText,
      memo,
    });

    currentBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    updateStatus("미리보기가 생성되었습니다.");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "미리보기 생성 중 오류가 발생했습니다.", true);
    alert(error.message || "미리보기 생성 중 오류가 발생했습니다.");
  }
}

async function reverseGeocode(lat, lng) {
  const res = await fetch(`/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  if (!res.ok) {
    throw new Error("주소 변환에 실패했습니다.");
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "주소 변환에 실패했습니다.");
  }

  return {
    jibun: data.jibunAddress || "",
    road: data.roadAddress || "",
  };
}

function buildStaticMapUrl(lng, lat) {
  const center = `${lng},${lat}`;
  const marker = `type:d|size:mid|pos:${lng} ${lat}`;
  const params = new URLSearchParams({
    center,
    level: "18",
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

  // 지도: 제목 박스를 없애고 위로 올림
  roundImage(ctx, data.mapImage, 40, 30, canvas.width - 80, 760, 32);

  // 좌표 정보 박스: 더 넓게 확보
  roundRect(ctx, 40, 820, canvas.width - 80, 500, 28, "#ffffff");

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("좌표 정보", 76, 880);

  const rows = [
    ["선택 방식", data.sourceType],
    ["위도", Number(data.lat).toFixed(6)],
    ["경도", Number(data.lng).toFixed(6)],
    ["정확도(m)", data.accuracy == null ? "-" : Number(data.accuracy).toFixed(1)],
    ["지번주소", data.jibunAddress || "-"],
    ["도로명주소", data.roadAddress || "-"],
    ["작업 시각", data.timeText],
    ["비고", data.memo || "-"],
  ];

  let y = 940;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = "#64748b";
    ctx.font = "24px sans-serif";
    ctx.fillText(label, 76, y);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 24px sans-serif";
    wrapText(ctx, String(value || "-"), 300, y, 680, 32);
    y += 46;
  });
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
    alert(error.message || "JPG 저장 중 오류가 발생했습니다.");
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
    alert(error.message || "공유 중 오류가 발생했습니다.");
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
    alert(error.message || "이미지 변환 중 오류가 발생했습니다.");
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
    alert(error.message || "파일 저장 중 오류가 발생했습니다.");
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
    alert(error.message || "공유 중 오류가 발생했습니다.");
  }
}

async function copyTextValue(inputEl, label) {
  const value = String(inputEl?.value || "").trim();

  if (!value) {
    alert(`${label} 값이 없습니다.`);
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      inputEl.removeAttribute("readonly");
      inputEl.select();
      inputEl.setSelectionRange(0, 99999);
      document.execCommand("copy");
      inputEl.setAttribute("readonly", true);
    }

    updateStatus(`${label}가 복사되었습니다.`);
    alert(`${label}가 복사되었습니다.`);
  } catch (error) {
    console.error(error);
    alert(`${label} 복사에 실패했습니다.`);
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
