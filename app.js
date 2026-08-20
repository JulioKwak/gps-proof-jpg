let map = null;
let marker = null;
let currentPosition = null;
let currentAccuracy = null;
let currentSourceType = "미선택";
let currentBlob = null;
let naverClientId = null;

// 복수 이미지 변환 결과
let convertedItems = [];
let convertedZipBlob = null;

// 미리보기 Object URL
let sourcePreviewObjectUrl = null;
let convertedPreviewObjectUrl = null;

// 복수 이미지 ZIP 생성용 JSZip CDN
const JSZIP_CDN_URL =
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";

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
  btnDownloadConverted: document.getElementById(
    "btnDownloadConverted"
  ),
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
  appModalConfirmBtn: document.getElementById(
    "appModalConfirmBtn"
  ),
};

init();

function init() {
  configureImageFileInput();
  bindTabs();
  bindEvents();
  initModal();
  updateStatus("지도를 불러오는 중입니다...");
  syncQualityText();
  drawInitialCanvas();
  loadMapSdkAndInit();
}

/**
 * HTML을 수정하지 않더라도 복수 파일 선택이 가능하도록 설정합니다.
 */
function configureImageFileInput() {
  if (!els.imageFileInput) return;

  els.imageFileInput.multiple = true;
  els.imageFileInput.accept = "image/png,image/jpeg,image/webp";
}

function bindTabs() {
  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.tabs.forEach((x) => x.classList.remove("active"));
      els.panes.forEach((x) => x.classList.remove("active"));

      btn.classList.add("active");

      const targetPane = document.getElementById(btn.dataset.tab);

      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

function bindEvents() {
  els.btnGetGps?.addEventListener("click", getCurrentGps);
  els.btnResetLocation?.addEventListener("click", resetLocation);
  els.btnPreviewCard?.addEventListener(
    "click",
    generateProofPreview
  );
  els.btnSaveJpg?.addEventListener("click", saveProofJpg);
  els.btnShareJpg?.addEventListener("click", shareProofJpg);

  els.btnCopyLat?.addEventListener("click", () => {
    copyTextValue(els.latInput, "위도");
  });

  els.btnCopyLng?.addEventListener("click", () => {
    copyTextValue(els.lngInput, "경도");
  });

  els.imageFileInput?.addEventListener(
    "change",
    handleImageSelectionChange
  );

  els.outputFormat?.addEventListener("change", () => {
    clearConvertedResult();
    updateStatus("출력 형식이 변경되었습니다. 다시 변환해주세요.");
  });

  els.jpgQuality?.addEventListener("input", () => {
    syncQualityText();

    if (els.outputFormat?.value === "image/jpeg") {
      clearConvertedResult();
    }
  });

  els.btnConvertImage?.addEventListener(
    "click",
    convertImageFiles
  );

  els.btnDownloadConverted?.addEventListener(
    "click",
    downloadConvertedFiles
  );

  els.btnShareConverted?.addEventListener(
    "click",
    shareConvertedFiles
  );
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

function openModal({
  title = "안내",
  message = "",
  badge = "알림",
} = {}) {
  const backdrop = els.appModalBackdrop;
  const modal = els.appModal;

  if (
    !backdrop ||
    !modal ||
    !els.appModalBadge ||
    !els.appModalTitle ||
    !els.appModalMessage ||
    !els.appModalConfirmBtn
  ) {
    console.log(`[${badge}] ${title}: ${message}`);
    return;
  }

  els.appModalBadge.textContent = badge;
  els.appModalTitle.textContent = title;

  // 메시지에 포함된 HTML이 실행되지 않도록 안전하게 처리
  els.appModalMessage.textContent = String(message || "");
  els.appModalMessage.style.whiteSpace = "pre-line";

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
    if (e.target === backdrop) {
      close();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      close();
    }
  }

  els.appModalConfirmBtn.addEventListener("click", close);
  backdrop.addEventListener("click", onBackdropClick);
  document.addEventListener("keydown", onKeyDown);
}

function syncQualityText() {
  if (!els.jpgQuality || !els.jpgQualityText) return;

  els.jpgQualityText.value = els.jpgQuality.value;
}

function updateStatus(message, isError = false) {
  if (!els.statusBox || !els.statusText || !els.statusBadge) {
    return;
  }

  els.statusText.textContent = message || "";

  els.statusBox.classList.remove(
    "is-error",
    "is-success",
    "is-warning"
  );

  if (isError) {
    els.statusBox.classList.add("is-error");
    els.statusBadge.textContent = "오류";
    return;
  }

  const text = String(message || "");

  if (
    text.includes("완료") ||
    text.includes("생성되었습니다") ||
    text.includes("저장") ||
    text.includes("공유") ||
    text.includes("복사되었습니다")
  ) {
    els.statusBox.classList.add("is-success");
    els.statusBadge.textContent = "완료";
  } else if (
    text.includes("불러오는 중") ||
    text.includes("생성 중") ||
    text.includes("변환 중") ||
    text.includes("압축") ||
    text.includes("로드")
  ) {
    els.statusBox.classList.add("is-warning");
    els.statusBadge.textContent = "진행";
  } else {
    els.statusBadge.textContent = "안내";
  }
}

/* =========================================================
   네이버 지도
========================================================= */

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
        `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
          naverClientId
        )}`
      );
    }

    initMap();

    updateStatus(
      "지도가 준비되었습니다. 지도 클릭 또는 GPS로 위치를 선택하세요."
    );
  } catch (error) {
    console.error(error);

    updateStatus(
      error.message || "지도 로드 중 오류가 발생했습니다.",
      true
    );

    alert(error.message || "지도 로드 중 오류가 발생했습니다.");
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(
      document.querySelectorAll("script[src]")
    ).find((script) => script.src === new URL(src, location.href).href);

    if (existing) {
      const isNaverReady =
        src.includes("oapi.map.naver.com") &&
        window.naver &&
        window.naver.maps;

      const isJsZipReady =
        src.includes("jszip") &&
        typeof window.JSZip !== "undefined";

      if (isNaverReady || isJsZipReady) {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, {
        once: true,
      });

      existing.addEventListener(
        "error",
        () => {
          reject(new Error("스크립트 로드에 실패했습니다."));
        },
        {
          once: true,
        }
      );

      return;
    }

    const script = document.createElement("script");

    script.src = src;
    script.async = true;

    script.onload = () => resolve();

    script.onerror = () => {
      reject(new Error("스크립트 로드에 실패했습니다."));
    };

    document.head.appendChild(script);
  });
}

