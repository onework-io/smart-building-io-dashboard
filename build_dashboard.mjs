import fs from "node:fs/promises";
import path from "node:path";

const projectDir = "C:/Users/User/OneDrive/Desktop/中工檔案/outputs/01a090d3-4b88-72e0-b217-535905da4cc7/智慧建築_IO_Dashboard";
const sourcePath = "C:/Users/User/OneDrive/Desktop/中工檔案/.codex-spreadsheet-work/grouped_profiles_v3.json";
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
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
const template = await fs.readFile(path.join(projectDir, "template.html"), "utf8");
const safeJson = JSON.stringify(systems).replaceAll("</script", "<\\/script");
const html = template.replace("__SYSTEM_DATA__", safeJson);
await fs.mkdir(path.join(projectDir, "dist"), { recursive: true });
await fs.writeFile(path.join(projectDir, "dist", "index.html"), html, "utf8");
console.log(`Generated operational dashboard with ${systems.length} system pages.`);
