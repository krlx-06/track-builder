const GRID_SIZE = 20;
const STORAGE_KEY = 'trackbuilder_maps';
const PASSABLE = ['road', 'start', 'finish'];

let state = {
    mapName: 'Nova mapa',
    grid: [],
    currentTile: 'grass',
    isPainting: false,
    carAnimation: null
};

function createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () =>
        Array(GRID_SIZE).fill('grass')
    );
}

function loadMaps() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveMaps(maps) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function showStatus(msg, isError) {
    const bar = document.getElementById('status-bar');
    bar.textContent = msg;
    bar.classList.remove('hidden', 'error');
    if (isError) bar.classList.add('error');
}

function hideStatus() {
    document.getElementById('status-bar').classList.add('hidden');
}

function showModal(message, hasInput, defaultValue) {
    return new Promise(resolve => {
        document.getElementById('modal-message').textContent = message;
        const input = document.getElementById('modal-input');
        if (hasInput) {
            input.classList.remove('hidden');
            input.value = defaultValue || '';
            setTimeout(() => input.focus(), 50);
        } else {
            input.classList.add('hidden');
        }
        document.getElementById('modal-overlay').classList.remove('hidden');

        const confirm = document.getElementById('modal-confirm');
        const cancel = document.getElementById('modal-cancel');

        function cleanup() {
            document.getElementById('modal-overlay').classList.add('hidden');
            confirm.removeEventListener('click', onConfirm);
            cancel.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
        }

        function onConfirm() { cleanup(); resolve(hasInput ? input.value.trim() : true); }
        function onCancel()  { cleanup(); resolve(null); }
        function onKey(e) {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        }

        confirm.addEventListener('click', onConfirm);
        cancel.addEventListener('click', onCancel);
        if (hasInput) input.addEventListener('keydown', onKey);
    });
}

function getTile(r, c) {
    return document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
}