function initMap() {
  const defaultCenter = new naver.maps.LatLng(
    37.5666103,
    126.9783882
  );

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

async function setSelectedLocation({
  lat,
  lng,
  accuracy,
  sourceType,
}) {
  currentPosition = {
    lat,
    lng,
  };

  currentAccuracy = accuracy;
  currentSourceType = sourceType;

  els.sourceType.value = sourceType;
  els.latInput.value = Number(lat).toFixed(6);
  els.lngInput.value = Number(lng).toFixed(6);

  els.accuracyInput.value =
    accuracy == null ? "-" : Number(accuracy).toFixed(1);

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
    updateStatus(
      "이 기기에서는 위치 기능을 지원하지 않습니다.",
      true
    );

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

      if (error.code === 1) {
        message = "위치 권한이 거부되었습니다.";
      }

      if (error.code === 2) {
        message = "위치 정보를 사용할 수 없습니다.";
      }

      if (error.code === 3) {
        message = "위치 요청 시간이 초과되었습니다.";
      }

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

async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `/api/reverse-geocode?lat=${encodeURIComponent(
      lat
    )}&lng=${encodeURIComponent(lng)}`
  );

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
  const mapMarker = `type:d|size:mid|pos:${lng} ${lat}`;

  const params = new URLSearchParams({
    center,
    level: "18",
    w: "1080",
    h: "720",
    maptype: "basic",
    format: "jpg",
    scale: "2",
    markers: mapMarker,
  });

  return `/api/static-map?${params.toString()}`;
}

/* =========================================================
   위치 증빙 이미지
========================================================= */

