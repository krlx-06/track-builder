
const GRID_SIZE = 20;         // 20x20 tiles
const STORAGE_KEY = 'trackbuilder_maps';

const TILE_TYPES = {
  grass:  { emoji: '🟩', label: 'Tráva',   bg: '#3a7d44' },
  road:   { emoji: '⬛', label: 'Silnice',  bg: '#444'    },
  water:  { emoji: '🟦', label: 'Voda',    bg: '#1e6091' },
  sand:   { emoji: '🟨', label: 'Písek',   bg: '#c8a84b' },
  wall:   { emoji: '🟫', label: 'Zeď',     bg: '#7d5a3c' },
  finish: { emoji: '🏁', label: 'Cíl',     bg: '#222'    },
};

let mapData = [];          // 2D pole string klíčů (např. 'grass')
let selectedTile = 'road'; // Aktuálně vybraný nástroj
let isPainting = false;    // Táhnutí myši


window.addEventListener('DOMContentLoaded', () => {
  buildPalette();
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  if (id === 'screen-load') {
    renderSavedList();
  }
}

function buildPalette() {
  const palette = document.getElementById('palette');
  palette.innerHTML = '';

  Object.entries(TILE_TYPES).forEach(([key, def]) => {
    const item = document.createElement('div');
    item.className = 'palette-item' + (key === selectedTile ? ' selected' : '');
    item.dataset.tile = key;
    item.innerHTML = `<span class="icon">${def.emoji}</span><span>${def.label}</span>`;
    item.addEventListener('click', () => selectTile(key));
    palette.appendChild(item);
  });
}

function selectTile(key) {
  selectedTile = key;
  document.querySelectorAll('.palette-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.tile === key);
  });
}

function newMap() {
  mapData = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill('grass')
  );
  document.getElementById('map-name').value = '';
  renderGrid();
  showScreen('screen-editor');
}

function clearMap() {
  if (!confirm('Opravdu vymazat celou mapu?')) return;
  mapData = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill('grass')
  );
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 32px)`;
  grid.style.gridTemplateRows    = `repeat(${GRID_SIZE}, 32px)`;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.r = r;
      tile.dataset.c = c;
      setTileVisual(tile, mapData[r][c]);

      tile.addEventListener('mousedown', () => {
        isPainting = true;
        paintTile(r, c);
      });

      tile.addEventListener('mouseover', () => {
        if (isPainting) paintTile(r, c);
      });

      grid.appendChild(tile);
    }
  }

  document.addEventListener('mouseup', () => { isPainting = false; }, { once: false });
}

function setTileVisual(tileEl, typeKey) {
  const def = TILE_TYPES[typeKey] || TILE_TYPES.grass;
  tileEl.style.background = def.bg;
  tileEl.textContent = def.emoji;
}

function paintTile(r, c) {
  mapData[r][c] = selectedTile;
  const grid = document.getElementById('grid');
  const idx = r * GRID_SIZE + c;
  const tileEl = grid.children[idx];
  if (tileEl) setTileVisual(tileEl, selectedTile);
}

function getMaps() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMap() {
  const name = document.getElementById('map-name').value.trim();
  if (!name) {
    alert('Zadej název mapy!');
    return;
  }

  const maps = getMaps();
  maps[name] = {
    name,
    size: GRID_SIZE,
    data: mapData,
    savedAt: new Date().toLocaleString('cs-CZ'),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  alert(`✅ Mapa "${name}" uložena!`);
}

function loadMapByName(name) {
  const maps = getMaps();
  const saved = maps[name];
  if (!saved) return;

  mapData = saved.data;
  document.getElementById('map-name').value = saved.name;
  renderGrid();
  showScreen('screen-editor');
}

function deleteMapByName(name) {
  if (!confirm(`Smazat mapu "${name}"?`)) return;
  const maps = getMaps();
  delete maps[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  renderSavedList();
}

function renderSavedList() {
  const maps = getMaps();
  const list = document.getElementById('saved-list');
  const keys = Object.keys(maps);

  if (keys.length === 0) {
    list.innerHTML = '<p class="empty-msg">Žádné uložené mapy.</p>';
    return;
  }

  list.innerHTML = '';
  keys.forEach(name => {
    const m = maps[name];
    const item = document.createElement('div');
    item.className = 'save-item';
    item.innerHTML = `
      <span>🗺️ ${m.name} <small style="color:#555">${m.savedAt || ''}</small></span>
      <div class="item-actions">
        <button onclick="loadMapByName('${escapeName(name)}')">Načíst</button>
        <button class="del-btn" onclick="deleteMapByName('${escapeName(name)}')">🗑</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function escapeName(name) {
  return name.replace(/'/g, "\\'");
}


function exportMap() {
  const name = document.getElementById('map-name').value.trim() || 'mapa';
  const payload = {
    name,
    size: GRID_SIZE,
    data: mapData,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importMap(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.data || !Array.isArray(parsed.data)) throw new Error('Špatný formát');
      mapData = parsed.data;
      document.getElementById('map-name').value = parsed.name || '';
      renderGrid();
      alert(`✅ Mapa "${parsed.name}" importována!`);
    } catch {
      alert('❌ Nepodařilo se načíst soubor. Zkontroluj formát.');
    }
  };
  reader.readAsText(file);

  event.target.value = '';
}
