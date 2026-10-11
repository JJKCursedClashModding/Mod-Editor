// Headless test for the struct editors in renderer/app.js (run: node scripts/struct-widget.check.js).
// Loads the real renderer source in a vm sandbox with stubbed browser globals,
// then exercises renderWidget/readWidgetValue/structKeysFor round-trips.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "renderer", "app.js"), "utf8");
const hookSrc = src + "\n;globalThis.__testHook = { renderWidget, readWidgetValue, structKeysFor, isFlatStructVal, blankStructFor, jsonText, setEnums: (m) => { S._enumsMap = m; } };";

const sandbox = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  document: {
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return null; },
  },
  window: {},
};
vm.createContext(sandbox);
vm.runInContext(hookSrc, sandbox, { filename: "app.js" });
const H = sandbox.__testHook;
H.setEnums({
  EGameCharacterPairGroup: { members: [{ name: "None", value: 0 }, { name: "JujutsuSorcerers", value: 1 }] },
});

let pass = 0;
let fail = 0;
function ok(cond, name, extra) {
  if (cond) {
    pass++;
    console.log(`ok - ${name}`);
  } else {
    fail++;
    console.log(`FAIL - ${name}${extra !== undefined ? ` :: ${extra}` : ""}`);
  }
}

// Fake DOM elements for readWidgetValue: $$ uses root.querySelectorAll.
function inp(attrs) {
  return {
    dataset: { ...attrs },
    value: attrs.value !== undefined ? String(attrs.value) : "",
    checked: !!attrs.checked,
    closest: () => null, // visible
  };
}
function hiddenInp(attrs) {
  const el = inp(attrs);
  el.closest = () => ({}); // under [hidden]
  return el;
}
function card(...els) {
  return { querySelectorAll: () => els, querySelector: () => null };
}

const XYZ = [{ name: "X", kind: "number" }, { name: "Y", kind: "number" }, { name: "Z", kind: "number" }];

// 1. structKeysFor: schema + value extras
ok(JSON.stringify(H.structKeysFor({ kind: "struct", structFields: XYZ }, { X: 1, Y: 1, Z: 1 }))
  === JSON.stringify(XYZ), "structKeysFor schema passthrough");
ok(JSON.stringify(H.structKeysFor({ kind: "any" }, { A: 1, B: "x", C: true, D: null }))
  === JSON.stringify([{ name: "A", kind: "number" }, { name: "B", kind: "string" }, { name: "C", kind: "boolean" }, { name: "D", kind: "any" }]),
  "structKeysFor value inference");

// 2. renderWidget struct -> per-key inputs, not a textarea
const html = H.renderWidget("CullingBoundingBoxScale", { kind: "struct", structFields: XYZ }, { X: 1, Y: 2, Z: 3 });
ok(html.includes("struct-grid") && html.includes('struct-raw" hidden'), "struct renders grid + hidden raw textarea", html.slice(0, 200));
ok(html.includes('data-sf="X"') && html.includes('value="1"') && html.includes('type="number"'), "struct X input", html.slice(0, 300));
ok(html.includes("data-structraw") && html.includes("struct-raw"), "struct raw toggle present");

// 3. read round-trip single struct
const r1 = H.readWidgetValue(card(
  inp({ w: "struct-num", f: "S", sf: "X", value: "1.5" }),
  inp({ w: "struct-num", f: "S", sf: "Y", value: "2" }),
  inp({ w: "struct-num", f: "S", sf: "Z", value: "-3" }),
), "S");
ok(!r1.error && r1.value && r1.value.X === 1.5 && r1.value.Y === 2 && r1.value.Z === -3, "struct read numbers", JSON.stringify(r1));

// 4. invalid number -> error, empty -> error
const rBad = H.readWidgetValue(card(inp({ w: "struct-num", f: "S", sf: "X", value: "abc" })), "S");
ok(!!rBad.error && /not a number/.test(rBad.error), "struct bad number errors", JSON.stringify(rBad));
const rEmpty = H.readWidgetValue(card(inp({ w: "struct-num", f: "S", sf: "X", value: "" })), "S");
ok(!!rEmpty.error, "struct empty number errors", JSON.stringify(rEmpty));

// 5. color struct: color input + Hex normalization
const colorHtml = H.renderWidget("CursedEnergy_AuraColor",
  { kind: "struct", structFields: [{ name: "R", kind: "number" }, { name: "G", kind: "number" }, { name: "B", kind: "number" }, { name: "A", kind: "number" }, { name: "Hex", kind: "string" }] },
  { R: 0.1, G: 1, B: 1.5, A: 1, Hex: "59FFFF" });
ok(colorHtml.includes('type="color"') && colorHtml.includes("#59ffff"), "color swatch rendered", colorHtml.slice(0, 400));
const rColor = H.readWidgetValue(card(
  inp({ w: "struct-num", f: "C", sf: "R", value: "0.1" }),
  inp({ w: "struct-str", f: "C", sf: "Hex", value: "aabbcc" }),
  inp({ w: "struct-color", f: "C", sf: "Hex", value: "#aabbcc" }),
), "C");
ok(!rColor.error && rColor.value.Hex === "AABBCC" && rColor.value.R === 0.1, "Hex uppercased, color skipped", JSON.stringify(rColor));

// 6. struct[] render + read round-trip
const arrHtml = H.renderWidget("Location", { kind: "struct[]", structFields: XYZ },
  [{ X: 1, Y: 2, Z: 3 }, { X: 4, Y: 5, Z: 6 }]);