async function generateProofPreview() {
  try {
    if (!currentPosition) {
      throw new Error("먼저 위치를 선택해주세요.");
    }

    updateStatus(
      "지도 포함 JPG 미리보기를 생성하는 중입니다..."
    );

    const memo = (els.memoInput.value || "").trim();

    const timeText =
      els.timeInput.value || formatDateTime(new Date());

    const staticMapUrl = buildStaticMapUrl(
      currentPosition.lng,
      currentPosition.lat
    );

    const res = await fetch(staticMapUrl);

    if (!res.ok) {
      throw new Error(
        "정적 지도 이미지를 불러오지 못했습니다."
      );
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

    currentBlob = await canvasToBlob(
      canvas,
      "image/jpeg",
      0.92
    );

    updateStatus("미리보기가 생성되었습니다.");
  } catch (error) {
    console.error(error);

    updateStatus(
      error.message ||
        "미리보기 생성 중 오류가 발생했습니다.",
      true
    );

    alert(
      error.message ||
        "미리보기 생성 중 오류가 발생했습니다."
    );
  }
}

function drawProofCanvas(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundImage(
    ctx,
    data.mapImage,
    40,
    30,
    canvas.width - 80,
    760,
    32
  );

  roundRect(
    ctx,
    40,
    820,
    canvas.width - 80,
    500,
    28,
    "#ffffff"
  );

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("좌표 정보", 76, 880);

  const rows = [
    ["선택 방식", data.sourceType],
    ["위도", Number(data.lat).toFixed(6)],
    ["경도", Number(data.lng).toFixed(6)],
    [
      "정확도(m)",
      data.accuracy == null
        ? "-"
        : Number(data.accuracy).toFixed(1),
    ],
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

    wrapText(
      ctx,
      String(value || "-"),
      300,
      y,
      680,
      32
    );

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

    downloadBlob(
      currentBlob,
      makeFileName("gps-proof", "jpg")
    );

    updateStatus("JPG 저장을 시작했습니다.");
  } catch (error) {
    console.error(error);

    updateStatus(
      error.message || "JPG 저장 중 오류가 발생했습니다.",
      true
    );

    alert(
      error.message || "JPG 저장 중 오류가 발생했습니다."
    );
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

    const file = new File(
      [currentBlob],
      makeFileName("gps-proof", "jpg"),
      {
        type: "image/jpeg",
      }
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      await navigator.share({
        title: "위치 증빙 이미지",
        files: [file],
      });

      updateStatus("공유를 완료했습니다.");
      return;
    }

    downloadBlob(currentBlob, file.name);

    updateStatus(
      "공유를 지원하지 않아 다운로드로 대체했습니다."
    );
  } catch (error) {
    console.error(error);

    if (error.name === "AbortError") {
      updateStatus("공유가 취소되었습니다.");
      return;
    }

    updateStatus(
      error.message || "공유 중 오류가 발생했습니다.",
      true
    );

    alert(error.message || "공유 중 오류가 발생했습니다.");
  }
}

/* =========================================================
   복수 이미지 변환
========================================================= */

function handleImageSelectionChange() {
  clearConvertedResult();

  const files = Array.from(
    els.imageFileInput?.files || []
  );

  if (files.length === 0) {
    setSourcePreview(null);
    updateStatus("변환할 이미지를 선택해주세요.");
    return;
  }

  setSourcePreview(files[0]);

  if (files.length === 1) {
    updateStatus(`${files[0].name} 파일이 선택되었습니다.`);
  } else {
    updateStatus(`${files.length}개 이미지가 선택되었습니다.`);
  }
}

async function convertImageFiles() {
  try {
    const files = Array.from(
      els.imageFileInput?.files || []
    );

    if (files.length === 0) {
      throw new Error(
        "변환할 이미지를 먼저 선택해주세요."
      );
    }

    const invalidFile = files.find((file) => {
      return (
        file.type &&
        !file.type.startsWith("image/")
      );
    });

    if (invalidFile) {
      throw new Error(
        `이미지 파일이 아닙니다: ${invalidFile.name}`
      );
    }

    clearConvertedResult();
    setSourcePreview(files[0]);

    const outputMime =
      els.outputFormat?.value || "image/jpeg";

    const outputExt =
      outputMime === "image/png" ? "png" : "jpg";

    const quality = getImageQuality();
    const usedNames = new Set();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      updateStatus(
        `이미지를 변환하는 중입니다... (${i + 1}/${
          files.length
        })`
      );

      const img = await fileToImage(file);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "이미지 변환용 Canvas를 생성하지 못했습니다."
        );
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      /*
       * JPG는 투명 배경을 지원하지 않습니다.
       * 투명한 PNG를 JPG로 변환하면 투명 영역을 흰색으로 처리합니다.
       */
      if (outputMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      ctx.drawImage(img, 0, 0);

      const blob = await canvasToBlob(
        canvas,
        outputMime,
        outputMime === "image/jpeg"
          ? quality
          : undefined
      );

      const convertedName = makeConvertedFileName(
        file.name,
        outputExt,
        usedNames
      );

      convertedItems.push({
        blob,
        name: convertedName,
        mime: outputMime,
        originalName: file.name,
      });

      // 브라우저 메모리 정리
      canvas.width = 1;
      canvas.height = 1;
    }

    if (convertedItems.length > 0) {
      setConvertedPreview(convertedItems[0].blob);
    }

    /*
     * 복수 파일이면 ZIP을 생성합니다.
     */
    if (convertedItems.length > 1) {
      await ensureJsZipLoaded();

      updateStatus(
        "변환된 이미지들을 ZIP 파일로 압축하는 중입니다..."
      );

      const zip = new window.JSZip();

      convertedItems.forEach((item) => {
        zip.file(item.name, item.blob);
      });

      convertedZipBlob = await zip.generateAsync(
        {
          type: "blob",
          mimeType: "application/zip",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        },
        (metadata) => {
          const percent = Math.round(
            metadata.percent || 0
          );

          updateStatus(
            `ZIP 파일을 생성하는 중입니다... (${percent}%)`
          );
        }
      );

      updateStatus(
        `${convertedItems.length}개 이미지 변환 및 ZIP 생성이 완료되었습니다.`
      );

      return;
    }

    updateStatus("이미지 변환이 완료되었습니다.");
  } catch (error) {
    console.error(error);

    clearConvertedResult();

    updateStatus(
      error.message ||
        "이미지 변환 중 오류가 발생했습니다.",
      true
    );

    alert(
      error.message ||
        "이미지 변환 중 오류가 발생했습니다."
    );
  }
}

