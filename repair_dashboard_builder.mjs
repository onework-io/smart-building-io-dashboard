import fs from "node:fs/promises";
import path from "node:path";

const projectDir = "C:/Users/User/OneDrive/Desktop/中工檔案/outputs/01a090d3-4b88-72e0-b217-535905da4cc7/智慧建築_IO_Dashboard";
const builderPath = path.join(projectDir, "build_dashboard.mjs");
let source = await fs.readFile(builderPath, "utf8");
const startMarker = "const html = String.raw`";
const endMarker = "`;\n\nawait fs.mkdir";
const start = source.indexOf(startMarker);
const end = source.lastIndexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error("Dashboard template markers not found");
let template = source.slice(start + startMarker.length, end);
template = template.replace("const systems=${dataJson};", "const systems=__DATA_JSON__;");
await fs.writeFile(path.join(projectDir, "template.html"), template, "utf8");
source = source.slice(0, start) +
  "const template = await fs.readFile(path.join(projectDir, \"template.html\"), \"utf8\");\n" +
  "const html = template.replace(\"__DATA_JSON__\", dataJson);\n\nawait fs.mkdir" +
  source.slice(end + endMarker.length);
await fs.writeFile(builderPath, source, "utf8");
console.log("Dashboard builder repaired");
