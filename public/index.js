// --- DATA ---
const db = {
  facsetupTasks: [],
  avsetupTasks: [],
  operationSchedule: [],
  soundData: [],
  soundSettings: { minDb: 65, maxDb: 80 },
  timetable: [],
};

async function loadAllData() {
  try {
    const [facsetupData, avsetupData, scheduleData, timetableData, soundData] =
      await Promise.all([
        fetch("/api/facSetupTasks").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch SetupTasks");
          return res.json();
        }),
        fetch("/api/avSetupTasks").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch SetupTasks");
          return res.json();
        }),
        fetch("/api/OperationSchedule").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch OperationSchedule");
          return res.json();
        }),
        fetch("/api/TimeTable").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch timeTable");
          return res.json();
        }),
        fetch("/api/SoundData").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch SoundData");
          return res.json();
        }),
        // fetch("/api2/white-bc-values").then((res) => {
        //   if (!res.ok) throw new Error("Failed to fetch white-bc-values");
        //   return res.json();
        // }),
      ]);

    db.facsetupTasks = facsetupData.map((d) => ({
      ...d,
      id: parseInt(d.id),
      duration: parseInt(d.duration),
      completed: (d.completed || "").trim(),
      memo: d.memo?.trim() || "",
    }));
    db.avsetupTasks = avsetupData.map((d) => ({
      ...d,
      id: parseInt(d.id),
      duration: parseInt(d.duration),
      completed: (d.completed || "").trim(),
      memo: d.memo?.trim() || "",
    }));
    db.operationSchedule = scheduleData;
    db.timetable = timetableData;
    db.soundData = soundData;

    console.log(soundData);
  } catch (error) {
    console.error("Error loading data from API:", error);
    alert(
      "API 서버에서 데이터를 불러오는 데 실패했습니다. 백엔드 서버가 정상적으로 실행 중인지 확인해주세요."
    );
  }
}

// --- STATE ---
const state = {
  activeTab: "dashboard",
  facSetupFilter: "All",
  avSetupFilter: "All",
  operationDay: "2025-08-15",
  facCurrentDateFilter: "All",
  avCurrentDateFilter: "All",
  soundFilter: { day: 1, time: "" },
};

const statusOrder = ["대기", "진행중", "완료", "문제", "보류"];
const statusColorMap = {
  대기: "bg-gray-400",
  진행중: "bg-blue-500",
  완료: "bg-green-500",
  문제: "bg-red-500",
  보류: "bg-yellow-500",
};
let calendar; // ✅ 여기!

const charts = {};

const timeOptionMap = {
  1: [
    "9:20",
    "9:30",
    "9:40",
    "10:40",
    "10:50",
    "1:35",
    "1:45",
    "1:50",
    "2:50",
    "3:00",
  ],
  2: ["9:20", "9:40", "10:20", "1:35", "1:50", "3:20"],
  3: ["9:20", "9:40", "11:05", "1:35", "1:50", "2:55"],
};
// 시설부: HTML에 있는 5개 캔버스 순서와 동일해야 함
const fac_teams_order = ["무대팀", "설비팀", "전기팀", "사무팀", "디자인팀"];

// AV부: HTML 9개 순서
const av_teams_order = [
  "오디오트러스팀",
  "사이드스피커팀",
  "오디오AV데스크팀",
  "전기팀",
  "전광판트러스팀",
  "비디오케이블팀",
  "비디오AV데스크팀",
  "무대팀",
  "IT팀",
];

function renderTeamProgressChartsFixed(setupTasks, prefix, teamsOrder) {
  teamsOrder.forEach((teamName, i) => {
    const canvasId = `${prefix}TeamProgressChart${i + 1}`;
    const el = document.getElementById(canvasId);
    if (!el) {
      console.warn(
        `[renderTeamProgressChartsFixed] #${canvasId} not found. Skip.`
      );
      return;
    }

    const teamTasks = setupTasks.filter((t) => t.team === teamName);
    const total = teamTasks.length; // 0이면 그대로 0으로
    const completed = teamTasks.filter((t) => t.completed === "완료").length;

    // total=0 이면 renderDonutChart가 0%로 표시(분모 0 방지 로직 이미 포함)
    renderDonutChart(canvasId, teamName, completed, total);
  });
}

