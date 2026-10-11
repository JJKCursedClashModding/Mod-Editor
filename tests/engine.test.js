// Unit tests for lib/engine.js (run: npm test).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../lib/engine");

const enums = {
  order: ["EGameFoo"],
  map: {
    EGameFoo: {
      valueByMember: { None: 0, Alpha: 1, Beta: 2 },
      memberByValue: { 0: "None", 1: "Alpha", 2: "Beta" },
      members: [
        { name: "None", value: 0 },
        { name: "Alpha", value: 1 },
        { name: "Beta", value: 2 },
      ],
    },
  },
};

describe("normalizeRule", () => {
  it("migrates legacy single-action rules to block shape", () => {
    const n = engine.normalizeRule({ id: "r1", field: "HP", op: "set", value: 5, cond: null });
    assert.deepEqual(n.then, [{ field: "HP", op: "set", value: 5 }]);
    assert.deepEqual(n.else, []);
  });

  it("passes block-shaped rules through, dropping non-object actions", () => {
    const n = engine.normalizeRule({ id: "r1", cond: null, then: [{ field: "A", op: "set", value: 1 }, null], else: "nope" });
    assert.deepEqual(n.then, [{ field: "A", op: "set", value: 1 }]);
    assert.deepEqual(n.else, []);
  });

  it("never crashes on garbage input", () => {
    for (const bad of [null, undefined, 42, "x", []]) {
      const n = engine.normalizeRule(bad);
      assert.deepEqual(n.then, []);
      assert.deepEqual(n.else, []);
    }
  });
});

describe("isLiveRule", () => {
  it("rejects blank drafts, disabled rules, and action-less rules", () => {
    assert.equal(engine.isLiveRule({ id: "a", then: [{ field: "", op: "set", value: null }], else: [] }), false);
    assert.equal(engine.isLiveRule({ id: "a", disabled: true, then: [{ field: "HP", op: "set", value: 1 }], else: [] }), false);
    assert.equal(engine.isLiveRule({ id: "a", then: [], else: [] }), false);
    assert.equal(engine.isLiveRule(null), false);
  });

  it("accepts rules with a field-bearing action in either branch", () => {
    assert.equal(engine.isLiveRule({ id: "a", then: [{ field: "HP", op: "set", value: 1 }], else: [] }), true);
    assert.equal(engine.isLiveRule({ id: "a", then: [], else: [{ field: "HP", op: "add", value: 1 }] }), true);
    // Legacy single-action shape counts too.
    assert.equal(engine.isLiveRule({ id: "a", field: "HP", op: "set", value: 1 }), true);
  });
});

describe("testCondition", () => {
  it("compares equality and numeric operators", () => {
    assert.equal(engine.testCondition(2, "==", 2, enums), true);
    assert.equal(engine.testCondition(2, "!=", 3, enums), true);
    assert.equal(engine.testCondition(3, ">", 2, enums), true);
    assert.equal(engine.testCondition(2, ">=", 2, enums), true);
    assert.equal(engine.testCondition(1, "<", 2, enums), true);
    assert.equal(engine.testCondition(2, "<=", 2, enums), true);
    assert.equal(engine.testCondition(2, ">", 3, enums), false);
  });

  it("rejects numeric comparison for non-numbers", () => {
    assert.equal(engine.testCondition("x", ">", 1, enums), false);
    assert.equal(engine.testCondition(1, "<", "x", enums), false);
    assert.equal(engine.testCondition(null, ">=", 0, enums), false);
  });

  it("handles contains for strings and arrays", () => {
    assert.equal(engine.testCondition("CP_010_foo", "contains", "CP_010", enums), true);
    assert.equal(engine.testCondition(["a", "b"], "contains", "b", enums), true);
    assert.equal(engine.testCondition(["a", "b"], "!contains", "z", enums), true);
    assert.equal(engine.testCondition("abc", "!contains", "z", enums), true);
    assert.equal(engine.testCondition("abc", "contains", "z", enums), false);
  });

  it("compares enum strings by numeric value", () => {
    assert.equal(engine.testCondition("EGameFoo::Alpha", "==", "EGameFoo::Alpha", enums), true);
    assert.equal(engine.testCondition("EGameFoo::Alpha", "==", 1, enums), true);
    assert.equal(engine.testCondition("EGameFoo::Alpha", "!=", "EGameFoo::Beta", enums), true);
  });
});

