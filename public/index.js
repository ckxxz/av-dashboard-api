// --- DATA ---
const db = {
  facsetupTasks: [],
  avsetupTasks: [],
  operationSchedule: [],
  soundData: [],
  soundSettings: { minDb: 65, maxDb: 80 },
  seatLayout: [
    ["11", "12", "13"],
    ["6", "7", "8", "9", "10"],
    ["1", "2", "3", "4", "5"],
  ],
  timetable: [], // ✅ 추가
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
        //   fetch("/api/SoundData").then((res) => {
        //     if (!res.ok) throw new Error("Failed to fetch SoundData");
        //     return res.json();
        //   }),
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
    console.log("타임테이블 데이터 확인:", db.timetable);
    //   db.soundData = soundData.map((d) => ({
    //     day: d.day,
    //     time: d.time,
    //     seat: d.seat,
    //     db: parseFloat(d.db),
    //   }));

    console.log(db.facsetupTasks[0]);
    console.log(db.avsetupTasks[0]);
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
  operationDay: "2025-07-04",
  soundFilter: { day: 1, time: 1 },
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

function renderTeamProgressCharts(setupTasks, prefix) {
  const teams = [...new Set(setupTasks.map((t) => t.team))];
  const teamProgress = {};

  teams.forEach((team) => {
    const teamTasks = setupTasks.filter((t) => t.team === team);
    teamProgress[team] = {
      total: teamTasks.length,
      completed: teamTasks.filter((t) => t.completed).length,
    };
  });

  const overall = {
    total: setupTasks.length,
    completed: setupTasks.filter((t) => t.completed).length,
  };

  renderDonutChart(
    `${prefix}OverallProgressChart`,
    "전체",
    overall.completed,
    overall.total
  );

  teams.forEach((team, i) => {
    const canvasId = `${prefix}TeamProgressChart${i + 1}`;
    renderDonutChart(
      canvasId,
      team,
      teamProgress[team].completed,
      teamProgress[team].total
    );
  });
}

function renderDelayedTasks(setupTasks, containerId) {
  const now = new Date();
  const delayedTasksList = document.getElementById(containerId);
  delayedTasksList.innerHTML = "";

  const delayedTasks = setupTasks.filter((task) => {
    if (!task.start) return false;
    const startTime = new Date(task.start);
    const endTime = new Date(startTime.getTime() + task.duration * 60000);
    return !task.completed && now > endTime;
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
  renderTeamProgressCharts(db.avsetupTasks, "av");
  renderTeamProgressCharts(db.facsetupTasks, "fac");

  renderDelayedTasks(db.avsetupTasks, "delayed-tasks-list-av");
  renderDelayedTasks(db.facsetupTasks, "delayed-tasks-list-fac");

  // 음향 상태 요약 & 운영담당자 처리 등은 그대로 유지
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

function renderDonutChart(canvasId, label, completed, total) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (charts[canvasId]) charts[canvasId].destroy();

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const data = total > 0 ? [completed, total - completed] : [0, 1];

  charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["완료", "미완료"],
      datasets: [
        {
          data: data,
          backgroundColor: ["#22c55e", "#e2e8f0"],
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
          fontSize: canvasId.includes("overall") ? 40 : 20,
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

  const filteredTasks = setupTasks.filter(
    (task) => filter === "All" || task.team === filter
  );

  const now = new Date();

  filteredTasks.forEach((task, index) => {
    const startTime = task.start ? new Date(task.start) : null;
    const endTime = startTime
      ? new Date(startTime.getTime() + task.duration * 60000)
      : null;

    let rowClass = "";
    if (task.completed == "완료") {
      rowClass = "completed";
    } else if (endTime && now > endTime) {
      rowClass = "delayed";
    } else if (startTime && now >= startTime && now <= endTime) {
      rowClass = "in-progress";
    }

    const tr = document.createElement("tr");
    tr.className = `task-row border-b border-slate-200 hover:bg-slate-50 ${rowClass}`;
    tr.innerHTML = `
      <td class="p-3"><span class="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">${
        task.team
      }</span></td>
      <td class="p-3 text-center">
        <button data-task-id="${
          task.id
        }" class="status-chip px-2 py-1 rounded-full text-white text-xs font-semibold ${
      statusColorMap[task.completed] || "bg-gray-300"
    }">${task.completed}</button>
      </td>
      <td class="p-3 font-semibold">${task.task}</td>
      <td class="p-3 text-center">
        ${
          task.memo && task.memo.trim() !== ""
            ? `<button onclick="openMemoPopup('${tab}', ${index})" title="메모 있음">💬</button>`
            : `<button onclick="openMemoPopup('${tab}', ${index})" title="메모 없음" class="opacity-30">💬</button>`
        }
      </td>
      <td class="p-3">${task.person}</td>
      <td class="p-3">${task.duration}분</td>
      <td class="p-3">${
        startTime
          ? startTime.toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "미정"
      }</td>
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
let currentMemoIndex = null;

function openMemoPopup(tab, index) {
  currentMemoTab = tab;
  currentMemoIndex = index;

  const setupTasks = tab === "fac" ? db.facsetupTasks : db.avsetupTasks;
  const task = setupTasks[index];

  document.getElementById("memo-textarea").value = task.memo || "";
  document.getElementById("memo-popup").classList.remove("hidden");
}

function closeMemoPopup() {
  document.getElementById("memo-popup").classList.add("hidden");
  currentMemoTab = null;
  currentMemoIndex = null;
}

function saveMemo() {
  const memo = document.getElementById("memo-textarea").value.trim();

  if (currentMemoTab !== null && currentMemoIndex !== null) {
    const setupTasks =
      currentMemoTab === "fac" ? db.facsetupTasks : db.avsetupTasks;
    setupTasks[currentMemoIndex].memo = memo;

    // ✅ UI 업데이트
    renderSetupTable(currentMemoTab);

    // TODO: 실제 서버/스프레드시트에 저장하는 로직 필요
    saveMemo();
    closeMemoPopup();
  }
}

function saveMemo() {
  const memo = document.getElementById("memo-textarea").value.trim();

  if (currentMemoTab !== null && currentMemoIndex !== null) {
    const setupTasks =
      currentMemoTab === "fac" ? db.facsetupTasks : db.avsetupTasks;
    const task = setupTasks[currentMemoIndex];

    task.memo = memo; // UI용 db에도 반영

    // ✅ 서버에 저장
    fetch("/api/updateMemo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: task.id, // 반드시 스프레드시트의 ID 값이여야 함
        memo: memo,
        tab: currentMemoTab, // "fac" 또는 "av"
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("서버 응답 오류");
        return res.json();
      })
      .then((data) => {
        console.log("✅ 메모 저장 성공:", data.message);
        renderSetupTable(currentMemoTab);
        closeMemoPopup();
      })
      .catch((err) => {
        console.error("❌ 메모 저장 실패:", err);
        alert("메모 저장에 실패했습니다.");
      });
  }
}

function renderOperationSchedule() {
  const tableBody = document.getElementById("operation-schedule-table");
  tableBody.innerHTML = "";
  const filteredSchedule = db.operationSchedule.filter(
    (slot) => slot.date === state.operationDay
  );

  filteredSchedule.forEach((slot) => {
    tableBody.innerHTML += `
              <tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="p-3 font-semibold">${slot.time}</td>
                  <td class="p-3">${slot.audio}</td>
                  <td class="p-3">${slot.video}</td>
                  <td class="p-3">${slot.stage}</td>
                  <td class="p-3">${slot.it}</td>
                  <td class="p-3">${slot.backup}</td>
              </tr>
          `;
  });
}

function renderSoundAnalysis() {
  const timeFilterEl = document.getElementById("sound-time-filter");
  timeFilterEl.innerHTML = ""; // 기존 옵션 제거

  const currentDay = parseInt(
    document.getElementById("sound-day-filter").value || "1"
  );

  // 현재 day의 고유한 time 라벨 추출
  const timeLabels = Array.from(
    new Set(db.soundData.filter((d) => d.day === currentDay).map((d) => d.time))
  );

  // 드롭다운 옵션 생성
  timeLabels.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    if (label === state.soundFilter.time) {
      option.selected = true;
    }
    timeFilterEl.appendChild(option);
  });

  // state 초기화 (필요 시)
  if (!timeLabels.includes(state.soundFilter.time)) {
    state.soundFilter.time = timeLabels[0];
  }

  state.soundFilter.day = currentDay;
  timeFilterEl.value = state.soundFilter.time;

  const { day, time } = state.soundFilter;

  // heatmap용 필터링
  const filteredData = db.soundData.filter(
    (d) => d.day === day && d.time === time
  );

  const heatmapDataPoints = [];
  const maxCols = Math.max(...db.seatLayout.map((r) => r.length));

  db.seatLayout.forEach((row, rowIndex) => {
    const offset = (maxCols - row.length) / 2;
    row.forEach((seat, seatIndex) => {
      const seatData = filteredData.find((d) => d.seat === seat);
      heatmapDataPoints.push({
        x: seatIndex + offset,
        y: rowIndex,
        v: seatData ? seatData.db : null,
        seatName: seat,
      });
    });
  });

  const heatmapData = {
    datasets: [
      {
        label: "Seat Decibels",
        data: heatmapDataPoints,
        backgroundColor: (c) => getColorForDb(c.raw.v),
        borderColor: "rgba(255, 255, 255, 0.5)",
        borderWidth: 1,
        radius: 20,
      },
    ],
  };
  renderHeatmapChart(heatmapData);

  // 트렌드 차트 구성
  const trendData = {
    labels: timeLabels,
    datasets: [
      {
        label: `일일 평균 데시벨`,
        data: timeLabels.map((label) => {
          const timeData = db.soundData.filter(
            (d) => d.day === currentDay && d.time === label
          );
          return timeData.length
            ? timeData.reduce((acc, d) => acc + d.db, 0) / timeData.length
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
              return value !== null
                ? `데시벨: ${value.toFixed(1)} dB`
                : "데이터 없음";
            },
          },
        },
      },
      scales: {
        y: {
          min: -0.5,
          max: db.seatLayout.length - 0.5,
          grid: { display: false },
          ticks: { display: false },
        },
        x: {
          min: -0.5,
          max: Math.max(...db.seatLayout.map((r) => r.length)) - 0.5,
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

function renderTimetableCalendar() {
  const calendarEl = document.getElementById("calendar");

  if (calendar) calendar.destroy(); // 재렌더링 시 파괴

  const events = db.timetable.map((slot) => {
    const [startTime, endTime] = slot.time.split("-").map((t) => t.trim());

    let bgColor = "#9CA3AF"; // 기본 회색
    if (slot.part === "시설부") bgColor = "#3B82F6"; // 파랑
    else if (slot.part === "AV부") bgColor = "#EF4444"; // 빨강
    else if (slot.part === "청소부") bgColor = "#10B981"; // 초록
    else if (slot.part === "안내부") bgColor = "#F59E0B"; // 주황

    return {
      start: `${slot.date}T${startTime}`,
      end: `${slot.date}T${endTime}`,
      extendedProps: { ...slot },
      backgroundColor: bgColor,
      borderColor: "transparent",
      textColor: "white",
    };
  });

  const startDate = db.timetable.length
    ? db.timetable.reduce(
        (earliest, item) => (item.date < earliest ? item.date : earliest),
        db.timetable[0].date
      )
    : new Date().toISOString().split("T")[0];

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "customThreeDay",
    initialDate: startDate,
    locale: "ko",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridDay,customThreeDay,customFiveDay",
    },
    buttonText: {
      today: "오늘",
      prev: "이전",
      next: "다음",
      timeGridDay: "1일",
    },
    views: {
      customThreeDay: {
        type: "timeGrid",
        duration: { days: 3 },
        buttonText: "3일",
      },
      customFiveDay: {
        type: "timeGrid",
        duration: { days: 5 },
        buttonText: "5일",
      },
    },
    allDaySlot: false,
    slotMinTime: "06:00:00",
    slotMaxTime: "20:00:00",
    events,
    eventClick: (info) => {
      const { part, task, assignee, time } = info.event.extendedProps;
      alert(
        `부서: ${part}\n작업내용: ${task}\n담당자: ${assignee}\n시간: ${time}`
      );
    },
    // ✅ 시간까지 포함한 커스텀 이벤트 출력
    eventContent: function (arg) {
      const { part, task, assignee, time } = arg.event.extendedProps;

      return {
        html: `
    <div style="font-weight:bold; font-size:14px; margin-top:1px;">
      ${time} ${part} (${assignee})
    </div>
    <div style="font-size:14px; margin-top:2px;">
      ${task}
    </div>
  `,
      };
    },
  });

  calendar.render();
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
  }

  // 운영 일정 필터
  else if (btn.classList.contains("op-day-filter")) {
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
      renderTimetableCalendar(); // ✅ FullCalendar 렌더링
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
      updateTaskStatus(taskId);
    });

  document
    .getElementById("av-setup-tasks-table")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".status-chip");
      if (!btn) return;
      const taskId = parseInt(btn.dataset.taskId);
      updateTaskStatus(taskId);
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

  // Initial render
  document
    .querySelector('.tab-btn[data-tab="dashboard"]')
    .classList.add("active");
  updateView();
};