function downloadConvertedFiles() {
  try {
    if (convertedItems.length === 0) {
      throw new Error(
        "먼저 이미지 변환을 실행해주세요."
      );
    }

    /*
     * 1개 선택: 변환된 이미지 직접 다운로드
     */
    if (convertedItems.length === 1) {
      const item = convertedItems[0];

      downloadBlob(item.blob, item.name);

      updateStatus(
        `${item.name} 파일 저장을 시작했습니다.`
      );

      return;
    }

    /*
     * 2개 이상 선택: ZIP 다운로드
     */
    if (!convertedZipBlob) {
      throw new Error(
        "ZIP 파일이 생성되지 않았습니다. 다시 변환해주세요."
      );
    }

    const zipFileName = makeFileName(
      "converted-images",
      "zip"
    );

    downloadBlob(convertedZipBlob, zipFileName);

    updateStatus(
      `${convertedItems.length}개 이미지가 포함된 ZIP 저장을 시작했습니다.`
    );
  } catch (error) {
    console.error(error);

    updateStatus(
      error.message || "파일 저장 중 오류가 발생했습니다.",
      true
    );

    alert(
      error.message || "파일 저장 중 오류가 발생했습니다."
    );
  }
}

async function shareConvertedFiles() {
  try {
    if (convertedItems.length === 0) {
      throw new Error(
        "먼저 이미지 변환을 실행해주세요."
      );
    }

    let shareBlob;
    let shareFileName;
    let shareMime;
    let shareTitle;

    /*
     * 단일 파일은 이미지 파일로 공유합니다.
     */
    if (convertedItems.length === 1) {
      const item = convertedItems[0];

      shareBlob = item.blob;
      shareFileName = item.name;
      shareMime = item.mime;
      shareTitle = "변환 이미지";
    } else {
      /*
       * 복수 파일은 ZIP 파일로 공유합니다.
       */
      if (!convertedZipBlob) {
        throw new Error(
          "ZIP 파일이 생성되지 않았습니다. 다시 변환해주세요."
        );
      }

      shareBlob = convertedZipBlob;
      shareFileName = makeFileName(
        "converted-images",
        "zip"
      );
      shareMime = "application/zip";
      shareTitle = "변환 이미지 ZIP 파일";
    }

    const file = new File(
      [shareBlob],
      shareFileName,
      {
        type: shareMime,
      }
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      await navigator.share({
        title: shareTitle,
        files: [file],
      });

      updateStatus("공유를 완료했습니다.");
      return;
    }

    /*
     * ZIP 공유 또는 파일 공유를 지원하지 않으면
     * 다운로드로 대체합니다.
     */
    downloadBlob(shareBlob, shareFileName);

    updateStatus(
      "공유를 지원하지 않아 다운로드로 대체했습니다."
    );
  } catch (error) {
    console.error(error);

    if (error.name === "AbortError") {
      updateStatus("공유가 취소되었습니다.");
      return;
    }

    updateStatus(
      error.message || "공유 중 오류가 발생했습니다.",
      true
    );

    alert(error.message || "공유 중 오류가 발생했습니다.");
  }
}

