// Unit tests for lib/exportMod.js family/diff helpers (run: npm test).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const exportMod = require("../lib/exportMod");

describe("shareKeyOf", () => {
  it("groups numbered splits under one family key", () => {
    const keys = [
      "DamageDataTable1.json",
      "DamageDataTable2.json",
      "DamageDataTable5.json",
    ].map((f) => exportMod.shareKeyOf(f));
    assert.deepEqual(keys, ["DamageDataTable", "DamageDataTable", "DamageDataTable"]);
  });

  it("keeps locale splits separate", () => {
    assert.notEqual(
      exportMod.shareKeyOf("BattleTextDataTable_En.json"),
      exportMod.shareKeyOf("BattleTextDataTable_Ja.json"),
    );
    assert.equal(exportMod.shareKeyOf("BattleTextDataTable_En.json"), "BattleTextDataTable_En");
  });

  it("leaves unnumbered tables on their own key", () => {
    assert.equal(exportMod.shareKeyOf("ActionDataTable.json"), "ActionDataTable");
  });
});

describe("familyMembersOfKey", () => {
  it("fans a family key out to its member files", () => {
    const members = exportMod.familyMembersOfKey("DamageDataTable");
    assert.ok(members.includes("DamageDataTable1.json"));
    assert.ok(members.includes("DamageDataTable5.json"));
    assert.ok(!members.some((f) => !/^DamageDataTable\d+\.json$/.test(f)));
  });
});

describe("getFamilyRules", () => {
  it("unions family-entry and legacy per-file lists without duplicates", () => {
    const r1 = { id: "r1", then: [], else: [] };
    const r2 = { id: "r2", then: [], else: [] };
    const project = {
      tables: {
        DamageDataTable: { globalRules: [r1] },
        "DamageDataTable1.json": { globalRules: [r1, r2] },
        "DamageDataTable2.json": { globalRules: [] },
      },
    };
    const rules = exportMod.getFamilyRules(project, "DamageDataTable3.json");
    assert.deepEqual(rules.map((r) => r.id).sort(), ["r1", "r2"]);
  });
});

describe("diffToSparse", () => {
  it("maps changed entries to row -> fields of new values", () => {
    const sparse = exportMod.diffToSparse({
      R1: { type: "modified", fields: { HP: { from: 10, to: 20 }, Name: { from: "a", to: "a" } } },
      R2: { type: "added", fields: { ID: { from: undefined, to: "R2" } } },
    });
    assert.deepEqual(sparse, { R1: { HP: 20, Name: "a" }, R2: { ID: "R2" } });
  });
});

describe("enum wire format", () => {
  const schema = require("../lib/schema");
  const enums = schema.parseEnumsTs();

  it("serializes enum labels as integers, recursively, leaving keys alone", () => {
    const unresolved = new Set();
    const out = exportMod.enumsToWire(
      {
        DamageType: "EGameDamageType::Down",
        List: ["EGameDamageType::BlowSpin", "EGameDamageType::None"],
        Nested: { T: "EGameDamageType::Normal" },
        Keyed: { "EGameDamageType::Down": 1 },
        Plain: "Hello::World",
        Bogus: "EGameDamageType::NotAMember",
      },
      enums,
      unresolved,
    );
    assert.equal(out.DamageType, 3);
    assert.deepEqual(out.List, [7, 0]);
    assert.equal(out.Nested.T, 1);
    assert.deepEqual(Object.keys(out.Keyed), ["EGameDamageType::Down"]);
    assert.equal(out.Plain, "Hello::World");
    assert.equal(out.Bogus, "EGameDamageType::NotAMember");
    assert.deepEqual([...unresolved], ["EGameDamageType::NotAMember"]);
  });

  it("buildModTree writes integer enums (export + live sync share this path)", async () => {
    const project = {
      name: "t",
      manifest: {},
      tables: {
        "DamageDataTable1.json": {
          globalRules: [],
          overrides: { CP_010_ATTACKB_01_02: { DamageType: "EGameDamageType::Down", Down_Damage: 660 } },
          newRows: {},
        },
      },
      parameters: {},
    };
    const { files } = await exportMod.buildModTree(project, enums, { bake: false });
    const text = files.get("datatables/DamageDataTable1.json");
    assert.ok(!/EGame[A-Za-z]+::/.test(text), "no enum strings in output");
    const json = JSON.parse(text);
    assert.equal(json.CP_010_ATTACKB_01_02.DamageType, 3);
  });

  it("new rows ship every enum field as an integer", async () => {
    const project = {
      name: "t",
      manifest: {},
      tables: {
        "DamageDataTable1.json": {
          globalRules: [],
          overrides: {},
          newRows: { CP_010_TEST_NEW: { _base: "CP_010_ATTACKB_01_02", fields: { DamageType: "EGameDamageType::Down" } } },
        },
      },
      parameters: {},
    };
    const { files } = await exportMod.buildModTree(project, enums, { bake: false });
    const text = files.get("datatables/DamageDataTable1.json");
    assert.ok(!/EGame[A-Za-z]+::/.test(text), "no enum strings in new-row output");
    assert.equal(JSON.parse(text).CP_010_TEST_NEW.DamageType, 3);
  });

  it("import maps integer enums back to labels (no false overrides)", () => {
    const vanillaRow = schema.readInputTable("DamageDataTable1.json").rows.CP_010_ATTACKB_01_02;
    const vanillaNum = exportMod.enumsToWire(vanillaRow, enums);
    const same = exportMod.diffImportedSparse("DamageDataTable1.json", { CP_010_ATTACKB_01_02: vanillaNum }, enums);
    assert.deepEqual(same.overrides, {});
    const changed = exportMod.diffImportedSparse(
      "DamageDataTable1.json",
      { CP_010_ATTACKB_01_02: { DamageType: 3 } },
      enums,
    );
    assert.deepEqual(changed.overrides, { CP_010_ATTACKB_01_02: { DamageType: "EGameDamageType::Down" } });
  });
});
