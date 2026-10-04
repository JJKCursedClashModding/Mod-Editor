// Replace-capable Blueprint parameter patching (upsert).
//
// The stock CookedDatatablePatcher only ADDS new IDs (assertNewKey throws on
// existing keys). This module mirrors its package layout / CDO splice logic
// exactly, but applies full-row REPLACEMENTS for existing IDs plus additions
// for new ones — the parameter equivalent of the datatable field merge.
//
// All binary primitives (codec, name maps, summaries, serializer) are reused
// from the vendored patcher build via deep imports; only the map-mutation
// policy differs.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function shortEntryName(key) {
  const i = String(key).indexOf("::");
  return i >= 0 ? String(key).slice(i + 2) : String(key);
}

function readExportPrefix(uasset, exportOffset, stride, index) {
  const o = exportOffset + index * stride;
  return {
    nameIndex: uasset.readInt32LE(o + 16),
    serialSize: Number(uasset.readBigInt64LE(o + 28)),
    serialOffset: Number(uasset.readBigInt64LE(o + 36)),
  };
}

function loadBpPackage(patcher, inputDir, assetName) {
  const uasset = fs.readFileSync(path.join(inputDir, `${assetName}.uasset`));
  const uexp = fs.readFileSync(path.join(inputDir, `${assetName}.uexp`));
  const { summary } = patcher.summary.readPackageSummaryWithOffsets(uasset);
  const names = patcher.maps.readNameMap(uasset, summary.nameOffset, summary.nameCount);
  const imports = patcher.maps.readImportMap(uasset, summary.importOffset, summary.importCount);
  const span = summary.dependsOffset - summary.exportOffset;
  if (summary.exportCount <= 0 || span <= 0 || span % summary.exportCount !== 0) {
    throw new Error(`${assetName}: cannot derive export stride`);
  }
  const stride = span / summary.exportCount;
  if (stride < 76 || stride > 256) throw new Error(`${assetName}: implausible export stride ${stride}`);
  let cdoIndex = -1;
  for (let i = 0; i < summary.exportCount; i++) {
    const { nameIndex } = readExportPrefix(uasset, summary.exportOffset, stride, i);
    const nm = names[nameIndex] ?? "";
    if (nm.startsWith("Default__")) cdoIndex = i;
  }
  if (cdoIndex < 0) throw new Error(`${assetName}: no Default__ CDO export found`);
  return {
    uasset: Buffer.from(uasset),
    uexp: Buffer.from(uexp),
    names,
    imports,
    exportOffset: summary.exportOffset,
    dependsOffset: summary.dependsOffset,
    exportCount: summary.exportCount,
    exportStride: stride,
    cdoIndex,
    totalHeaderSize: summary.totalHeaderSize,
  };
}

function assertNoUnknownFields(registry, NATIVE_STRUCTS, schema, value, pathLabel, assetName) {
  const byName = new Map(schema.properties.map((p) => [p.name, p]));
  for (const [key, sub] of Object.entries(value)) {
    if (key.startsWith("$")) continue;
    const prop = byName.get(key);
    if (!prop) {
      throw new Error(
        `${pathLabel}: unknown field "${key}" for ${schema.name} in ${assetName}; ` +
          `valid fields: ${schema.properties.map((p) => p.name).join(", ")}`,
      );
    }
    const isNative = prop.type === "StructProperty" && !!prop.structName && NATIVE_STRUCTS.has(prop.structName);
    if (prop.type === "StructProperty" && prop.structName && isObject(sub) && !isNative) {
      const nested = registry.getFlattenedSchema(prop.structName);
      if (nested) assertNoUnknownFields(registry, NATIVE_STRUCTS, nested, sub, `${pathLabel}.${key}`, assetName);
    } else if ((prop.type === "ArrayProperty" || prop.type === "SetProperty") && Array.isArray(sub)) {
      const inner = prop.innerType;
      if (inner && inner.type === "StructProperty" && inner.structName) {
        const nested = registry.getFlattenedSchema(inner.structName);
        if (nested) {
          for (const el of sub) {
            if (isObject(el)) assertNoUnknownFields(registry, NATIVE_STRUCTS, nested, el, `${pathLabel}.${key}[]`, assetName);
          }
        }
      }
    } else if (prop.type === "MapProperty" && isObject(sub)) {
      const valueType = prop.valueType;
      if (valueType && valueType.type === "StructProperty" && valueType.structName) {
        const nested = registry.getFlattenedSchema(valueType.structName);
        if (nested) {
          for (const [k, v] of Object.entries(sub)) {
            if (isObject(v)) assertNoUnknownFields(registry, NATIVE_STRUCTS, nested, v, `${pathLabel}.${key}.${k}`, assetName);
          }
        }
      }
    }
  }
}