function getImageQuality() {
  const rawValue = parseFloat(
    els.jpgQuality?.value || "0.92"
  );

  if (!Number.isFinite(rawValue)) {
    return 0.92;
  }

  return Math.min(1, Math.max(0.1, rawValue));
}

/**
 * JSZip이 HTML에 이미 포함되어 있다면 그대로 사용하고,
 * 포함되어 있지 않다면 CDN에서 자동으로 불러옵니다.
 */
async function ensureJsZipLoaded() {
  if (typeof window.JSZip !== "undefined") {
    return;
  }

  updateStatus("ZIP 라이브러리를 불러오는 중입니다...");

  await loadScript(JSZIP_CDN_URL);

  if (typeof window.JSZip === "undefined") {
    throw new Error(
      "ZIP 라이브러리를 불러오지 못했습니다."
    );
  }
}

/**
 * 변환 결과와 변환 미리보기를 초기화합니다.
 */
function clearConvertedResult() {
  convertedItems = [];
  convertedZipBlob = null;

  if (convertedPreviewObjectUrl) {
    URL.revokeObjectURL(convertedPreviewObjectUrl);
    convertedPreviewObjectUrl = null;
  }

  if (els.convertedPreview) {
    els.convertedPreview.removeAttribute("src");
  }
}

/**
 * 선택한 원본 파일 중 첫 번째 파일을 미리보기에 표시합니다.
 */
function setSourcePreview(file) {
  if (sourcePreviewObjectUrl) {
    URL.revokeObjectURL(sourcePreviewObjectUrl);
    sourcePreviewObjectUrl = null;
  }

  if (!els.sourcePreview) {
    return;
  }

  if (!file) {
    els.sourcePreview.removeAttribute("src");
    return;
  }

  sourcePreviewObjectUrl = URL.createObjectURL(file);
  els.sourcePreview.src = sourcePreviewObjectUrl;
}

/**
 * 변환된 첫 번째 이미지를 결과 미리보기에 표시합니다.
 */
function setConvertedPreview(blob) {
  if (convertedPreviewObjectUrl) {
    URL.revokeObjectURL(convertedPreviewObjectUrl);
    convertedPreviewObjectUrl = null;
  }

  if (!els.convertedPreview) {
    return;
  }

  if (!blob) {
    els.convertedPreview.removeAttribute("src");
    return;
  }

  convertedPreviewObjectUrl =
    URL.createObjectURL(blob);

  els.convertedPreview.src =
    convertedPreviewObjectUrl;
}

/**
 * 원본 파일명을 유지하면서 확장자만 변경합니다.
 * 동일한 파일명이 있으면 _2, _3을 추가합니다.
 */
