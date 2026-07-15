/* ===========================
   Favot Shift Ver1.0
   staff.js
=========================== */

const staffDialog = document.getElementById("staffDialog");
const staffListArea = document.getElementById("staffList");

const staffBtn = document.getElementById("staffBtn");
const closeStaffBtn = document.getElementById("closeStaffBtn");
const addStaffBtn = document.getElementById("addStaffBtn");

staffBtn.addEventListener("click", () => {

    renderStaffList();

    staffDialog.showModal();

});

closeStaffBtn.addEventListener("click", () => {

    staffDialog.close();

});

addStaffBtn.addEventListener("click", addStaff);

function renderStaffList() {

    staffList.sort((a, b) => {

        if (a.enabled === b.enabled) {

            return a.id - b.id;

        }

        return a.enabled ? -1 : 1;

    });

    let html = `

        <div class="staffHeader">

            <div>自動</div>

            <div>有効</div>

            <div>スタッフ名</div>

        </div>

    `;
        staffList.forEach(staff => {

        if (staff.autoAssign === undefined) {

            staff.autoAssign = true;

        }

        html += `

        <div class="staffRow">

            <input
                type="checkbox"
                class="staffAuto"
                data-id="${staff.id}"
                ${staff.autoAssign ? "checked" : ""}
            >

            <input
                type="checkbox"
                class="staffEnabled"
                data-id="${staff.id}"
                ${staff.enabled ? "checked" : ""}
            >

            <input
                type="text"
                class="staffName"
                data-id="${staff.id}"
                value="${staff.name}"
            >

        </div>

        `;

    });

    staffListArea.innerHTML = html;

    attachStaffEvents();

}

function attachStaffEvents() {

    document.querySelectorAll(".staffName").forEach(input => {

        input.addEventListener("change", e => {

            const id = Number(e.target.dataset.id);

            const staff = staffList.find(s => s.id === id);

            if (!staff) return;

            staff.name = e.target.value.trim() || "スタッフ";

            saveData();

            buildTable();

            renderStaffList();

        });

    });
        document.querySelectorAll(".staffEnabled").forEach(check => {

        check.addEventListener("change", e => {

            const id = Number(e.target.dataset.id);

            const staff = staffList.find(s => s.id === id);

            if (!staff) return;

            staff.enabled = e.target.checked;

            saveData();

            buildTable();

            renderStaffList();

        });

    });

    document.querySelectorAll(".staffAuto").forEach(check => {

        check.addEventListener("change", e => {

            const id = Number(e.target.dataset.id);

            const staff = staffList.find(s => s.id === id);

            if (!staff) return;

            staff.autoAssign = e.target.checked;

            saveData();

            renderStaffList();

        });

    });

}

function addStaff() {

    const nextId = staffList.length === 0
        ? 1
        : Math.max(...staffList.map(s => s.id)) + 1;

    staffList.push({

        id: nextId,

        name: `スタッフ${nextId}`,

        enabled: true,

        autoAssign: true

    });

    saveData();

    buildTable();

    renderStaffList();

}