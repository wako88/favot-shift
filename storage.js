/* ===========================
   Favot Shift Ver1.0
   storage.js
=========================== */

const STORAGE_KEY = "favotShiftVer1";
const STAFF_MASTER_KEY = `${STORAGE_KEY}:staffMaster`;

function getMonthStorageKey(month) {

    return `${STORAGE_KEY}:${month}`;

}

function collectShiftData() {

    const rows = [];
    const shifts = [];

    document.querySelectorAll("#shiftBody tr").forEach(row => {

        const list = [];

        const sources = [];

        row.querySelectorAll("td[data-shift]").forEach(cell => {

            list.push(cell.dataset.shift);
            sources.push(getSavedCellSource(cell));

        });

        rows.push({
            staffId: Number(row.dataset.id),
            shifts: list,
            sources
        });

        shifts.push(list);

    });

    return { rows, shifts };

}

function saveData() {

    const shiftData = collectShiftData();

    const data = {

        month: monthSelect.value,

        staff: cloneStaffList(getBestKnownStaffList(staffList)),

        rows: shiftData.rows,

        shifts: shiftData.shifts

    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(getMonthStorageKey(monthSelect.value), JSON.stringify(data));

}

function loadData() {

    const requestedMonth = monthSelect.value;
    let json = localStorage.getItem(getMonthStorageKey(requestedMonth));

    if (!json) {

        const legacyJson = localStorage.getItem(STORAGE_KEY);

        if (legacyJson) {

            const legacyData = JSON.parse(legacyJson);

            if (legacyData.month === requestedMonth) {

                json = legacyJson;

            }

        }

    }

    if (!json) {

        return false;

    }

    const data = JSON.parse(json);

    if (Array.isArray(data.staff)) {

        staffList = resolveDisplayStaffList(data.staff);

    }

    buildTable();

    const rows = document.querySelectorAll("#shiftBody tr");

    rows.forEach((row, rowIndex) => {

        const staffId = Number(row.dataset.id);
        const savedRow = Array.isArray(data.rows)
            ? data.rows.find(item => Number(item.staffId) === staffId)
            : null;
        const savedShifts = savedRow
            ? savedRow.shifts
            : data.shifts[rowIndex];
        const savedSources = savedRow && Array.isArray(savedRow.sources)
            ? savedRow.sources
            : null;

        if (!savedShifts) return;

        const cells = row.querySelectorAll("td[data-shift]");

        cells.forEach((cell, colIndex) => {

            const shift = savedShifts[colIndex] || "";
            const source = savedSources
                ? savedSources[colIndex] || ""
                : (shift ? "manual" : "");

            restoreCellValue(cell, shift, source);

        });

    });

    updateCount();

    return true;

}

function saveStaffMaster() {

    localStorage.setItem(STAFF_MASTER_KEY, JSON.stringify(cloneStaffList(getBestKnownStaffList(staffList))));

}

function loadStaffMaster() {

    const json = localStorage.getItem(STAFF_MASTER_KEY);
    if (!json) return false;

    try {
        const list = JSON.parse(json);
        if (!Array.isArray(list)) return false;

        staffList = getBestKnownStaffList(list);
        return true;
    } catch (e) {
        return false;
    }

}

function resolveDisplayStaffList(savedStaff) {

    return getBestKnownStaffList(savedStaff);

}

function getBestKnownStaffList(baseList) {

    const normalized = normalizeStaffList(baseList);
    const bestNames = collectBestKnownStaffNames(normalized);

    return normalized.map(staff => {
        const bestName = bestNames.get(staff.id);
        if (bestName && isPlaceholderStaffName(staff.name)) {
            return { ...staff, name: bestName };
        }
        return staff;
    });

}

function collectBestKnownStaffNames(baseList) {

    const bestNames = new Map();

    normalizeStaffList(baseList).forEach(staff => {
        if (!isPlaceholderStaffName(staff.name)) {
            bestNames.set(staff.id, staff.name);
        }
    });

    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === STAFF_MASTER_KEY || key.startsWith(`${STORAGE_KEY}:`))) {
            keys.push(key);
        }
    }

    keys.forEach(key => {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            const list = Array.isArray(data) ? data : data.staff;
            normalizeStaffList(list).forEach(staff => {
                if (!bestNames.has(staff.id) && !isPlaceholderStaffName(staff.name)) {
                    bestNames.set(staff.id, staff.name);
                }
            });
        } catch (e) {
            // Ignore broken legacy data.
        }
    });

    return bestNames;

}

function isPlaceholderStaffName(name) {

    return /^[A-D]$/.test(name || "") || /^スタッフ\d+$/.test(name || "");

}

function cloneStaffList(list) {

    return normalizeStaffList(list).map(staff => ({ ...staff }));

}

function normalizeStaffList(list) {

    if (!Array.isArray(list)) return [];

    return list.map(staff => ({
        id: Number(staff.id),
        name: staff.name || "スタッフ",
        enabled: staff.enabled !== false,
        autoAssign: staff.autoAssign !== false
    }));

}

function getSavedCellSource(cell) {

    const shift = cell.dataset.shift || "";
    if (!shift) return "";
    if (cell.dataset.source === "auto" || cell.dataset.autoAssigned === "true") return "auto";
    return "manual";

}

function restoreCellValue(cell, shift, source) {

    cell.dataset.shift = shift;
    cell.textContent = getShiftDisplayName(shift);
    cell.classList.remove("autoAssignedCell", "autoWarningCell");

    if (!shift) {
        delete cell.dataset.source;
        delete cell.dataset.autoAssigned;
        return;
    }

    cell.dataset.source = source || "manual";

    if (cell.dataset.source === "auto") {
        cell.dataset.autoAssigned = "true";
        cell.classList.add("autoAssignedCell");
    } else {
        delete cell.dataset.autoAssigned;
    }

}

function loadMonthShiftData(month) {

    const json = localStorage.getItem(getMonthStorageKey(month));

    if (!json) return null;

    try {

        return JSON.parse(json);

    } catch (e) {

        return null;

    }

}
