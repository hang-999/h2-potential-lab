// Exercise application state/phase behavior without a browser or renderer.
// The DOM is deliberately minimal: numerical assertions use the real operators.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const MLIP = require('./operators.js');
const copy = x => JSON.parse(JSON.stringify(x));

class Element {
  constructor(id) {
    this.id = id;
    this.textContent = id === 'embedded-assets' ? '{"h2":""}' : '';
    this.innerHTML = '';
    this.value = '0';
    this.checked = true;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.classList = {add() {}, remove() {}, toggle() {}, contains() {return false;}};
  }
  setAttribute() {}
  removeAttribute() {}
  querySelectorAll() {return [];}
  querySelector(selector) {return new Element(this.id + ' ' + selector);}
  addEventListener() {}
  focus() {}
  click() {}
  showModal() {}
  close() {}
}
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, new Element(id));
  return elements.get(id);
};
const requests = [];
const context = vm.createContext({
  MLIP,
  MLIPShare:require('./sharing.js'),
  MLIPTrainingData:require('./training-data.js'),
  H2Config:{validate:x=>x},
  console,
  document: {
    getElementById: element,
    querySelectorAll() {return [];},
    querySelector() {return new Element('query');},
    body: new Element('body')
  },
  window: {addEventListener() {}, scrollTo() {}},
  location: {hash: '#/symmetry'},
  matchMedia: () => ({matches: false}),
  Blob: class {},
  URL: {createObjectURL() {return 'blob:unit-test';}, revokeObjectURL() {}},
  Worker: class {postMessage(message) {requests.push(copy(message));} terminate() {}},
  requestAnimationFrame() {return 1;},
  cancelAnimationFrame() {},
  setTimeout() {return 1;},
  clearTimeout() {},
  createScene() {throw new Error('A numerical UI contract test must not create a renderer.');}
});
const content = fs.readFileSync(path.join(__dirname, 'lessons.js'), 'utf8').replace(/^export /gm, '');
let application = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8').replace(/^import .*;\r?\n/gm, '');
assert.match(application, /makeMap\(\);bind\(\);navigate\(\);requestCompute\(true\);/, 'Keep the test bootstrap marker aligned with the application entrypoint.');
application = application.replace('makeMap();bind();navigate();requestCompute(true);', '');
vm.runInContext(content + '\n' + application + `
globalThis.audit = {
  load(input, result, round = 1) {
    state = clone(input); snapshot = clone(result); reference = null;
    route = state.chapter; roundView = round; position = state.stage;
    referencePinned = false; featureIndex = 0; featurePage = 0;
  },
  getFeatures, renderStage, renderChecks, renderScenes, setPosition, requestCompute, stageShared, receiveShared,
  pending:()=>clone(pendingShare), restoreSourcesFocus,
  read: () => ({state: clone(state), snapshot: clone(snapshot), playing, position})
};`, context, {filename: 'app-ui-contract.js'});
const ui = context.audit;

const base = {
  chapter: 'symmetry', atoms: copy(MLIP.presets.water), center: 0, selected: 1,
  params: copy(MLIP.defaults), transform: {axis: 'z', angle: 60, reflection: false},
  stage: 0, version: 10,
  referenceAtoms: copy(MLIP.presets.tetrahedron), referenceCenter: 0
};
const initial = MLIP.compute(base);

// Replay and phase seeking must not issue computation/optimizer requests or
// modify the input geometry, coefficients, or frozen numerical result.
for (const chapter of ['symmetry', 'acsf', 'soap', 'moments', 'messages', 'vectors', 'harmonics', 'mace']) {
  const input = {...copy(base), chapter};
  ui.load(input, initial);
  const before = ui.read(), sent = requests.length;
  for (const phase of [0, 1, 2, 3, 1, 0, 3]) ui.setPosition(phase);
  const after = ui.read();
  assert.equal(JSON.stringify(after.state.atoms), JSON.stringify(before.state.atoms), chapter + ': seeking changed atoms');
  assert.equal(JSON.stringify(after.state.params), JSON.stringify(before.state.params), chapter + ': seeking changed coefficients');
  assert.equal(JSON.stringify(after.snapshot), JSON.stringify(before.snapshot), chapter + ': seeking mutated a computed snapshot');
  assert.equal(requests.length, sent, chapter + ': seeking unexpectedly requested new computation');
  assert.equal(after.playing, false, chapter + ': manual seeking did not pause playback');
}

