const express = require("express");
const path = require("path");
const { google } = require("googleapis");

const app = express();
const port = process.env.PORT || 3080;

// JSON 요청 본문을 파싱하기 위해 미들웨어를 추가합니다.
app.use(express.json());

const SPREADSHEET_ID = "1lcRrWIEIUMg1NuB7i_7UIVKBAHNVPxH3L6CGycDiHU8"; // Google Sheet 문서 URL에서 ID 부분

// Google 인증 설정
const auth = new google.auth.GoogleAuth({
  keyFile: "goyang10-9c71f783c671.json", // 로컬 테스트용
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function getSheetsClient() {
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

app.get("/api/SoundData", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: "1Yemj02Vk8No_O9kzNxWF6jr73Vt31OWCcN0H-6xVvVg",
      range: "설문지 응답 시트1!A2:F", // ✅ 정확한 범위
    });

    const rows = response.data.values;

    if (!rows.length) {
      return res.status(204).send("No data available");
    }

    // ✅ 헤더를 명시적으로 지정
    const headers = [
      "Timestamp", // A
      "Name", // B
      "Location", // C
      "dB", // D
      "Comment", // E
      "Time", // F
    ];

    const data = rows.map((row) => {
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] || "";
      });
      return rowData;
    });

    res.json(data);
  } catch (error) {
    console.error("❌ Google Sheets fetch error:", error);
    res.status(500).send("Error fetching data from Google Sheets");
  }
});

// API 엔드포인트 설정
app.get("/api/:sheetName", async (req, res) => {
  try {
    const sheetName = req.params.sheetName;
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });

    const rows = response.data.values;
    if (rows.length) {
      const headers = rows[0];
      const data = rows.slice(1).map((row) => {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index];

          console.log("데이터 :" + rowData[header]);
        });
        return rowData;
      });
      res.json(data);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching data from Google Sheets");
  }
});

app.post("/api/updateTask", async (req, res) => {
  try {
    const { taskId, completed, sheetName } = req.body; // sheetName 추가
    const sheets = await getSheetsClient();

    if (!sheetName) {
      return res.status(400).send("sheetName is required");
    }

    // 1. 해당 taskId가 몇 번째 행에 있는지 찾습니다.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`, // 시트 이름 반영
    });

    const idColumn = response.data.values;
    let rowIndex = -1;
    if (idColumn) {
      rowIndex = idColumn.findIndex((row) => row[0] == taskId);
    }

    if (rowIndex === -1) {
      return res.status(404).send("Task ID not found");
    }

    const targetRow = rowIndex + 1; // 실제 시트 행 번호 (1부터 시작)
    const targetColumn = "G"; // 'completed' 열 위치

    // 2. 해당 셀의 값을 업데이트합니다.
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${targetColumn}${targetRow}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[completed]],
      },
    });

    res
      .status(200)
      .json({ success: true, message: "Task updated successfully" });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).send("Error updating task status");
  }
});

app.post("/api/updateMemo", async (req, res) => {
  try {
    const { taskId, memo, tab } = req.body; // tab: "fac" 또는 "av"
    const sheets = await getSheetsClient();

    const sheetName =
      tab === "fac" ? "facSetupTasks" : tab === "av" ? "avSetupTasks" : null;

    if (!sheetName) {
      return res.status(400).json({ error: "Invalid tab value" });
    }

    // 1. ID 열 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
    });

    const idColumn = response.data.values;
    let rowIndex = -1;
    if (idColumn) {
      rowIndex = idColumn.findIndex((row) => row[0] == taskId);
    }

    if (rowIndex === -1) {
      return res.status(404).send("Task ID not found");
    }

    const targetRow = rowIndex + 1; // 1-based index
    const memoColumn = "H"; // 예: 메모가 H열에 있다고 가정

    // 2. 메모 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${memoColumn}${targetRow}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[memo]],
      },
    });

    res.status(200).json({ success: true, message: "메모가 저장되었습니다" });
  } catch (error) {
    console.error("메모 저장 오류:", error);
    res.status(500).send("서버 오류");
  }
});

app.post("/api/updateTimetable", async (req, res) => {
  try {
    const { date, time, part, task, assignee } = req.body;
    const sheets = await getSheetsClient();

    // timeTable 시트의 마지막 행에 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "timeTable!A1:E1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [[date, time, part, task, assignee]],
      },
    });

    res.status(200).json({ success: true, message: "TimeTable 추가 성공" });
  } catch (error) {
    console.error("TimeTable 추가 실패:", error);
    res.status(500).send("TimeTable 추가 실패");
  }
});

// app.get("/api2/white-bc-values", async (req, res) => {
//   try {
//     const sheets = google.sheets({ version: "v4", auth });

//     const spreadsheetId = "1KilEm9Mr-AITP9pmBao_B5X1aIn8mdGjnEGZi_vzN_U";
//     const dayMap = {
//       "첫째날 정량평가": 1,
//       "둘째날 정량평가": 2,
//       "셋째날 정량평가": 3,
//     };

//     const result = [];

//     for (const [sheetName, day] of Object.entries(dayMap)) {
//       const range = `${sheetName}!B12:P43`;
//       const response = await sheets.spreadsheets.get({
//         spreadsheetId,
//         ranges: [range],
//         includeGridData: true,
//       });

//       const rows = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
//       let count = 1;

//       for (const row of rows) {
//         const values = row.values || [];
//         const timeLabel = values[0]?.formattedValue; // B열
//         const dCell = values[2]; // D열 배경색 판별 기준

//         if (!timeLabel || !dCell) continue;

//         const bg = dCell.effectiveFormat?.backgroundColor;
//         const r = Math.round((bg?.red ?? 0) * 255);
//         const g = Math.round((bg?.green ?? 0) * 255);
//         const b = Math.round((bg?.blue ?? 0) * 255);

//         const isWhite = r === 255 && g === 255 && b === 255;
//         if (!isWhite) continue;

//         const time = `${count}차 (${timeLabel})`;
//         count++;

//         for (let i = 2; i <= 14; i++) {
//           const dbCell = values[i];
//           const dbVal = parseFloat(dbCell?.formattedValue);
//           if (!isNaN(dbVal)) {
//             result.push({
//               day,
//               time,
//               seat: String(i - 1), // D열(i=2) → seat: "1"
//               db: dbVal,
//             });
//           }
//         }
//       }
//     }

//     console.log(result);
//     res.json(result);
//   } catch (err) {
//     console.error("❌ Error fetching white-bc-values:", err);
//     res.status(500).json({ error: "Failed to fetch data" });
//   }
// });

// 프론트엔드 파일(index.html) 제공
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 작업자 페이지 라우트 추가
app.get("/worker", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "worker.html"));
});

// public 폴더 생성 및 index.html 이동
// 프로젝트 루트에 public 폴더를 만들고 index.html을 그 안으로 옮겨주세요.
// server.js 코드가 / 경로 요청 시 public/index.html을 제공합니다.

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