function renderDelayedTasks(setupTasks, containerId) {
  const now = new Date();
  const delayedTasksList = document.getElementById(containerId);
  delayedTasksList.innerHTML = "";

  const delayedTasks = setupTasks.filter((task) => {
    if (!task.start || !task.duration) return false;
    const startTime = new Date(task.start.replace(/\s/g, "T"));
    if (isNaN(startTime)) return false;
    const endTime = new Date(
      startTime.getTime() + (parseInt(task.duration) || 0) * 60000
    );
    return task.completed !== "완료" && !isNaN(endTime) && new Date() > endTime;
  });

  if (delayedTasks.length > 0) {
    delayedTasks.forEach((task) => {
      delayedTasksList.innerHTML += `
        <div class="flex justify-between items-start bg-red-50 p-2 rounded">
          <span class="break-words max-w-[80%]">
            <span class="font-semibold">${task.team}</span> - ${task.task}
          </span>
          <span class="text-red-600 font-bold whitespace-nowrap min-w-[3rem] text-right pl-2">지연</span>
        </div>`;
    });
  } else {
    delayedTasksList.innerHTML = `<p class="text-slate-500">지연된 작업이 없습니다.</p>`;
  }
}

function renderDashboard() {
  renderTeamProgressChartsFixed(db.facsetupTasks, "fac", fac_teams_order);
  renderTeamProgressChartsFixed(db.avsetupTasks, "av", av_teams_order);

  renderDelayedTasks(db.avsetupTasks, "delayed-tasks-list-av");
  renderDelayedTasks(db.facsetupTasks, "delayed-tasks-list-fac");

  renderOverallByDaysFor(db.facsetupTasks, "fac");
  renderOverallByDaysFor(db.avsetupTasks, "av");

  renderSoundSummary();
  renderOnDuty();
}

// 도넛 중앙 텍스트 플러그인 등록 (최초 1회)
Chart.register({
  id: "centerText",
  beforeDraw(chart) {
    const { width, height } = chart;
    const ctx = chart.ctx;

    const centerText = chart.config.options.plugins.centerText;
    if (centerText && centerText.text) {
      ctx.save();
      ctx.font = `${centerText.fontWeight || "bold"} ${
        centerText.fontSize || 16
      }px sans-serif`;
      ctx.fillStyle = centerText.color || "#111";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(centerText.text, width / 2, height / 2);
      ctx.restore();
    }
  },
});

function normalizeDateOnly(str) {
  // "2025. 08. 13 09:00" / "2025-08-13 09:00" -> "2025-08-13"
  if (!str) return "";
  const datePart = str
    .split(" ")[0]
    .replace(/\./g, "-")
    .replace(/\s+/g, "")
    .replace(/-$/, "");
  return datePart; // "2025-08-13"
}
function isTaskOnDay(task, dayNumber) {
  if (!task.start) return false;
  const dateOnly = normalizeDateOnly(task.start); // "2025-08-13"
  const day = parseInt(dateOnly.split("-")[2], 10);
  return day === dayNumber;
}

function renderOverallByDaysFor(setupTasks, prefix) {
  const day13 = setupTasks.filter((t) => isTaskOnDay(t, 13));
  const day17 = setupTasks.filter((t) => isTaskOnDay(t, 17));

  const total13 = day13.length;
  const completed13 = day13.filter((t) => t.completed === "완료").length;

  const total17 = day17.length;
  const completed17 = day17.filter((t) => t.completed === "완료").length;

  // 디버그
  console.log(`[${prefix}] 13일 total/completed =>`, total13, completed13);
  console.log(`[${prefix}] 17일 total/completed =>`, total17, completed17);

  renderDonutChart(
    `${prefix}13OverallProgressChart`,
    "사전설치",
    completed13,
    total13,
    {
      useBlue: true,
      centerFontSize: 24,
      cutout: "72%",
    }
  );
  renderDonutChart(
    `${prefix}17OverallProgressChart`,
    "철거",
    completed17,
    total17,
    {
      useBlue: true,
      centerFontSize: 24,
      cutout: "72%",
    }
  );
}

function renderDonutChart(canvasId, label, completed, total, opts = {}) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (charts[canvasId]) charts[canvasId].destroy();

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const data = total > 0 ? [completed, total - completed] : [0, 1];

  const useBlue = !!opts.useBlue; // 오버롤이면 파랑
  const completeColor = useBlue ? "#3B82F6" : "#22c55e"; // 파랑 / 기존 초록
  const restColor = "#e2e8f0";

  charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["완료", "미완료"],
      datasets: [
        {
          data,
          backgroundColor: [completeColor, restColor],
          borderColor: ["#ffffff"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        centerText: {
          text: `${percentage}%`,
          fontSize: canvasId.toLowerCase().includes("overall") ? 40 : 20, // 대소문자 보정
          fontWeight: "bold",
          color: "#334155",
        },
      },
    },
  });
}

