/* ===========================
   Favot Shift Ver1.0
   app.js
=========================== */

let staffList = [
    {
        id: 1,
        name: "A",
        enabled: true,
        autoAssign: true
    },
    {
        id: 2,
        name: "B",
        enabled: true,
        autoAssign: true
    },
    {
        id: 3,
        name: "C",
        enabled: true,
        autoAssign: true
    },
    {
        id: 4,
        name: "D",
        enabled: true,
        autoAssign: true
    },
    {
        id: 5,
        name: "副社長",
        enabled: true,
        autoAssign: false
    }
];

const monthSelect = document.getElementById("monthSelect");
const createBtn = document.getElementById("createBtn");
const clearAutoBtn = document.getElementById("clearAutoBtn");
const resetMonthBtn = document.getElementById("resetMonthBtn");

const shiftHead = document.getElementById("shiftHead");
const shiftBody = document.getElementById("shiftBody");

const LAST_MONTH_KEY = "favotShiftVer1:lastSavedMonth";

monthSelect.value =
    localStorage.getItem(LAST_MONTH_KEY) || "2026-09";

monthSelect.addEventListener("change", () => {

    if (!loadData()) {

        loadStaffMaster();
        buildTable();

    }

});

createBtn.addEventListener("click", createAutoShift);
clearAutoBtn.addEventListener("click", clearAutoShiftResult);
resetMonthBtn.addEventListener("click", resetCurrentMonthShift);

const hasStaffMaster = loadStaffMaster();

if (!loadData()) {

    buildTable();

}

if (!hasStaffMaster) {

    saveStaffMaster();

}