describe("applyRulesToRow", () => {
  it("applies set and math ops, tracking fired rules", () => {
    const row = { HP: 10 };
    const { fired } = engine.applyRulesToRow(
      row,
      [{ id: "r1", name: "", cond: null, then: [{ field: "HP", op: "add", value: 5 }], else: [] }],
      null,
      enums,
    );
    assert.equal(row.HP, 15);
    assert.deepEqual(fired, { HP: ["r1"] });
  });

  it("throws on division by zero with the rule name", () => {
    assert.throws(
      () => engine.applyRulesToRow(
        { HP: 10 },
        [{ id: "r9", name: "bad", cond: null, then: [{ field: "HP", op: "div", value: 0 }], else: [] }],
        null,
        enums,
      ),
      /bad.*Division by zero|Division by zero/,
    );
  });

  it("maps values with pairs and default", () => {
    const row = { K: "a" };
    engine.applyRulesToRow(
      row,
      [{ id: "m", cond: null, then: [{ field: "K", op: "map", value: { pairs: [{ from: "a", to: "b" }], default: "z" } }], else: [] }],
      null,
      enums,
    );
    assert.equal(row.K, "b");
    const row2 = { K: "q" };
    engine.applyRulesToRow(
      row2,
      [{ id: "m", cond: null, then: [{ field: "K", op: "map", value: { pairs: [{ from: "a", to: "b" }], default: "z" } }], else: [] }],
      null,
      enums,
    );
    assert.equal(row2.K, "z");
  });
});

describe("matchRepr", () => {
  const enumField = { kind: "enum", enumName: "EGameFoo" };
  it("normalizes bare members and numbers to Type::Member", () => {
    assert.equal(engine.matchRepr("Alpha", null, enumField, enums), "EGameFoo::Alpha");
    assert.equal(engine.matchRepr(1, null, enumField, enums), "EGameFoo::Alpha");
    assert.equal(engine.matchRepr("EGameFoo::Beta", null, enumField, enums), "EGameFoo::Beta");
  });

  it("preserves unknown numerics instead of losing data", () => {
    assert.equal(engine.matchRepr(99, null, enumField, enums), 99);
  });

  it("maps enum arrays element-wise", () => {
    assert.deepEqual(engine.matchRepr(["Alpha", 2], null, { kind: "enum[]", enumName: "EGameFoo" }, enums),
      ["EGameFoo::Alpha", "EGameFoo::Beta"]);
  });
});

describe("coerceValue", () => {
  it("coerces numbers and booleans", () => {
    assert.deepEqual(engine.coerceValue("42", { kind: "number" }, undefined, enums), { value: 42 });
    assert.ok(engine.coerceValue("xx", { kind: "number" }, undefined, enums).error);
    assert.deepEqual(engine.coerceValue("true", { kind: "boolean" }, undefined, enums), { value: true });
    assert.ok(engine.coerceValue("maybe", { kind: "boolean" }, undefined, enums).error);
  });

  it("validates enum members, warning on unknown numerics", () => {
    assert.deepEqual(
      engine.coerceValue("Alpha", { kind: "enum", enumName: "EGameFoo" }, undefined, enums),
      { value: "EGameFoo::Alpha" },
    );
    assert.ok(engine.coerceValue("Gamma", { kind: "enum", enumName: "EGameFoo" }, undefined, enums).error);
    const w = engine.coerceValue(99, { kind: "enum", enumName: "EGameFoo" }, undefined, enums);
    assert.equal(w.value, 99);
    assert.ok(w.warning);
  });

  it("validates enum arrays element-wise", () => {
    const r = engine.coerceValue(["Alpha", "EGameFoo::Beta"], { kind: "enum[]", enumName: "EGameFoo" }, undefined, enums);
    assert.deepEqual(r, { value: ["EGameFoo::Alpha", "EGameFoo::Beta"] });
    assert.ok(engine.coerceValue(["Nope"], { kind: "enum[]", enumName: "EGameFoo" }, undefined, enums).error);
    assert.ok(engine.coerceValue("not-an-array", { kind: "enum[]" }, undefined, enums).error);
  });
});
