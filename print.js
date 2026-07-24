/* ===========================
   Favot Shift Ver1.0
   print.js
=========================== */

const printBtn = document.getElementById("printBtn");
const PRINT_AREA_ID = "printShiftArea";

printBtn.addEventListener("click", printShift);
window.addEventListener("beforeprint", preparePrintLayout);
window.addEventListener("afterprint", cleanupPrintLayout);

function printShift() {

    preparePrintLayout();
    window.print();

}

function preparePrintLayout() {

    cleanupPrintLayout();

    const table = document.getElementById("shiftTable");
    if (!table) return;

    const days = table.querySelectorAll("#shiftHead .dateHeaderCell").length;
    if (!days) return;

    const printArea = document.createElement("section");
    printArea.id = PRINT_AREA_ID;
    printArea.className = "printShiftArea";

    const title = document.createElement("div");
    title.className = "printShiftTitle";
    title.textContent = getPrintMonthTitle();
    printArea.appendChild(title);

    printArea.appendChild(createPrintShiftBlock(1, Math.min(15, days), "1\u65e5\u301c15\u65e5"));

    const divider = document.createElement("div");
    divider.className = "printShiftDivider";
    printArea.appendChild(divider);

    if (days >= 16) {
        printArea.appendChild(createPrintShiftBlock(16, days, `16\u65e5\u301c${days}\u65e5`));
    }

    document.body.appendChild(printArea);

}

function cleanupPrintLayout() {

    const existing = document.getElementById(PRINT_AREA_ID);
    if (existing) {
        existing.remove();
    }

}

function createPrintShiftBlock(startDay, endDay, label) {

    const block = document.createElement("section");
    block.className = "printShiftBlock";

    const blockTitle = document.createElement("div");
    blockTitle.className = "printShiftBlockTitle";
    blockTitle.textContent = label;
    block.appendChild(blockTitle);

    const table = document.createElement("table");
    table.className = "printShiftTable";

    table.appendChild(createPrintHeader(startDay, endDay));
    table.appendChild(createPrintBody(startDay, endDay));

    block.appendChild(table);

    return block;

}

function createPrintHeader(startDay, endDay) {

    const thead = document.createElement("thead");
    const row = document.createElement("tr");

    const staffHeader = document.createElement("th");
    staffHeader.className = "printStaffCell";
    staffHeader.textContent = "\u30b9\u30bf\u30c3\u30d5";
    row.appendChild(staffHeader);

    for (let day = startDay; day <= endDay; day++) {
        const source = document.querySelectorAll("#shiftHead .dateHeaderCell")[day - 1];
        const cell = document.createElement("th");
        cell.className = `printDateCell ${getPrintWeekendClass(source)}`;
        cell.innerHTML = source ? source.innerHTML : String(day);
        row.appendChild(cell);
    }

    getPrintCountHeaders().forEach(header => {
        const cell = document.createElement("th");
        cell.className = "printCountCell";
        cell.appendChild(document.createTextNode(header));

        const note = document.createElement("small");
        note.textContent = "\u6708\u8a08";
        cell.appendChild(note);

        row.appendChild(cell);
    });

    thead.appendChild(row);

    return thead;

}

function createPrintBody(startDay, endDay) {

    const tbody = document.createElement("tbody");
    const rows = document.querySelectorAll("#shiftBody tr");

    rows.forEach(sourceRow => {
        const row = document.createElement("tr");

        const staff = document.createElement("th");
        staff.className = "printStaffCell";
        staff.textContent = sourceRow.querySelector(".staffCell")?.textContent || "";
        row.appendChild(staff);

        const shiftCells = sourceRow.querySelectorAll("td[data-shift]");
        for (let day = startDay; day <= endDay; day++) {
            const source = shiftCells[day - 1];
            const cell = document.createElement("td");
            cell.className = "printShiftCell";
            cell.textContent = source?.textContent || "";
            row.appendChild(cell);
        }

        getPrintCountValues(sourceRow).forEach(value => {
            const cell = document.createElement("td");
            cell.className = "printCountCell";
            cell.textContent = value;
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    return tbody;

}

function getPrintMonthTitle() {

    if (!monthSelect || !monthSelect.value) return "Favot Shift";

    const [year, month] = monthSelect.value.split("-");
    return `Favot Shift ${year}\u5e74${month}\u6708`;

}

function getPrintWeekendClass(source) {

    if (!source) return "";
    if (source.classList.contains("sat")) return "sat";
    if (source.classList.contains("sun")) return "sun";
    return "";

}

function getPrintCountHeaders() {

    const headers = [...document.querySelectorAll("#shiftHead .countHeaderCell")]
        .map(cell => cell.textContent.trim())
        .filter(Boolean);

    return headers.length ? headers : ["\u65e9", "\u9045", "\u591c", "\u4f11"];

}

function getPrintCountValues(sourceRow) {

    const values = [...sourceRow.querySelectorAll(".countCell")]
        .map(cell => cell.textContent.trim());

    return values.length ? values : ["0", "0", "0", "0"];

}
