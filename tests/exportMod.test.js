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
