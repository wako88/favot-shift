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
            <th>スタッフ</th>
    `;

    for (let day = 1; day <= days; day++) {

        const date = new Date(year, month - 1, day);

        const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];

        let cls = "";

        if (date.getDay() === 6) cls = "sat";
        if (date.getDay() === 0) cls = "sun";

        html += `
            <th class="${cls}">
                ${day}
                <small>${week}</small>
            </th>
        `;

    }

    html += `
            <th>回数</th>
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
                <th>${staff.name}</th>
        `;

        for (let day = 1; day <= days; day++) {

            html += `
                <td data-shift=""></td>
            `;

        }

        html += `
                <td class="countCell">0</td>
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

        let count = 0;

        row.querySelectorAll("td[data-shift]").forEach(cell => {

            const shift = cell.dataset.shift;

            if (
                shift !== "" &&
                shift !== "休" &&
                shift !== "有"
            ) {
                count++;
            }

        });

        row.querySelector(".countCell").textContent = count;

    });

}