function renderSetupTable(tab) {
  const isFac = tab === "fac";
  const tableBody = document.getElementById(
    isFac ? "fac-setup-tasks-table" : "av-setup-tasks-table"
  );
  tableBody.innerHTML = "";

  const setupTasks = isFac ? db.facsetupTasks : db.avsetupTasks;
  const filter = isFac ? state.facSetupFilter : state.avSetupFilter;
  const selectedDate = isFac
    ? state.facCurrentDateFilter
    : state.avCurrentDateFilter;

  const filteredTasks = setupTasks.filter((task) => {
    const matchesTeam = filter === "All" || task.team === filter;

    let matchesDate = true;
    if (selectedDate !== "All" && task.start) {
      const taskDate = task.start.split(" ")[0].replace(/\./g, "-").trim(); // "2025. 08. 13"
      const dateOnly = taskDate.replace(/\s+/g, "").replace(/\.$/, "");
      matchesDate = dateOnly === selectedDate;
    }

    return matchesTeam && matchesDate;
  });

  const now = new Date();
  const formatOptions = {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  filteredTasks.forEach((task, index) => {
    const startTime = task.start
      ? new Date(task.start.replace(/\s/g, "T"))
      : null;
    const endTime =
      startTime && task.duration
        ? new Date(startTime.getTime() + parseInt(task.duration) * 60000)
        : null;

    let rowClass = "";
    if (task.completed == "완료") {
      rowClass = "completed";
    } else if (endTime && now > endTime) {
      rowClass = "delayed";
    } else if (startTime && now >= startTime && now <= endTime) {
      rowClass = "in-progress";
    }

    const status = statusOrder.includes(task.completed)
      ? task.completed
      : "대기";

    const tr = document.createElement("tr");
    tr.className = `task-row border-b border-slate-200 hover:bg-slate-50 ${rowClass}`;

    tr.innerHTML = `
        <td class="p-3 align-middle whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">${
            task.team
          }</span>
        </td>
  
        <td class="p-4 text-center align-middle whitespace-nowrap">
          <button
            data-task-id="${task.id}"
            data-tab="${isFac ? "fac" : "av"}"
            class="status-chip px-2 py-1 rounded-full text-white text-xs font-semibold ${
              statusColorMap[status] || "bg-gray-300"
            }">
            ${status}
          </button>
        </td>
  
        <td class="p-3 font-semibold task-name align-middle whitespace-nowrap">
          ${task.task}
        </td>
  
        <td class="p-3 text-center align-middle whitespace-nowrap">
          ${
            task.memo && task.memo.trim() !== ""
              ? `<button onclick="openMemoPopup('${isFac ? "fac" : "av"}', ${
                  task.id
                })" title="메모 있음">📌</button>`
              : `<button onclick="openMemoPopup('${isFac ? "fac" : "av"}', ${
                  task.id
                })" title="메모 없음" class="opacity-10">📌</button>`
          }
        </td>
  
        <td class="p-3 align-middle whitespace-nowrap">${task.person || ""}</td>
  
        <td class="p-3 align-middle text-sm whitespace-nowrap">
          ${
            startTime && !isNaN(startTime)
              ? startTime.toLocaleString("ko-KR", formatOptions)
              : "미정"
          }
        </td>
  
        <td class="p-3 align-middle text-sm whitespace-nowrap">
          ${
            endTime && !isNaN(endTime)
              ? endTime.toLocaleString("ko-KR", formatOptions)
              : "미정"
          }
        </td>
  
        <td class="p-3 text-center align-middle whitespace-nowrap">
          ${
            task.link && task.link.trim() !== ""
              ? `<a href="${task.link}" target="_blank" class="inline-block text-blue-600 underline font-semibold hover:text-blue-800">링크</a>`
              : ""
          }
        </td>
      `;

    tableBody.appendChild(tr);
  });
}

async function updateTaskStatus(taskId, tab = "fac") {
  const setupTasks = tab === "fac" ? db.facsetupTasks : db.avsetupTasks;
  const task = setupTasks.find((t) => t.id == taskId); // == 로 형 변환 허용
  if (!task) return;

  const currentIndex = statusOrder.indexOf(task.completed);
  const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

  try {
    const response = await fetch("/api/updateTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        completed: nextStatus,
        sheetName: tab === "fac" ? "facSetupTasks" : "avSetupTasks",
      }),
    });

    if (!response.ok) throw new Error("Failed to update");

    task.completed = nextStatus;
    renderSetupTable(tab);
  } catch (error) {
    console.error("상태 업데이트 실패:", error);
    alert("상태 업데이트 실패");
  }
}

let currentMemoTab = null;
let currentMemoTaskId = null;

function openMemoPopup(tab, taskId) {
  currentMemoTab = tab;
  currentMemoTaskId = taskId;

  const setupTasks = tab === "fac" ? db.facsetupTasks : db.avsetupTasks;
  const task = setupTasks.find((t) => t.id == taskId);

  document.getElementById("memo-textarea").value = task?.memo || "";
  document.getElementById("memo-popup").classList.remove("hidden");
}

function closeMemoPopup() {
  document.getElementById("memo-popup").classList.add("hidden");
  currentMemoTab = null;
  currentMemoTaskId = null;
}

async function saveMemo() {
  const memo = document.getElementById("memo-textarea").value.trim();
  if (!currentMemoTab || currentMemoTaskId == null) return;

  const setupTasks =
    currentMemoTab === "fac" ? db.facsetupTasks : db.avsetupTasks;
  const task = setupTasks.find((t) => t.id == currentMemoTaskId);
  if (!task) return;

  // 서버 저장
  try {
    const res = await fetch("/api/updateMemo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, memo, tab: currentMemoTab }),
    });
    if (!res.ok) throw new Error("서버 응답 오류");

    // 로컬 반영 + UI 갱신
    task.memo = memo;
    renderSetupTable(currentMemoTab);
    closeMemoPopup();
  } catch (err) {
    console.error("❌ 메모 저장 실패:", err);
    alert("메모 저장에 실패했습니다.");
  }
}

function renderOperationSchedule() {
  const tableBody = document.getElementById("operation-schedule-table");
  tableBody.innerHTML = "";

  const filteredSchedule = db.operationSchedule.filter(
    (slot) => slot.date === state.operationDay
  );

  // 시간대 기준으로 데이터 추출
  const timeSlots = {
    오전: filteredSchedule.find((s) => s.time === "오전") || {},
    오후: filteredSchedule.find((s) => s.time === "오후") || {},
  };

  // 팀 키값과 팀 이름 정의
  const teams = ["audio", "video", "stage", "it", "etc"];
  const teamNames = {
    audio: "오디오",
    video: "비디오",
    stage: "무대",
    it: "IT",
    etc: "공통",
  };

  // 팀별로 행 생성
  teams.forEach((team) => {
    const row = document.createElement("tr");
    row.className = "border-b border-slate-200 hover:bg-slate-50";
    row.innerHTML = `
      <td class="p-3 font-semibold min-w-[80px]">${teamNames[team]}</td>
      <td class="p-3 w-1/2">${timeSlots["오전"][team] || ""}</td>
      <td class="p-3 w-1/2">${timeSlots["오후"][team] || ""}</td>
    `;
    tableBody.appendChild(row);
  });
}

function parseDayLabel(timeStr = "") {
  if (timeStr.includes("첫째날")) return 1;
  if (timeStr.includes("둘째날")) return 2;
  if (timeStr.includes("셋째날")) return 3;
  return null;
}

function parseTimeLabel(timeStr = "") {
  const match = timeStr.match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : "";
}

function renderSoundAnalysis() {
  const timeFilterEl = document.getElementById("sound-time-filter");
  const currentDay = parseInt(
    document.getElementById("sound-day-filter").value || "1"
  );
  const timeOptionsRaw = timeOptionMap[currentDay] || [];
  const timeOptions = timeOptionsRaw.map((label) => {
    const match = label.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : "";
  });

  timeFilterEl.innerHTML = "";
  timeOptions.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    if (time === state.soundFilter.time) {
      option.selected = true;
    }
    timeFilterEl.appendChild(option);
  });

  // 선택값 유효성 검사 및 state 반영
  if (!timeOptions.includes(state.soundFilter.time)) {
    state.soundFilter.time = timeOptions[0]; // fallback
  }

  state.soundFilter.day = currentDay;
  timeFilterEl.value = state.soundFilter.time;

  const { day, time } = state.soundFilter;

  // heatmap용 필터링
  const filteredData = db.soundData.filter((d) => {
    return parseDayLabel(d.Time) === day && parseTimeLabel(d.Time) === time;
  });

  const heatmapDataPoints = [];
  let number = 1;

  for (let rowIndex = 3; rowIndex >= 0; rowIndex--) {
    for (let colIndex = 0; colIndex < 9; colIndex++) {
      const isLeftEdge = colIndex === 0;
      const isRightEdge = colIndex === 8;
      const isOnlyAllowedRowAtSides = rowIndex === 1;
      const isBottomRow = rowIndex === 0;
      const isAllowedBottomCol = colIndex === 2 || colIndex === 6;

      if (
        ((isLeftEdge || isRightEdge) && !isOnlyAllowedRowAtSides) ||
        (isBottomRow && !isAllowedBottomCol)
      ) {
        continue;
      }

      let seatNo;
      if (rowIndex === 1 && colIndex === 0) seatNo = 22;
      else if (rowIndex === 1 && colIndex === 8) seatNo = 23;
      else if (rowIndex === 0 && colIndex === 2) seatNo = 24;
      else if (rowIndex === 0 && colIndex === 6) seatNo = 25;
      else seatNo = number++;

      // filteredData에서 Location이 seatNo와 같은 항목 찾기
      const seatData = filteredData.find((d) => Number(d.Location) === seatNo);

      heatmapDataPoints.push({
        x: colIndex,
        y: rowIndex,
        v: seatData ? parseFloat(seatData.dB) : null,
        seatName: `#${seatNo}`,
        comment: seatData?.Comment || "",
      });
    }
  }

  const heatmapData = {
    datasets: [
      {
        label: "Seat Decibels",
        data: heatmapDataPoints,
        backgroundColor: (c) => getColorForDb(c.raw.v),
        borderColor: "rgba(255, 255, 255, 0.5)",
        borderWidth: 1,
        radius: 12, // 🔹 작게
      },
    ],
  };
  renderHeatmapChart(heatmapData);

  const timeLabels = timeOptionMap[currentDay] || [];
  // 트렌드 차트 구성
  const trendData = {
    labels: timeOptions,
    datasets: [
      {
        label: "일일 평균 데시벨",
        data: timeOptions.map((timeLabel) => {
          const matched = db.soundData.filter(
            (d) =>
              parseDayLabel(d.Time) === currentDay &&
              parseTimeLabel(d.Time) === timeLabel
          );
          return matched.length
            ? matched.reduce((sum, d) => sum + parseFloat(d.dB), 0) /
                matched.length
            : NaN;
        }),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.2,
      },
    ],
  };

  renderTrendChart(trendData);
  document.getElementById(
    "sound-trend-title"
  ).textContent = `시간대별 데시벨 트렌드 (${day}일차)`;
}

