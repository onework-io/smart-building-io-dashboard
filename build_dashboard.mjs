import fs from "node:fs/promises";
import path from "node:path";

const projectDir = "C:/Users/User/OneDrive/Desktop/中工檔案/outputs/01a090d3-4b88-72e0-b217-535905da4cc7/智慧建築_IO_Dashboard";
const sourcePath = "C:/Users/User/OneDrive/Desktop/中工檔案/.codex-spreadsheet-work/grouped_profiles_v3.json";
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));

const tabNames = {
  "電力 01": "01 電力", "照明 02": "02 照明", "空調 03": "03 空調", "消防 04": "04 消防",
  "給排水 05": "05 給排水", "水表 06": "06 水表", "數位監視 07": "07 數位監視", "門禁 08": "08 門禁",
  "緊急求救對講 09": "09 緊急求救", "安防 10": "10 安防", "停管 11": "11 停管", "充電樁 12": "12 充電樁",
  "太陽能 13": "13 太陽能", "電梯 14": "14 電梯", "噴灌 15": "15 噴灌", "其他 16": "16 其他"
};

function cleanLabel(value) {
  return String(value || "")
    .replaceAll("［硬接點］", "").replaceAll("[硬接點]", "")
    .replaceAll("［通訊］", "").replaceAll("[通訊]", "")
    .replace(/\s*\n\s*/g, " ").trim();
}

function parsePoints(value, equipmentQty, field, pairQuantity = false) {
  const items = value ? String(value).split("、").map(v => v.trim()).filter(Boolean) : [];
  const included = [];
  const excluded = [];
  let total = 0;
  for (const raw of items) {
    const item = cleanLabel(raw);
    const multiplierPart = raw.includes("×") ? raw.slice(raw.lastIndexOf("×") + 1) : "";
    const multiplierMatch = multiplierPart.match(/^\s*(\d+(?:\.\d+)?)/);
    const multiplier = multiplierMatch ? Number(multiplierMatch[1]) : 1;
    const label = item.replace(/×\s*\d+(?:\.\d+)?(?:\s*（群組總計）)?\s*$/, "").trim();
    const isGeneric = raw.includes("數值") || /通訊點|EC FAN 回傳/i.test(raw);
    const isAmbiguous = /待確認|不確定|未明/.test(raw) || (multiplierPart && /\/|／|待/.test(multiplierPart));
    const isGroupTotal = raw.includes("群組總計");
    let quantity = Number(equipmentQty);
    if (pairQuantity) quantity /= 2;
    if (isGeneric || isAmbiguous || !Number.isInteger(multiplier) || multiplier <= 0) {
      excluded.push(label || item);
      continue;
    }
    let pointTotal;
    let calculation;
    if (isGroupTotal) {
      pointTotal = multiplier;
      calculation = `${multiplier.toLocaleString("zh-TW")} 點（群組總計）`;
    } else if (Number.isFinite(quantity) && quantity > 0 && Number.isInteger(quantity)) {
      pointTotal = multiplier * quantity;
      calculation = `${multiplier} 點/台 × ${quantity.toLocaleString("zh-TW")} 台 = ${pointTotal.toLocaleString("zh-TW")} 點`;
    } else {
      excluded.push(`${label || item}（設備數量未明）`);
      continue;
    }
    total += pointTotal;
    included.push({ field, label: label || item, total: pointTotal, calculation });
  }
  return { total, included, excluded };
}

function combine(...parts) {
  return {
    total: parts.reduce((sum, part) => sum + part.total, 0),
    included: parts.flatMap(part => part.included),
    excluded: parts.flatMap(part => part.excluded)
  };
}

const systems = source.categories.map((category, index) => {
  const rows = source.groups[category].map(row => {
    const di = combine(
      parsePoints(row.di_points, row.equipment_qty, "DI"),
      parsePoints(row.apfr_points, row.equipment_qty, "APFR"),
      parsePoints(row.common_points, row.equipment_qty, "共用DI", true)
    );
    const ai = parsePoints(row.ai_points, row.equipment_qty, "AI");
    return {
      equipment: row.third,
      quantity: Number.isFinite(Number(row.equipment_qty)) ? Number(row.equipment_qty) : null,
      di: di.total,
      ai: ai.total,
      included: [...di.included, ...ai.included],
      excluded: [...new Set([...di.excluded, ...ai.excluded])],
      source: row.source_refs,
      status: row.status
    };
  });
  return {
    id: `system-${String(index + 1).padStart(2, "0")}`,
    category,
    name: tabNames[category],
    rows,
    di: rows.reduce((sum, row) => sum + row.di, 0),
    ai: rows.reduce((sum, row) => sum + row.ai, 0)
  };
});

const dataJson = JSON.stringify(systems).replaceAll("</script", "<\\/script");
const template = await fs.readFile(path.join(projectDir, "template.html"), "utf8");
const html = template.replace("__DATA_JSON__", dataJson);

await fs.mkdir(path.join(projectDir, "dist"), { recursive: true });
await fs.writeFile(path.join(projectDir, "dist", "index.html"), html, "utf8");
console.log(JSON.stringify({ output: path.join(projectDir, "dist", "index.html"), systems: systems.length, totalDI: systems.reduce((s,x)=>s+x.di,0), totalAI: systems.reduce((s,x)=>s+x.ai,0) }, null, 2));
