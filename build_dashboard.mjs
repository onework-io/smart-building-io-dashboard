import fs from "node:fs/promises";
import path from "node:path";

const projectDir = "C:/Users/User/OneDrive/Desktop/中工檔案/outputs/01a090d3-4b88-72e0-b217-535905da4cc7/智慧建築_IO_Dashboard";
const sourcePath = "C:/Users/User/OneDrive/Desktop/中工檔案/.codex-spreadsheet-work/grouped_profiles_v3.json";
const extractedPath = "C:/Users/User/OneDrive/Desktop/中工檔案/.codex-spreadsheet-work/extracted_io.json";
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const extracted = JSON.parse(await fs.readFile(extractedPath, "utf8"));
const labels = {
  "電力 01":"01 電力", "照明 02":"02 照明", "空調 03":"03 空調", "消防 04":"04 消防",
  "給排水 05":"05 給排水", "水表 06":"06 水表", "數位監視 07":"07 數位監視", "門禁 08":"08 門禁",
  "緊急求救對講 09":"09 緊急求救", "安防 10":"10 安防", "停管 11":"11 停管", "充電樁 12":"12 充電樁",
  "太陽能 13":"13 太陽能", "電梯 14":"14 電梯", "噴灌 15":"15 噴灌", "其他 16":"16 其他"
};
const clean = value => String(value || "")
  .replaceAll("［硬接點］", "").replaceAll("［通訊］", "")
  .replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
const split = value => clean(value).split("、").map(s => s.trim()).filter(Boolean);
const systems = source.categories.map((category, index) => ({
  id: index + 1,
  name: labels[category] || category,
  short: (labels[category] || category).replace(/^\d+\s*/, ""),
  groups: source.groups[category].map(row => ({
    group: clean(row.second), equipment: clean(row.third),
    quantity: Number.isFinite(Number(row.equipment_qty)) ? Number(row.equipment_qty) : null,
    di: split(row.di_points), ai: split(row.ai_points)
  })).filter(row => row.di.length || row.ai.length)
}));

// 污廢水點位由補充的 RS-485 通訊表提供，集中顯示於 05 給排水。
systems[4].groups = [
  ...systems[4].groups.filter(row => !["生活污水回收電盤", "製程廢水處理"].includes(row.equipment)),
  { group: "污廢水處理廠（餐廳與製程廢水）", equipment: "處理設備", quantity: 26, di: ["運轉", "過載"], ai: [] },
  { group: "污廢水處理廠（餐廳與製程廢水）", equipment: "池槽液位", quantity: 3, di: ["H液位", "HH液位"], ai: [] },
  { group: "污廢水處理廠（中水回收）", equipment: "處理設備及電動閥", quantity: 30, di: ["運轉", "過載", "閥開啟"], ai: [] },
  { group: "污廢水處理廠（中水回收）", equipment: "池槽液位", quantity: 5, di: ["L液位", "H液位", "HH液位"], ai: [] },
];

const phaseOf = area => String(area || "").startsWith("乙") ? "乙區" : String(area || "").startsWith("甲") ? "甲區" : null;
const areaTotals = {};
for (const category of source.categories) areaTotals[category] = { "甲區": 0, "乙區": 0 };
for (const row of extracted.records) {
  const phase = phaseOf(row.area);
  if (phase && areaTotals[row.category]) areaTotals[row.category][phase] += Number(row.qty || 0);
}
for (const value of Object.values(areaTotals)) {
  value["甲區"] = Math.round(value["甲區"] * 100) / 100;
  value["乙區"] = Math.round(value["乙區"] * 100) / 100;
}
// 空調依甲、乙區空調 IO 的黃色彙總分類；停車場通風延續列 22 台併入同一分類。
areaTotals["空調 03"] = { "甲區": 3912, "乙區": 3886 };

const floorData = Object.fromEntries(["lighting","socket","fire","drainage","water","smoke"].map(key => [key,{"甲區":{},"乙區":{}}]));
const addFloor = (key,row) => {
  const phase = phaseOf(row.area), floor = String(row.floor || "").trim();
  if (!phase || !floor || !floorData[key]) return;
  floorData[key][phase][floor] = (floorData[key][phase][floor] || 0) + Number(row.qty || 0);
};
for (const row of extracted.records) {
  const sub = String(row.source_subitem || "");
  const ai = String(row.ai_points || "");
  const eq = String(row.equipment || "") + String(row.subcategory || "");
  if (sub.includes("照明用電") && /kWH|KWH|用電度數|仟瓦時/.test(ai)) addFloor("lighting",row);
  if (sub.includes("插座用電") && /kWH|KWH|用電度數|仟瓦時/.test(ai)) addFloor("socket",row);
  if (sub.includes("消防用電") && /kWH|KWH|用電度數|仟瓦時/.test(ai)) addFloor("fire",row);
  if (sub.includes("給排水用電") && /kWH|KWH|用電度數|仟瓦時/.test(ai)) addFloor("drainage",row);
  if (row.category === "水表 06" && /累計流量/.test(ai)) addFloor("water",row);
  if (/排煙/.test(eq) && row.di_points) addFloor("smoke",row);
}
const template = await fs.readFile(path.join(projectDir, "template.html"), "utf8");
const safeJson = JSON.stringify(systems).replaceAll("</script", "<\\/script");
const html = template
  .replace("__SYSTEM_DATA__", safeJson)
  .replace("__AREA_DATA__", JSON.stringify(areaTotals).replaceAll("</script", "<\\/script"))
  .replace("__FLOOR_DATA__", JSON.stringify(floorData).replaceAll("</script", "<\\/script"));
await fs.mkdir(path.join(projectDir, "dist"), { recursive: true });
await fs.writeFile(path.join(projectDir, "dist", "index.html"), html, "utf8");
console.log(`Generated operational dashboard with ${systems.length} system pages.`);