// Simulate a new imported eight-atom configuration while its Worker result is
// still pending. The old three-atom snapshot may not be indexed by new indices.
const larger = copy(base);
larger.atoms = copy(MLIP.presets.environment);
larger.atoms.push({id: 5, element: 'H', pos: [2, 2, 0]}, {id: 6, element: 'O', pos: [-2, 0, 2]}, {id: 7, element: 'C', pos: [0, -2, 2]});
larger.selected = 7;
larger.version = initial.version + 1;
for (const chapter of ['symmetry', 'messages', 'vectors']) {
  ui.load({...larger, chapter, stage: 1}, initial);
  assert.doesNotThrow(() => ui.renderStage(), chapter + ': stale result was indexed by a new atom selection');
  assert.doesNotThrow(() => ui.getFeatures(), chapter + ': stale feature data mixed with new input');
  assert.equal(ui.read().snapshot.version, initial.version, 'rendering overwrote the last result');
}

// In an unchanged state the numerical display must come from the current input.
ui.load(base, initial);
const distanceRows = ui.getFeatures();
assert.equal(distanceRows.length, initial.geometry.neighbors.length);
distanceRows.forEach((row, i) => assert.equal(row.value, initial.geometry.neighbors[i].r));

// A message, its unnormalized aggregation, and the updated node are different
// quantities. Assert the phase display against the engine's frozen trace.
const messageState = {...copy(base), chapter: 'messages', selected: 0};
const targetRound = 2;
const layer = initial.messages.layers[targetRound];
const incoming = layer.edges.filter(edge => edge.to === messageState.selected);
ui.load({...messageState, stage: 1}, initial, targetRound);
ui.getFeatures().forEach((row, channel) => assert.equal(row.value, incoming[0].message[channel], 'edge phase must show its actual message'));
ui.load({...messageState, stage: 2}, initial, targetRound);
ui.getFeatures().forEach((row, channel) => {
  const sum = incoming.reduce((value, edge) => value + edge.message[channel], 0);
  assert.equal(row.value, sum, 'aggregation phase must show the sum before node update');
});
ui.load({...messageState, stage: 3}, initial, targetRound);
ui.getFeatures().forEach((row, channel) => assert.equal(row.value, layer.nodes[messageState.selected].s[channel], 'update phase must show the selected round, not a different round'));

console.log('UI contracts passed: read-only replay, stale-result guards, current geometry, and edge/aggregation/update phases.');

// Config schema version must never reset the worker request generation.
ui.load({...base, version: 1}, initial);ui.requestCompute(true);
const generation = requests.at(-1).state.version;
ui.load({...base, version: 1}, initial);ui.requestCompute(true);
assert(requests.at(-1).state.version > generation, 'imported config reuses an old worker generation');

// A shared URL is a pending draft. Validation precedes pause/state changes.
const share={schema:'mlip-experiment',version:1,chapter:'acsf',mode:'principle',config:{...copy(base),schema:'mlip-methods-config',version:1,chapter:'acsf'}};
ui.load(base,initial);const beforeShare=ui.read(),beforeRequests=requests.length;
ui.stageShared(share);
assert.deepEqual(ui.read(),beforeShare,'staging a share must retain geometry/model snapshot');
assert.equal(requests.length,beforeRequests,'staging a share must not request calculation or training');
assert.equal(ui.pending().chapter,'acsf');
const previousPending=JSON.stringify(ui.pending());
ui.receiveShared('%%%');assert.equal(JSON.stringify(ui.pending()),previousPending,'invalid incoming link replaces a valid pending draft');assert.deepEqual(ui.read(),beforeShare);
assert.throws(()=>ui.stageShared({...share,config:{...share.config,atoms:[]}}));assert.deepEqual(ui.read(),beforeShare);
console.log('Share staging passed: no optimizer/update requests, no model overwrite, invalid links retain current and pending state.');

// Restore focus to an actually visible control when the narrow More menu closes.
const menu=element('more-nav'),summary=new Element('more-summary');menu.querySelector=()=>summary;
let restored=null;summary.focus=()=>{restored='summary';};element('open-sources').focus=()=>{restored='trigger';};
context.matchMedia=()=>({matches:false});menu.open=false;ui.restoreSourcesFocus();assert.equal(restored,'summary');
menu.open=true;ui.restoreSourcesFocus();assert.equal(restored,'trigger');
context.matchMedia=()=>({matches:true});menu.open=false;ui.restoreSourcesFocus();assert.equal(restored,'trigger');
console.log('Dialog focus passed: narrow closed/open menu and desktop trigger restoration.');
