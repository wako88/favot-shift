/* ===========================
   Favot Shift Ver1.0
   storage.js
=========================== */

const STORAGE_KEY = "favotShiftVer1";

function saveData() {

    const data = {

        month: monthSelect.value,

        staff: staffList,

        shifts: []

    };

    document.querySelectorAll("#shiftBody tr").forEach(row => {

        const list = [];

        row.querySelectorAll("td[data-shift]").forEach(cell => {

            list.push(cell.dataset.shift);

        });

        data.shifts.push(list);

    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

}

function loadData() {

    const json = localStorage.getItem(STORAGE_KEY);

    if (!json) {

        return false;

    }

    const data = JSON.parse(json);

    if (data.month) {

        monthSelect.value = data.month;

    }

    if (Array.isArray(data.staff)) {

        staffList = data.staff;

    }

    buildTable();

    const rows = document.querySelectorAll("#shiftBody tr");

    rows.forEach((row, rowIndex) => {

        if (!data.shifts[rowIndex]) return;

        const cells = row.querySelectorAll("td[data-shift]");

        cells.forEach((cell, colIndex) => {

            const shift = data.shifts[rowIndex][colIndex] || "";

            cell.dataset.shift = shift;
            cell.textContent = shift;

        });

    });

    updateCount();

    return true;

}