function renderHeatmapChart(data) {
  const ctx = document.getElementById("soundHeatmapChart").getContext("2d");
  if (charts.heatmap) charts.heatmap.destroy();

  charts.heatmap = new Chart(ctx, {
    type: "bubble",
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 5 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (context) => `좌석: ${context[0].raw.seatName}`,
            label: (context) => {
              const value = context.raw.v;
              const comment = context.raw.comment;
              return value !== null
                ? `데시벨: ${value.toFixed(1)} dB${
                    comment ? ` / ${comment}` : ""
                  }`
                : "데이터 없음";
            },
          },
        },
      },
      scales: {
        y: {
          min: -0.5,
          max: 3.5, // 항상 4행
          grid: { display: false },
          ticks: { display: false },
        },
        x: {
          min: -0.5,
          max: 8.5, // 항상 9열
          grid: { display: false },
          ticks: { display: false },
        },
      },
    },
  });
}

function renderTrendChart(data) {
  const ctx = document.getElementById("soundTrendChart").getContext("2d");
  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(ctx, {
    type: "line",
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: 60,
          suggestedMax: 95,
          title: { display: true, text: "평균 데시벨(dB)" },
        },
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            normalRange: {
              type: "box",
              yMin: 65,
              yMax: 80,
              backgroundColor: "rgba(74, 222, 128, 0.15)",
              borderColor: "rgba(34, 197, 94, 0.3)",
              borderWidth: 1,
              borderDash: [6, 6],
              label: {
                content: "평상시",
                display: true,
                position: "start",
                font: { size: 10 },
                color: "rgba(22, 101, 52, 0.7)",
              },
            },
            // --- 85데시벨 경고 기준선 (수정된 부분) ---
            criticalLine: {
              type: "box",
              yMin: 85, // yValue 대신 yMin 사용
              yMax: 85, // yValue 대신 yMax 사용
              scaleID: "y",
              borderColor: "rgb(239, 68, 68)",
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                content: "경고 기준",
                display: true,
                position: "end",
                font: { weight: "bold" },
                color: "rgb(239, 68, 68)",
                backgroundColor: "rgba(255, 255, 255, 0.5)",
              },
            },
          },
        },
      },
    },
  });
}

