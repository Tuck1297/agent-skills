// PowerPoint XML the generator can't write: slide transitions (including Morph), click
// animations for builds, and hidden slides. Applied to the .pptx after pptxgenjs writes it.

// The deck's transitions and the nearest PowerPoint transition. PowerPoint has nothing
// like the motion-graphic sweeps, so they get the closest built-in effect.
const BUILT_IN = {
  fade: '<p:fade/>',
  slide: '<p:push dir="l"/>',
  rise: '<p:cover dir="u"/>',
  zoom: '<p:zoom/>',
  wipe: '<p:wipe dir="l"/>',
  iris: "<p:circle/>",
  diagonal: '<p:strips dir="lu"/>',
  split: '<p:split orient="vert" dir="out"/>',
  blinds: '<p:blinds dir="vert"/>',
  cube: '<p:push dir="l"/>',
  panels: '<p:cover dir="l"/>',
  stripes: '<p:strips dir="ld"/>',
  shutter: '<p:blinds dir="horz"/>',
  circle: "<p:circle/>",
  tiles: '<p:checker dir="horz"/>',
  wave: '<p:wipe dir="u"/>',
};
const SLOW = new Set(["panels", "stripes", "shutter", "circle", "tiles", "wave", "cube", "morph"]);

export function transitionXml(kind) {
  if (!kind || kind === "none") return "";
  const spd = SLOW.has(kind) ? "slow" : "med";
  if (kind === "morph")
    return (
      '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
      '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">' +
      '<p:transition spd="slow"><p159:morph option="byObject"/></p:transition>' +
      "</mc:Choice><mc:Fallback>" +
      '<p:transition spd="slow"><p:fade/></p:transition>' +
      "</mc:Fallback></mc:AlternateContent>"
    );
  return `<p:transition spd="${spd}">${BUILT_IN[kind] || BUILT_IN.fade}</p:transition>`;
}

// clicks: [[{ spid, exit, text }...], ...] — one array of shapes per click, in order.
export function timingXml(clicks) {
  if (!clicks.length) return "";
  let id = 2;
  const next = () => ++id;
  const effect = ({ spid, exit, text }, first) => {
    const a = next();
    const b = next();
    const c = next();
    const vis = exit ? "hidden" : "visible";
    const set = `<p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${exit ? 499 : 0}"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${vis}"/></p:to></p:set>`;
    const fade = `<p:animEffect transition="${exit ? "out" : "in"}" filter="fade"><p:cBhvr><p:cTn id="${c}" dur="500"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`;
    return (
      `<p:par><p:cTn id="${a}" presetID="10" presetClass="${exit ? "exit" : "entr"}" presetSubtype="0" fill="hold"${text ? ` grpId="${exit ? 1 : 0}"` : ""} nodeType="${first ? "clickEffect" : "withEffect"}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${exit ? fade + set : set + fade}</p:childTnLst></p:cTn></p:par>`
    );
  };
  const steps = clicks
    .map((shapes) => {
      const outer = next();
      const inner = next();
      return (
        `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
        `<p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
        shapes.map((s, i) => effect(s, i === 0)).join("") +
        "</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>"
      );
    })
    .join("");
  const builds = [];
  for (const shapes of clicks)
    for (const s of shapes)
      if (s.text) builds.push(`<p:bldP spid="${s.spid}" grpId="${s.exit ? 1 : 0}" animBg="1"/>`);
  return (
    '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
    '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
    steps +
    "</p:childTnLst></p:cTn>" +
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
    "</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>" +
    (builds.length ? `<p:bldLst>${[...new Set(builds)].join("")}</p:bldLst>` : "") +
    "</p:timing>"
  );
}

// Shape ids by name, from a slide's XML.
export function shapeIds(xml) {
  const ids = new Map();
  for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)) ids.set(m[2], Number(m[1]));
  return ids;
}

// Put transition and timing where PowerPoint expects them: after <p:clrMapOvr>.
export function patchSlide(xml, { transition = "", timing = "", hidden = false }) {
  let out = xml;
  out = out.replace(/<p:transition[\s\S]*?<\/p:transition>|<p:transition[^>]*\/>/g, "");
  out = out.replace(/<p:timing>[\s\S]*?<\/p:timing>/g, "");
  const extra = transition + timing;
  if (extra) {
    if (/<\/p:clrMapOvr>/.test(out)) out = out.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + extra);
    else out = out.replace("</p:cSld>", "</p:cSld>" + extra);
  }
  if (hidden && !/<p:sld [^>]*show="0"/.test(out)) out = out.replace(/<p:sld /, '<p:sld show="0" ');
  return out;
}
