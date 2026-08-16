import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

const seedCatalog = [
  {
    id: "seed-1",
    title: "Ashen Ronin",
    author: "K. Hidaka",
    price: 349,
    stock: 12,
    cover: "",
    description: "A disgraced swordsman wanders a fractured empire seeking the one duel that will restore his name.",
    tag: "NEW",
  },
  {
    id: "seed-2",
    title: "Static Bloom",
    author: "R. Amano",
    price: 299,
    stock: 5,
    cover: "",
    description: "In a city where emotions bloom as visible flowers, one girl grows a color no one has a name for.",
    tag: "",
  },
  {
    id: "seed-3",
    title: "Iron Tide Crew",
    author: "S. Mizushima",
    price: 399,
    stock: 0,
    cover: "",
    description: "Salvage pirates race a sunken navy to reach a warship that shouldn't exist.",
    tag: "SOLD OUT",
  },
];

function ensureFile(file, fallback) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}

ensureFile(CATALOG_FILE, seedCatalog);
ensureFile(ORDERS_FILE, []);

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export const db = {
  getCatalog: () => readJSON(CATALOG_FILE),
  saveCatalog: (catalog) => writeJSON(CATALOG_FILE, catalog),
  getOrders: () => readJSON(ORDERS_FILE),
  saveOrders: (orders) => writeJSON(ORDERS_FILE, orders),
};