function renderTimetableCalendar(selectedDate = "2025-08-13") {
  const container = document.getElementById("timetable-container");
  container.innerHTML = ""; // 초기화

  const partColors = {
    "시설부 무대설치A팀": "#3B82F6",
    "시설부 무대설치B팀": "#60A5FA",
    "시설부 전기팀": "#93C5FD",
    "시설부 설비팀": "#BFDBFE",
    "시설부 간판팀": "#2563EB",
    "AV부 오디오트러스팀": "#EF4444",
    "AV부 사이드스피커팀": "#F97316",
    "AV부 오디오AV데스크팀": "#F59E0B",
    "AV부 전기팀": "#EA580C",
    "AV부 전광판트러스팀": "#C026D3",
    "AV부 비디오케이블팀": "#A21CAF",
    "AV부 비디오AV데스크팀": "#DB2777",
    "AV부 무대팀": "#E11D48",
    "AV부 IT팀": "#DC2626",
  };

  // ⬇️ 날짜 필터 적용
  const filtered = db.timetable.filter((item) => item.date === selectedDate);

  const teams = Object.keys(partColors);
  const times = Array.from(new Set(filtered.map((item) => item.time))).sort(
    (a, b) => {
      return (
        new Date("1970-01-01T" + a.split(" - ")[0]) -
        new Date("1970-01-01T" + b.split(" - ")[0])
      );
    }
  );

  const cellMap = {};
  filtered.forEach(({ time, part, task }) => {
    if (!cellMap[time]) cellMap[time] = {};
    cellMap[time][part] = task;
  });

  const gridTemplate = `grid grid-cols-[120px_repeat(${teams.length},minmax(140px,1fr))] border text-sm w-fit`;
  const grid = document.createElement("div");
  grid.className = gridTemplate;

  grid.appendChild(createCell("시간", true, true));
  teams.forEach((team) => grid.appendChild(createCell(team, true)));

  times.forEach((time) => {
    grid.appendChild(createCell(time, false, true));
    teams.forEach((team) => {
      const task = cellMap[time]?.[team] || "";
      const color = partColors[team] || "#E5E7EB";
      const cell = createCell(task);
      if (task) {
        cell.style.backgroundColor = color;
        cell.style.color = "white";
        cell.style.fontWeight = "500";
        cell.style.borderRadius = "4px";
        cell.style.whiteSpace = "pre-line";
      }
      grid.appendChild(cell);
    });
  });

  container.appendChild(grid);

  function createCell(content, isHeader = false, isSticky = false) {
    const div = document.createElement("div");
    div.textContent = content;
    div.className = `p-2 border border-gray-300 ${
      isHeader ? "bg-gray-100 font-bold text-center" : "bg-white"
    }`;
    if (isSticky) {
      div.classList.add("sticky", "left-0", "z-10", "bg-white");
    }
    return div;
  }
}

