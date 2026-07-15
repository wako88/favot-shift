/* ===========================
   Favot Shift Ver1.0
   app.js
=========================== */

let staffList = [
    {
        id: 1,
        name: "A",
        enabled: true
    },
    {
        id: 2,
        name: "B",
        enabled: true
    },
    {
        id: 3,
        name: "C",
        enabled: true
    },
    {
        id: 4,
        name: "D",
        enabled: true
    }
];

const monthSelect = document.getElementById("monthSelect");

const shiftHead = document.getElementById("shiftHead");
const shiftBody = document.getElementById("shiftBody");

const today = new Date();

monthSelect.value =
`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

monthSelect.addEventListener("change", () => {

    buildTable();

    saveData();

});

loadData();

buildTable();