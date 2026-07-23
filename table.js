/* ===========================
   Favot Shift Ver1.0
   table.js
=========================== */

const SHIFT_MASTER = [
    "",
    "早①",
    "早②",
    "遅",
    "夜①",
    "夜②",
    "休",
    "有"
];

const COUNT_COLUMNS = [
    { key: "early", label: "早", className: "earlyCount" },
    { key: "late", label: "遅", className: "lateCount" },
    { key: "night", label: "夜", className: "nightCount" },
    { key: "rest", label: "休", className: "restCount" }
];

function buildTable() {

    const [year, month] = monthSelect.value.split("-");

    const days = new Date(year, month, 0).getDate();

    createHeader(year, month, days);

    createBody(days);

    attachCellEvents();

    updateCount();

}

function createHeader(year, month, days) {

    let html = `
        <tr>
            <th class="staffHeaderCell stickyLeft">スタッフ</th>
    `;

    for (let day = 1; day <= days; day++) {

        const date = new Date(year, month - 1, day);

        const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];

        let cls = "";

        if (date.getDay() === 6) cls = "sat";
        if (date.getDay() === 0) cls = "sun";

        html += `
            <th class="dateHeaderCell ${cls}">
                ${day}
                <small>${week}</small>
            </th>
        `;

    }

    COUNT_COLUMNS.forEach(column => {

        html += `
            <th class="countHeaderCell ${column.className}">
                ${column.label}
            </th>
        `;

    });

    html += `
        </tr>
    `;

    shiftHead.innerHTML = html;
}

function createBody(days) {

    let html = "";

    const activeStaff = staffList.filter(staff => staff.enabled);

    activeStaff.forEach(staff => {

        html += `
            <tr data-id="${staff.id}">
                <th class="staffCell stickyLeft">${staff.name}</th>
        `;

        for (let day = 1; day <= days; day++) {

            html += `
                <td class="shiftCell" data-shift=""></td>
            `;

        }

        COUNT_COLUMNS.forEach(column => {

            html += `
                <td class="countCell ${column.className}">0</td>
            `;

        });

        html += `
            </tr>
        `;

    });

    shiftBody.innerHTML = html;

}
function attachCellEvents() {

    const cells = document.querySelectorAll("#shiftBody td[data-shift]");

    cells.forEach(cell => {

        cell.addEventListener("click", () => {

            let current = cell.dataset.shift;

            let index = SHIFT_MASTER.indexOf(current);

            index++;

            if (index >= SHIFT_MASTER.length) {

                index = 0;

            }

            current = SHIFT_MASTER[index];

            cell.dataset.shift = current;

            cell.textContent = current;

            updateCount();

            saveData();

        });

    });

}

function updateCount() {

    document.querySelectorAll("#shiftBody tr").forEach(row => {

        let early = 0;
        let late = 0;
        let night = 0;
        let rest = 0;

        row.querySelectorAll("td[data-shift]").forEach(cell => {

            switch (cell.dataset.shift) {

                case "早①":
                case "早②":
                    early++;
                    break;

                case "遅":
                    late++;
                    break;

                case "夜①":
                case "夜②":
                    night++;
                    break;

                case "休":
                case "有":
                    rest++;
                    break;

            }

        });

        row.querySelector(".earlyCount").textContent = early;
        row.querySelector(".lateCount").textContent = late;
        row.querySelector(".nightCount").textContent = night;
        row.querySelector(".restCount").textContent = rest;

    });

}