function renderSoundSummary() {
  const avgEl = document.getElementById("avg-db-summary");
  const alertEl = document.getElementById("db-alert-summary");
  const dailyEl = document.getElementById("daily-avg-summary");
  const titleEl = document.getElementById("sound-summary-title");

  const now = new Date();

  const enriched = db.soundData
    .map((row) => {
      const parsedTime = parseTimeToDateObject(row.Time);
      return parsedTime ? { ...row, parsedTime } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.parsedTime - b.parsedTime);

  if (!enriched.length) {
    avgEl.textContent = alertEl.textContent = dailyEl.textContent = "N/A";
    return;
  }

  // 현재 이후 중 가장 가까운 값, 없으면 마지막 값
  let target = enriched.find((r) => r.parsedTime > now);
  if (!target) target = enriched[enriched.length - 1];

  // target 기준 Time을 기준으로 평균, 경고 계산
  const group = enriched.filter((r) => r.Time === target.Time);
  const dbValues = group.map((r) => parseFloat(r.dB)).filter(Number.isFinite);

  const currentAvg = dbValues.length
    ? dbValues.reduce((a, b) => a + b, 0) / dbValues.length
    : NaN;
  const alerts = group.filter((r) => parseFloat(r.dB) > 85).length;

  const dayLabel = target.Time.split(" - ")[0];
  const timeLabel = target.Time.match(/\d{1,2}:\d{2}/)?.[0] || "";

  // 일일 평균 계산
  const dayGroup = enriched.filter((r) => r.Time.startsWith(dayLabel));
  const dailyValues = dayGroup
    .map((r) => parseFloat(r.dB))
    .filter(Number.isFinite);
  const dailyAvg = dailyValues.length
    ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
    : NaN;

  // DOM 표시
  avgEl.textContent = Number.isFinite(currentAvg)
    ? `${currentAvg.toFixed(1)} dB`
    : "N/A";
  alertEl.textContent = `${alerts}건`;
  dailyEl.textContent = Number.isFinite(dailyAvg)
    ? `${dailyAvg.toFixed(1)} dB`
    : "N/A";
  titleEl.textContent = `음향 상태 (${dayLabel} ${timeLabel} 기준)`;
}

function renderOnDuty() {
  const titleEl = document.getElementById("on-duty-title");
  const tableBody = document.getElementById("on-duty-table");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const rows = Array.isArray(db.operationSchedule) ? db.operationSchedule : [];
  if (!rows.length) {
    titleEl.textContent = "운영 담당자";
    tableBody.innerHTML = `<tr><td class="p-3 text-slate-500" colspan="2">운영 일정이 없습니다.</td></tr>`;
    return;
  }

  // 1) 타겟 날짜 선택 (미래 우선, 없으면 최근 과거)
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const uniqueDates = [
    ...new Set(rows.map((r) => r.date).filter(Boolean)),
  ].sort();
  const futureDates = uniqueDates.filter((d) => d >= todayStr);
  const targetDate = futureDates.length
    ? futureDates[0]
    : uniqueDates[uniqueDates.length - 1];

  // 2) 표시할 슬롯 결정
  const now = new Date();
  const cutoff = new Date(); // 오늘 12:15
  cutoff.setHours(12, 15, 0, 0);

  let slotToShow = "오전";
  if (targetDate === todayStr) {
    slotToShow = now >= cutoff ? "오후" : "오전";
  } else if (targetDate < todayStr) {
    slotToShow = "오후"; // 과거면 오후로 고정(마지막 슬롯 가정)
  } else {
    slotToShow = "오전"; // 미래면 오전으로 고정(첫 슬롯 가정)
  }

  titleEl.textContent = `운영 담당자 (${targetDate} · ${slotToShow})`;

  // 3) 해당 날짜의 요청 슬롯 가져오기
  const slotRow =
    rows.find((r) => r.date === targetDate && r.time === slotToShow) || {};

  // 4) 팀 목록 렌더(비어있으면 공백)
  const teams = ["audio", "video", "stage", "it", "etc"];
  const teamNames = {
    audio: "오디오",
    video: "비디오",
    stage: "무대",
    it: "IT",
    etc: "공통",
  };

  let hasAny = false;
  teams.forEach((team) => {
    const val = (slotRow[team] || "").toString().trim();
    if (val) hasAny = true;
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-200 hover:bg-slate-50";
    tr.innerHTML = `
      <td class="p-3 font-semibold min-w-[80px]">${teamNames[team]}</td>
      <td class="p-3">${val}</td>
    `;
    tableBody.appendChild(tr);
  });

  if (!hasAny) {
    tableBody.innerHTML = `<tr><td class="p-3 text-slate-500" colspan="2">${slotToShow} 담당자 정보가 없습니다.</td></tr>`;
  }
}

function parseTimeToDateObject(timeStr) {
  if (!timeStr) return null;
  const dayMap = {
    첫째날: "2025-08-15",
    둘째날: "2025-08-16",
    셋째날: "2025-08-17",
  };

  const dayMatch = timeStr.match(/(첫째날|둘째날|셋째날)/);
  const timeMatch = timeStr.match(/(\d{1,2}:\d{2})/);

  if (!dayMatch || !timeMatch) return null;

  const dateStr = dayMap[dayMatch[1]];
  const timeStrFormatted = timeMatch[1];

  return new Date(`${dateStr}T${timeStrFormatted}`);
}

function getColorForDb(dbValue) {
  if (dbValue === null || dbValue === undefined) {
    return "rgba(226, 232, 240, 0.8)"; // Gray for no data
  }

  if (dbValue > 85) {
    return "rgba(239, 68, 68, 0.8)"; // 85 초과 (붉은색)
  } else if (dbValue >= 75) {
    // 75-85: 라임색 -> 주황색 그라데이션
    const intensity = (dbValue - 75) / (85 - 75);
    const r = Math.round(163 + (251 - 163) * intensity);
    const g = Math.round(230 + (191 - 230) * intensity);
    const b = Math.round(53 + (36 - 53) * intensity);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  } else if (dbValue >= 70) {
    return "rgba(74, 222, 128, 0.8)"; // 70-75: 녹색
  } else if (dbValue >= 50) {
    // 50-70: 회색 -> 녹색 그라데이션
    const intensity = (dbValue - 50) / (70 - 50);
    const r = Math.round(209 + (74 - 209) * intensity);
    const g = Math.round(213 + (222 - 213) * intensity);
    const b = Math.round(219 + (128 - 219) * intensity);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  } else {
    return "rgba(209, 213, 219, 0.8)"; // 50 미만 (회색)
  }
}

// --- EVENT HANDLERS & INITIALIZATION ---
function handleNavClick(e) {
  if (!e.target.dataset.tab) return;
  state.activeTab = e.target.dataset.tab;
  updateView();
}

function handleFilterClick(e) {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;

  // 팀 필터 버튼
  if (btn.classList.contains("team-filter-btn")) {
    const team = btn.dataset.team;
    const tab = btn.closest("#facsetup-content") !== null ? "fac" : "av";

    if (tab === "fac") {
      state.facSetupFilter = team;
      document
        .querySelectorAll("#facsetup-content .team-filter-btn")
        .forEach((b) => b.classList.remove("active"));
    } else {
      state.avSetupFilter = team;
      document
        .querySelectorAll("#avsetup-content .team-filter-btn")
        .forEach((b) => b.classList.remove("active"));
    }

    renderSetupTable(tab);
  } else if (btn.classList.contains("op-day-filter")) {
    state.operationDay = btn.dataset.day;
    document
      .querySelectorAll(".op-day-filter")
      .forEach((b) => b.classList.remove("active"));
    renderOperationSchedule();
  }

  // 활성화 표시
  btn.classList.add("active");
}

function handleSoundFilterChange() {
  state.soundFilter.day = parseInt(
    document.getElementById("sound-day-filter").value
  );
  state.soundFilter.time = document.getElementById("sound-time-filter").value;

  renderSoundAnalysis();
}

function updateView() {
  if (!state.facSetupFilter) state.facSetupFilter = "All";
  if (!state.avSetupFilter) state.avSetupFilter = "All";

  document
    .querySelectorAll(".content-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  document
    .getElementById(`${state.activeTab}-content`)
    .classList.remove("hidden");

  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.tab === state.activeTab)
    );

  switch (state.activeTab) {
    case "dashboard":
      renderDashboard();
      break;
    case "facsetup":
      renderSetupTable("fac");
      break;
    case "avsetup":
      renderSetupTable("av");
      break;
    case "operation":
      renderOperationSchedule();
      break;
    case "sound":
      renderSoundAnalysis();
      break;
    case "timetable":
      renderTimetableCalendar();
      break;
  }
}