function renderGrid() {
    const grid = document.getElementById('grid');
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 28px)`;
    grid.innerHTML = '';

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.type = state.grid[r][c];
            tile.dataset.r = r;
            tile.dataset.c = c;
            grid.appendChild(tile);
        }
    }
}

function paintTile(r, c) {
    const type = state.currentTile;

    if (type === 'start') {
        for (let rr = 0; rr < GRID_SIZE; rr++) {
            for (let cc = 0; cc < GRID_SIZE; cc++) {
                if (state.grid[rr][cc] === 'start') {
                    state.grid[rr][cc] = 'road';
                    const t = getTile(rr, cc);
                    if (t) t.dataset.type = 'road';
                }
            }
        }
    }

    if (type === 'finish') {
        for (let rr = 0; rr < GRID_SIZE; rr++) {
            for (let cc = 0; cc < GRID_SIZE; cc++) {
                if (state.grid[rr][cc] === 'finish') {
                    state.grid[rr][cc] = 'road';
                    const t = getTile(rr, cc);
                    if (t) t.dataset.type = 'road';
                }
            }
        }
    }

    state.grid[r][c] = type;
    const tile = getTile(r, c);
    if (tile) tile.dataset.type = type;
}

function updateNameDisplay() {
    document.getElementById('map-name-display').textContent = state.mapName;
}

function openEditor(name, grid) {
    stopCar();
    state.mapName = name;
    state.grid = grid || createEmptyGrid();
    updateNameDisplay();
    renderGrid();
    hideStatus();
    showScreen('screen-editor');
}

function findTile(type) {
    for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
            if (state.grid[r][c] === type) return [r, c];
    return null;
}

function bfs(startR, startC, endR, endC) {
    const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    const prev = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const queue = [[startR, startC]];
    visited[startR][startC] = true;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        if (r === endR && c === endC) {
            const path = [];
            let cur = [r, c];
            while (cur) {
                path.unshift(cur);
                cur = prev[cur[0]][cur[1]];
            }
            return path;
        }
        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE
                && !visited[nr][nc] && PASSABLE.includes(state.grid[nr][nc])) {
                visited[nr][nc] = true;
                prev[nr][nc] = [r, c];
                queue.push([nr, nc]);
            }
        }
    }
    return null;
}

function stopCar() {
    if (state.carAnimation) {
        clearTimeout(state.carAnimation);
        state.carAnimation = null;
    }
    document.querySelectorAll('.tile.car, .tile.path-highlight').forEach(t => {
        t.classList.remove('car', 'path-highlight');
    });
    document.getElementById('btn-run').disabled = false;
}

function runCar() {
    stopCar();
    hideStatus();

    const startPos  = findTile('start');
    const finishPos = findTile('finish');

    if (!startPos) { showStatus('Chyba: Na mape neni umisteny Start.', true); return; }
    if (!finishPos) { showStatus('Chyba: Na mape neni umisteny Cil.', true); return; }

    const path = bfs(startPos[0], startPos[1], finishPos[0], finishPos[1]);

    if (!path) { showStatus('Cesta nenalezena. Auto se nemuze dostat do cile po silnici.', true); return; }

    showStatus('Auto jede...');
    document.getElementById('btn-run').disabled = true;

    path.forEach(([r, c], i) => {
        if (i > 0 && i < path.length - 1) {
            getTile(r, c)?.classList.add('path-highlight');
        }
    });

    let step = 0;
    let prevTile = null;

    function advance() {
        if (prevTile) prevTile.classList.remove('car');

        if (step >= path.length) {
            showStatus('Auto dojelo do cile.');
            document.getElementById('btn-run').disabled = false;
            state.carAnimation = null;
            return;
        }

        const [r, c] = path[step];
        const tile = getTile(r, c);
        if (tile) {
            tile.classList.remove('path-highlight');
            tile.classList.add('car');
            prevTile = tile;
        }

        step++;
        state.carAnimation = setTimeout(advance, 120);
    }

    advance();
}

function renderMapList() {
    const maps = loadMaps();
    const list = document.getElementById('map-list');
    list.innerHTML = '';

    const names = Object.keys(maps);
    if (names.length === 0) {
        list.innerHTML = '<li><span style="color:#666">Zadne ulozene mapy</span></li>';
        return;
    }

    names.forEach(name => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = name;

        const btnLoad = document.createElement('button');
        btnLoad.textContent = 'Nacist';
        btnLoad.addEventListener('click', () => openEditor(name, maps[name]));

        const btnDelete = document.createElement('button');
        btnDelete.textContent = 'Smazat';
        btnDelete.addEventListener('click', async () => {
            const ok = await showModal(`Smazat mapu "${name}"?`, false, null);
            if (ok) {
                const m = loadMaps();
                delete m[name];
                saveMaps(m);
                renderMapList();
            }
        });

        const btnExport = document.createElement('button');
        btnExport.textContent = 'Export';
        btnExport.addEventListener('click', () => exportMap(name, maps[name]));

        li.appendChild(span);
        li.appendChild(btnLoad);
        li.appendChild(btnDelete);
        li.appendChild(btnExport);
        list.appendChild(li);
    });
}

function exportMap(name, grid) {
    const data = JSON.stringify({ name, grid }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('btn-new').addEventListener('click', () => {
    openEditor('Nova mapa', createEmptyGrid());
});

document.getElementById('btn-load').addEventListener('click', () => {
    renderMapList();
    showScreen('screen-load');
});

document.getElementById('btn-back-load').addEventListener('click', () => showScreen('screen-menu'));
document.getElementById('btn-menu').addEventListener('click', () => { stopCar(); showScreen('screen-menu'); });

document.getElementById('btn-rename').addEventListener('click', async () => {
    const name = await showModal('Novy nazev mapy:', true, state.mapName);
    if (name) { state.mapName = name; updateNameDisplay(); }
});

document.getElementById('btn-save').addEventListener('click', async () => {
    let name = state.mapName;
    if (name === 'Nova mapa') {
        const input = await showModal('Ulozit jako:', true, name);
        if (!input) return;
        name = input;
    }
    const maps = loadMaps();
    maps[name] = state.grid;
    saveMaps(maps);
    state.mapName = name;
    updateNameDisplay();
    await showModal(`Mapa "${name}" ulozena.`, false, null);
});

document.getElementById('btn-export').addEventListener('click', () => exportMap(state.mapName, state.grid));

document.getElementById('btn-clear').addEventListener('click', async () => {
    const ok = await showModal('Vymazat celou mapu?', false, null);
    if (ok) { stopCar(); state.grid = createEmptyGrid(); renderGrid(); hideStatus(); }
});

document.getElementById('btn-run').addEventListener('click', runCar);

document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTile = btn.dataset.type;
    });
});

const gridEl = document.getElementById('grid');

gridEl.addEventListener('mousedown', e => {
    if (e.target.classList.contains('tile')) {
        state.isPainting = true;
        paintTile(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c));
    }
});

gridEl.addEventListener('mouseover', e => {
    if (state.isPainting && e.target.classList.contains('tile')) {
        paintTile(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c));
    }
});

document.addEventListener('mouseup', () => { state.isPainting = false; });

document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const data = JSON.parse(evt.target.result);
            if (!data.name || !data.grid) throw new Error();
            const maps = loadMaps();
            maps[data.name] = data.grid;
            saveMaps(maps);
            renderMapList();
        } catch {
            showModal('Chyba: neplatny soubor.', false, null);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});