function makeConvertedFileName(
  originalName,
  extension,
  usedNames
) {
  const safeOriginalName = String(
    originalName || "image"
  )
    .replace(/\\/g, "/")
    .split("/")
    .pop();

  const lastDotIndex =
    safeOriginalName.lastIndexOf(".");

  const rawBaseName =
    lastDotIndex > 0
      ? safeOriginalName.substring(0, lastDotIndex)
      : safeOriginalName;

  const safeBaseName =
    rawBaseName
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\.+$/g, "")
      .trim() || "image";

  let fileName = `${safeBaseName}.${extension}`;
  let sequence = 2;

  while (usedNames.has(fileName.toLowerCase())) {
    fileName = `${safeBaseName}_${sequence}.${extension}`;
    sequence++;
  }

  usedNames.add(fileName.toLowerCase());

  return fileName;
}

/* =========================================================
   복사
========================================================= */

async function copyTextValue(inputEl, label) {
  const value = String(inputEl?.value || "").trim();

  if (!value) {
    alert(`${label} 값이 없습니다.`);
    return;
  }

  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(value);
    } else {
      const wasReadonly =
        inputEl.hasAttribute("readonly");

      inputEl.removeAttribute("readonly");
      inputEl.select();
      inputEl.setSelectionRange(0, 99999);

      const copied = document.execCommand("copy");

      if (wasReadonly) {
        inputEl.setAttribute("readonly", true);
      }

      if (!copied) {
        throw new Error("복사 명령을 실행하지 못했습니다.");
      }
    }

    updateStatus(`${label}가 복사되었습니다.`);
    alert(`${label}가 복사되었습니다.`);
  } catch (error) {
    console.error(error);
    alert(`${label} 복사에 실패했습니다.`);
  }
}

/* =========================================================
   Canvas 유틸리티
========================================================= */

function drawInitialCanvas() {
  const canvas = els.resultCanvas;

  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundRect(
    ctx,
    40,
    40,
    canvas.width - 80,
    canvas.height - 80,
    30,
    "#ffffff"
  );

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 40px sans-serif";

  ctx.fillText(
    "미리보기가 여기에 표시됩니다.",
    90,
    140
  );

  ctx.fillStyle = "#64748b";
  ctx.font = "26px sans-serif";

  ctx.fillText(
    "위치를 선택한 뒤 '미리보기 생성' 버튼을 눌러주세요.",
    90,
    190
  );
}

function roundRect(
  ctx,
  x,
  y,
  w,
  h,
  r,
  fill
) {
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

function roundImage(
  ctx,
  image,
  x,
  y,
  w,
  h,
  r
) {
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

function wrapText(
  ctx,
  text,
  x,
  y,
  maxWidth,
  lineHeight
) {
  const words = String(text).split(" ");

  let line = "";
  let offsetY = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && i > 0) {
      ctx.fillText(
        line.trim(),
        x,
        y + offsetY
      );

      line = words[i] + " ";
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(
    line.trim(),
    x,
    y + offsetY
  );
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error("Blob 생성에 실패했습니다.")
          );
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}

/* =========================================================
   이미지 유틸리티
========================================================= */

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

      reject(
        new Error(
          `이미지 로드에 실패했습니다: ${file.name}`
        )
      );
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

      reject(
        new Error("Blob 이미지 로드에 실패했습니다.")
      );
    };

    img.src = url;
  });
}

/* =========================================================
   파일 다운로드 및 날짜
========================================================= */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function formatDateTime(date) {
  const y = date.getFullYear();

  const m = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const d = String(
    date.getDate()
  ).padStart(2, "0");

  const hh = String(
    date.getHours()
  ).padStart(2, "0");

  const mm = String(
    date.getMinutes()
  ).padStart(2, "0");

  const ss = String(
    date.getSeconds()
  ).padStart(2, "0");

  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function makeFileName(prefix, ext) {
  const date = new Date();

  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "_",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");

  return `${prefix}_${stamp}.${ext}`;
}

/* =========================================================
   페이지 종료 시 Object URL 정리
========================================================= */

window.addEventListener("beforeunload", () => {
  if (sourcePreviewObjectUrl) {
    URL.revokeObjectURL(sourcePreviewObjectUrl);
  }

  if (convertedPreviewObjectUrl) {
    URL.revokeObjectURL(convertedPreviewObjectUrl);
  }
});