window.onload = async () => {
  const loadingOverlay = document.getElementById("loading-overlay");

  // Register Chart.js plugin only if it exists
  if (window.ChartAnnotation) {
    Chart.register(window.ChartAnnotation);
  }

  await loadAllData();

  loadingOverlay.style.opacity = "0";
  setTimeout(() => (loadingOverlay.style.display = "none"), 300);

  document
    .getElementById("facsetup-content")
    .addEventListener("click", handleFilterClick);

  document
    .getElementById("avsetup-content")
    .addEventListener("click", handleFilterClick);

  // Set up event listeners
  document
    .getElementById("refresh-button")
    .addEventListener("click", async () => {
      loadingOverlay.style.display = "flex";
      loadingOverlay.style.opacity = "1";
      await loadAllData();
      updateView();
      loadingOverlay.style.opacity = "0";
      setTimeout(() => (loadingOverlay.style.display = "none"), 300);
    });

  document
    .getElementById("fac-setup-tasks-table")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".status-chip");
      if (!btn) return;
      const taskId = parseInt(btn.dataset.taskId);
      updateTaskStatus(taskId, "fac");
    });

  document
    .getElementById("av-setup-tasks-table")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".status-chip");
      if (!btn) return;
      const taskId = parseInt(btn.dataset.taskId);
      updateTaskStatus(taskId, "av");
    });

  document.querySelector("nav").addEventListener("click", handleNavClick);
  document
    .getElementById("operation-content")
    .addEventListener("click", handleFilterClick);
  document
    .getElementById("sound-day-filter")
    .addEventListener("change", handleSoundFilterChange);
  document
    .getElementById("sound-time-filter")
    .addEventListener("change", handleSoundFilterChange);

  // 날짜 필터링
  document.getElementById("facdate-filter").addEventListener("change", (e) => {
    state.facCurrentDateFilter = e.target.value;
    renderSetupTable("fac");
  });

  document.getElementById("avdate-filter").addEventListener("change", (e) => {
    state.avCurrentDateFilter = e.target.value;
    renderSetupTable("av");
  });

  const select = document.getElementById("timetable-filter");
  renderTimetableCalendar(select.value); // 초기 렌더

  select.addEventListener("change", (e) => {
    renderTimetableCalendar(e.target.value); // 선택 시 재렌더
  });

  // Initial render
  document
    .querySelector('.tab-btn[data-tab="dashboard"]')
    .classList.add("active");

  updateView();
};