function resolveCaptureImport(pkg, target, label, assetName) {
  const assetBase = target.includes("/")
    ? (target.split("/").pop() ?? target)
    : target.startsWith("GameWidgetCharacterSceneCapture_")
      ? target
      : `GameWidgetCharacterSceneCapture_${target}_BP`;
  for (let i = 0; i < pkg.imports.length; i++) {
    const imp = pkg.imports[i];
    if (pkg.resolveName(pkg.names, imp.objectNameIndex) === assetBase) return -(i + 1);
  }
  throw new Error(`${label}: capture asset "${target}" is not imported by ${assetName} (looked for "${assetBase}")`);
}

function getEntryRows(entry, assetName) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${assetName}: ImageOffsetParameterMap entry is not a struct`);
  }
  const arr = entry.Array;
  if (!Array.isArray(arr)) throw new Error(`${assetName}: ImageOffsetParameterMap entry has no Array`);
  return arr;
}

function rowId(row) {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const id = row.ID;
    if (typeof id === "string") return id;
  }
  return null;
}

/**
 * Upsert rows into one parameter asset.
 *
 * @param {object} patcher  Loaded patcher primitives (see paramVanilla.loadPatcher).
 * @param {object} asset    BpParameterAsset-ish {shortName, assetName, className, mapProp, valueKind}.
 * @param {Record<string, unknown>} newRows       ID -> literal value (must not exist).
 * @param {Record<string, unknown>} replacedRows  ID -> literal value (must exist).
 */
async function patchBpUpsert(patcher, asset, newRows, replacedRows, inputDir, outputDir) {
  const registry = patcher.registry;
  const NATIVE_STRUCTS = patcher.codec.NATIVE_STRUCTS;
  const schema = registry.getFlattenedSchema(asset.className);
  if (!schema) throw new Error(`${asset.assetName}: missing usmap schema ${asset.className}`);
  const mapSchemaProp = schema.properties.find((p) => p.name === asset.mapProp);
  if (!mapSchemaProp) throw new Error(`${asset.assetName}: schema ${asset.className} has no ${asset.mapProp}`);

  const pkg = loadBpPackage(patcher, inputDir, asset.assetName);
  const cdoPrefix = readExportPrefix(pkg.uasset, pkg.exportOffset, pkg.exportStride, pkg.cdoIndex);
  const blobOff = cdoPrefix.serialOffset - pkg.totalHeaderSize;
  const blob = Buffer.from(pkg.uexp.subarray(blobOff, blobOff + cdoPrefix.serialSize));
  if (blob.length !== cdoPrefix.serialSize) throw new Error(`${asset.assetName}: CDO blob truncated`);

  const zeroStates = new WeakMap();
  const ctx = { names: pkg.names, registry, zeroStates };
  const reader = new patcher.binary.BinaryReader(blob);
  const cdo = patcher.codec.readStruct(reader, schema, ctx);
  const cdoTail = Buffer.from(blob.subarray(reader.offset));
  const map = cdo[asset.mapProp];
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    throw new Error(`${asset.assetName}: CDO property ${asset.mapProp} is not a map`);
  }

  let added = 0;
  let replaced = 0;
  let skipped = 0;
  const requiredNames = new Set();
  const shortName = asset.shortName;

  const exists = (id) => Object.prototype.hasOwnProperty.call(map, id);

  if (asset.valueKind === "rows") {
    // ExchangeImage write shape per costume: { Offset: {X,Y}, entries?: {...} }.
    const rowSchema = (() => {
      const entryStruct = mapSchemaProp.valueType && mapSchemaProp.valueType.structName
        ? registry.getFlattenedSchema(mapSchemaProp.valueType.structName)
        : undefined;
      const arrayProp = entryStruct && entryStruct.properties.find((p) => p.name === "Array");
      const rowName = arrayProp && arrayProp.innerType && arrayProp.innerType.structName;
      const rs = rowName ? registry.getFlattenedSchema(rowName) : undefined;
      if (!rs) throw new Error(`${asset.assetName}: cannot resolve exchangeImage row schema`);
      return rs;
    })();
    const baseByShort = new Map();
    for (const k of Object.keys(map)) baseByShort.set(shortEntryName(k), k);

    const applyOne = (id, rawValue, isReplace, label) => {
      if (!isObject(rawValue)) throw new Error(`${label}: expected { "Offset": {X,Y}, "entries"?: {...} }`);
      const offset = rawValue.Offset;
      if (!isObject(offset)) throw new Error(`${label}: missing "Offset": {X,Y}`);
      assertNoUnknownFields(registry, NATIVE_STRUCTS, rowSchema, { ID: id, Offset: offset }, label, asset.assetName);
      let targets;
      if (rawValue.entries === undefined) {
        targets = Object.keys(map).map((entryKey) => ({ entryKey, offset }));
      } else {
        if (!isObject(rawValue.entries)) throw new Error(`${label}: "entries" must be a map of entry name -> {X,Y}`);
        targets = [];
        for (const [entryName, entryOffset] of Object.entries(rawValue.entries)) {
          const full = baseByShort.get(shortEntryName(entryName));
          if (!full) {
            throw new Error(`${label}: unknown image entry "${entryName}"; valid: ${[...baseByShort.keys()].join(", ")}`);
          }
          if (!isObject(entryOffset)) throw new Error(`${label}: entry "${entryName}" must be {X,Y}`);
          targets.push({ entryKey: full, offset: entryOffset });
        }
        if (targets.length === 0) {
          skipped++;
          return;
        }
      }
      requiredNames.add(id);
      for (const { entryKey, offset: entryOffset } of targets) {
        const rows = getEntryRows(map[entryKey], asset.assetName);
        const idx = rows.findIndex((r) => rowId(r) === id);
        const rowVal = { ID: id, Offset: { ...entryOffset } };
        if (idx >= 0) {
          rows[idx] = rowVal;
          replaced++;
        } else {
          rows.push(rowVal);
          added++;
        }
      }
    };
    for (const [id, v] of Object.entries(replacedRows)) {
      if (!costumeExistsAnywhere(map, asset.assetName, id)) {
        throw new Error(`${shortName}.json: cannot replace "${id}" — no such costume row in base ${asset.assetName}; use a new ID`);
      }
      applyOne(id, v, true, `${shortName}.json "${id}"`);
    }
    for (const [id, v] of Object.entries(newRows)) {
      if (costumeExistsAnywhere(map, asset.assetName, id)) {
        throw new Error(`${shortName}.json: key "${id}" already exists in base ${asset.assetName}; new costumes must use new IDs`);
      }
      applyOne(id, v, false, `${shortName}.json "${id}"`);
    }
  } else if (asset.valueKind === "ref") {
    const applyOne = (id, rawValue, isReplace, label) => {
      if (typeof rawValue !== "string" || rawValue.length === 0) {
        throw new Error(`${label}: expected a capture asset reference string`);
      }
      map[id] = resolveCaptureImport({ imports: pkg.imports, names: pkg.names, resolveName: patcher.maps.resolveName }, rawValue, label, asset.assetName);
      requiredNames.add(id);
      if (isReplace) replaced++;
      else added++;
    };
    for (const [id, v] of Object.entries(replacedRows)) {
      if (!exists(id)) throw new Error(`${shortName}.json: cannot replace "${id}" — not in base ${asset.assetName}`);
      applyOne(id, v, true, `${shortName}.json "${id}"`);
    }
    for (const [id, v] of Object.entries(newRows)) {
      if (exists(id)) throw new Error(`${shortName}.json: key "${id}" already exists in base ${asset.assetName}; new characters must use new IDs`);
      applyOne(id, v, false, `${shortName}.json "${id}"`);
    }
  } else {
    // Plain literal structs: full-row replace / add.
    const valueSchemaName = mapSchemaProp.valueType && mapSchemaProp.valueType.structName;
    const valueSchema = valueSchemaName ? registry.getFlattenedSchema(valueSchemaName) : undefined;
    if (!valueSchema) throw new Error(`${asset.assetName}: cannot resolve value schema for ${asset.mapProp}`);
    const applyOne = (id, rawValue, isReplace, label) => {
      if (!isObject(rawValue)) throw new Error(`${label}: expected a ${valueSchema.name} object`);
      assertNoUnknownFields(registry, NATIVE_STRUCTS, valueSchema, rawValue, label, asset.assetName);
      map[id] = { ...rawValue };
      requiredNames.add(id);
      for (const n of patcher.serializer.collectRequiredFNameStrings(valueSchema, rawValue, pkg.names, registry)) {
        requiredNames.add(n);
      }
      if (isReplace) replaced++;
      else added++;
    };
    for (const [id, v] of Object.entries(replacedRows)) {
      if (!exists(id)) throw new Error(`${shortName}.json: cannot replace "${id}" — not in base ${asset.assetName}`);
      applyOne(id, v, true, `${shortName}.json "${id}"`);
    }
    for (const [id, v] of Object.entries(newRows)) {
      if (exists(id)) throw new Error(`${shortName}.json: key "${id}" already exists in base ${asset.assetName}; new characters must use new IDs`);
      applyOne(id, v, false, `${shortName}.json "${id}"`);
    }
  }

  // Extend the name map (same as stock patcher).
  let uasset = pkg.uasset;
  let names = pkg.names;
  {
    const missing = [...requiredNames].filter((n) => !names.includes(n));
    if (missing.length > 0) {
      const { summary, offsets } = patcher.summary.readPackageSummaryWithOffsets(uasset);
      const extended = patcher.nameMap.extendPackageNameMap(uasset, summary, offsets, missing, pkg.exportStride);
      uasset = Buffer.from(extended.uasset);
      names = extended.names;
    }
  }

  const ctx2 = { names, registry, zeroStates };
  const writer = new patcher.binary.BinaryWriter();
  patcher.codec.writeStruct(writer, schema, cdo, ctx2);
  const newExport = Buffer.concat([writer.toBuffer(), cdoTail]);

  const { summary: summary2 } = patcher.summary.readPackageSummaryWithOffsets(uasset);
  const stride2 = (summary2.dependsOffset - summary2.exportOffset) / summary2.exportCount;
  const entryOff2 = summary2.exportOffset + pkg.cdoIndex * stride2;
  const newOff = Number(uasset.readBigInt64LE(entryOff2 + 36));

  const oldSize = cdoPrefix.serialSize;
  const oldOff = cdoPrefix.serialOffset;

  const outUexp = (() => {
    const offInUexp = oldOff - pkg.totalHeaderSize;
    const tail = pkg.uexp.subarray(offInUexp + oldSize);
    if (newExport.length <= oldSize) {
      const out = Buffer.from(pkg.uexp);
      newExport.copy(out, offInUexp);
      if (newExport.length < oldSize) out.fill(0, offInUexp + newExport.length, offInUexp + oldSize);
      return out;
    }
    return Buffer.concat([pkg.uexp.subarray(0, offInUexp), newExport, tail]);
  })();

  const outUasset = Buffer.from(uasset);
  outUasset.writeBigInt64LE(BigInt(newExport.length), entryOff2 + 28);
  outUasset.writeBigInt64LE(BigInt(newOff), entryOff2 + 36);

  await fsp.mkdir(outputDir, { recursive: true });
  const outputUasset = path.join(outputDir, `${asset.assetName}.uasset`);
  const outputUexp = path.join(outputDir, `${asset.assetName}.uexp`);
  await fsp.writeFile(outputUasset, outUasset);
  await fsp.writeFile(outputUexp, outUexp);

  return {
    shortName,
    asset: asset.assetName,
    added,
    replaced,
    skipped,
    oldExportSize: oldSize,
    newExportSize: newExport.length,
    outputUasset,
    outputUexp,
  };
}

function costumeExistsAnywhere(map, assetName, id) {
  for (const entryKey of Object.keys(map)) {
    const rows = getEntryRows(map[entryKey], assetName);
    if (rows.some((r) => rowId(r) === id)) return true;
  }
  return false;
}

module.exports = { patchBpUpsert };