ok(arrHtml.includes("struct-list") && arrHtml.includes('data-idx="0"') && arrHtml.includes('data-idx="1"') && arrHtml.includes("data-sarrdel"), "struct[] rows rendered");
const rArr = H.readWidgetValue(card(
  inp({ w: "struct-num", f: "L", sf: "X", idx: "0", value: "1" }),
  inp({ w: "struct-num", f: "L", sf: "Y", idx: "0", value: "2" }),
  inp({ w: "struct-num", f: "L", sf: "X", idx: "1", value: "4" }),
  inp({ w: "struct-num", f: "L", sf: "Y", idx: "1", value: "5" }),
), "L");
ok(!rArr.error && Array.isArray(rArr.value) && rArr.value.length === 2 && rArr.value[1].X === 4, "struct[] read grouped by idx", JSON.stringify(rArr));

// 7. hidden raw/form alternates are ignored
const rHidden = H.readWidgetValue(card(
  hiddenInp({ w: "struct-num", f: "S", sf: "X", value: "9" }),
  inp({ w: "json", f: "S", value: '{"X":7}' }),
), "S");
ok(!rHidden.error && rHidden.value && rHidden.value.X === 7, "hidden grid ignored, raw json read", JSON.stringify(rHidden));

// 8. enum still a select; number[] still list; plain any{} gets struct form
const enumHtml = H.renderWidget("CharacterPairGroup", { kind: "enum", enumName: "EGameCharacterPairGroup" }, "EGameCharacterPairGroup::None");
ok(enumHtml.includes("<select") && enumHtml.includes("None"), "enum unaffected", enumHtml.slice(0, 160));
const numArrHtml = H.renderWidget("FootIKLimit", { kind: "number[]" }, [30, 0]);
ok(numArrHtml.includes("arr-list"), "number[] unaffected");
const anyHtml = H.renderWidget("Mystery", { kind: "any" }, { X: 1, Foo: "bar" });
ok(anyHtml.includes("struct-grid") && anyHtml.includes('data-sf="Foo"'), "any flat object gets struct form");
const anyStrHtml = H.renderWidget("Mystery", { kind: "any" }, "just a string");
ok(anyStrHtml.includes("<textarea") && !anyStrHtml.includes("struct-grid"), "any string stays JSON textarea (unchanged)");
const anyArrNum = H.renderWidget("Nums", { kind: "any[]" }, [1, 2]);
ok(anyArrNum.includes("<textarea"), "any[] of numbers stays JSON");

// 9. blank template + garbage passthrough
ok(JSON.stringify(H.blankStructFor(XYZ)) === JSON.stringify({ X: 0, Y: 0, Z: 0 }), "blank struct");
ok(JSON.stringify(H.blankStructFor([{ name: "Hex", kind: "string" }])) === JSON.stringify({ Hex: "FFFFFF" }), "blank hex");
const garbage = H.renderWidget("S", { kind: "struct", structFields: XYZ }, "oops");
ok(garbage.includes("<textarea"), "non-object struct value stays JSON", garbage.slice(0, 120));

// 10. raw JSON is actually hidden: [hidden] must beat the display rules,
// and the toggle-back auto-applies (data-structform commits).
for (const cssPath of ["frontend/src/app.css", "renderer/styles.css"]) {
  const css = fs.readFileSync(path.join(__dirname, "..", cssPath), "utf8");
  ok(css.includes(".struct-raw[hidden]") && css.includes(".struct-grid[hidden]"),
    `${cssPath} hides raw/grid when [hidden]`);
}
ok(html.includes('data-structform') && />form<\//.test(html), "struct raw view toggles back with auto-apply", html.slice(-300));
ok(arrHtml.includes('data-structform') && />form<\//.test(arrHtml), "struct[] raw view toggles back with auto-apply");

console.log(`\n${pass} passed, ${fail} failed`);

// ---- backend: schema member info + commit coercion ----
const engine = require("../lib/engine");
const schema = require("../lib/schema");
const enums = schema.parseEnumsTs();
const cull = schema.inferSchema("CharacterDataTable.json").fields.CullingBoundingBoxScale;
ok(cull.kind === "struct" && Array.isArray(cull.structFields) && cull.structFields.map((m) => m.name).join(",") === "X,Y,Z",
  "schema struct members", JSON.stringify(cull));
const loc = schema.inferSchema("MissionLayoutDataTable.json").fields.Location;
ok(loc.kind === "struct[]" && loc.structFields.length === 3, "schema struct[] members", JSON.stringify(loc));
const cc1 = engine.coerceValue({ X: 1, Y: 2, Z: 3 }, { kind: "struct" }, undefined, enums);
ok(!cc1.error && cc1.value.X === 1, "coerce struct object");
const cc2 = engine.coerceValue("nope", { kind: "struct" }, undefined, enums);
ok(!!cc2.error, "coerce struct rejects string");
const cc3 = engine.coerceValue([{ X: 1, Y: 2, Z: 3 }], { kind: "struct[]" }, undefined, enums);
ok(!cc3.error && Array.isArray(cc3.value), "coerce struct[] array");
const cc4 = engine.coerceValue({ X: 1 }, { kind: "struct[]" }, undefined, enums);
ok(!!cc4.error, "coerce struct[] rejects object", JSON.stringify(cc4));
const cc5 = engine.coerceValue([{ X: 1 }, "x"], { kind: "struct[]" }, undefined, enums);
ok(!!cc5.error, "coerce struct[] rejects mixed", JSON.stringify(cc5));

console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
